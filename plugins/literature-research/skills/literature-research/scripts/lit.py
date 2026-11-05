#!/usr/bin/env python3
"""lit.py - bookkeeping and verification helper for the literature-research skill (standard library only).

Manages one folder per research question, `docs/literature/<topic>/`:
  question.md, search_log.md, candidates.jsonl, ledger.md, verify/, synthesis.md, sources.bib, to_fetch.md

Commands: init, search (pubmed | s2 | arxiv | openalex | devonthink), cites, screen, fetch, text, quote,
check, bib, devonthink-status.  Run `lit.py -h` or `lit.py <command> -h`.

Exit codes: 0 ok; 1 problems found / bad input; 2 not run (optional tool or DEVONthink unavailable);
3 full text not found (ask the owner; written to to_fetch.md); 4 network or API failure.
Optional tools: `pdftotext` (poppler) for text/quote on PDFs; `osascript` + DEVONthink on macOS.
Environment: NCBI_API_KEY, S2_API_KEY, OPENALEX_API_KEY (all optional); LIT_DEVONTHINK=off disables DEVONthink.
"""
import argparse
import bisect
import collections
import datetime
import difflib
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

UA = "literature-research/0.1 (research tool)"
SKILL_DIR = Path(__file__).resolve().parent.parent
TEMPLATES = SKILL_DIR / "templates" / "literature"

QUESTION_TYPES = ("value", "review", "novelty", "verify", "method")
STATUSES = ("new", "in", "out")
EVIDENCE = ("measured", "modelled", "cited", "inferred")
VERIFIED = ("unchecked", "confirmed", "corrected", "not-found", "abstract-only", "indirect")
LEDGER_COLS = ["id", "claim", "value", "conditions", "source", "locator", "quote", "evidence", "verified", "note"]
LOG_HEADER = "| # | date | source | query | filters | hits | new | note |"
LOG_SEP = "|---|------|--------|-------|---------|------|-----|------|"
FETCH_HEADER = "| key | title | DOI | why needed |"
FETCH_SEP = "|-----|-------|-----|------------|"
S2_FIELDS = "title,authors,year,venue,abstract,externalIds,openAccessPdf"
OA_SELECT = ("id,doi,title,display_name,publication_year,authorships,primary_location,best_oa_location,"
             "abstract_inverted_index,ids")


class LitError(Exception):
    def __init__(self, msg, code=1):
        super().__init__(msg)
        self.code = code


class NetError(LitError):
    def __init__(self, msg):
        super().__init__(msg, 4)


# ---------------------------------------------------------------- http

def http_get(url, headers=None, timeout=30, retries=3):
    """GET bytes; back off and retry on 429/502/503/504 (up to `retries` times)."""
    hdrs = {"User-Agent": UA, "Accept": "*/*"}
    hdrs.update(headers or {})
    delay = 2.0
    for attempt in range(retries + 1):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=hdrs), timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code in (429, 502, 503, 504) and attempt < retries:
                wait = delay
                try:
                    wait = min(float(e.headers.get("Retry-After", delay)), 30)
                except (TypeError, ValueError):
                    pass
                time.sleep(wait)
                delay *= 2
                continue
            hint = " (set S2_API_KEY for a higher limit)" if e.code == 429 and "semanticscholar" in url else ""
            raise NetError(f"HTTP {e.code} from {urllib.parse.urlsplit(url).netloc}{hint}")
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            raise NetError(f"network error for {urllib.parse.urlsplit(url).netloc}: {getattr(e, 'reason', e)}")
    raise NetError("unreachable")


def get_json(url, headers=None):
    try:
        return json.loads(http_get(url, headers))
    except ValueError:
        raise NetError(f"non-JSON response from {urllib.parse.urlsplit(url).netloc}")


def qs(params):
    return urllib.parse.urlencode({k: v for k, v in params.items() if v not in (None, "")})


# ---------------------------------------------------------------- records

def norm_doi(d):
    if not d:
        return ""
    d = d.strip().lower()
    d = re.sub(r"^(https?://(dx\.)?doi\.org/|doi:\s*)", "", d)
    return d.rstrip(".,;")


def norm_arxiv(a):
    a = (a or "").strip()
    a = re.sub(r"^(https?://arxiv\.org/(abs|pdf)/|arxiv:)", "", a, flags=re.I)
    a = re.sub(r"\.pdf$", "", a)
    return re.sub(r"v\d+$", "", a)


def norm_title(t):
    t = unicodedata.normalize("NFKD", t or "").lower()
    t = "".join(c for c in t if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", " ", t).strip()


def name_to_cite(name):
    """'Frances Mechler' -> 'Mechler, Frances'; 'Mechler F' (PubMed) -> 'Mechler, F'; 'Mechler, F' unchanged."""
    name = re.sub(r"\s+", " ", (name or "").strip())
    if not name or "," in name:
        return name
    parts = name.split(" ")
    if len(parts) == 1:
        return name
    if re.fullmatch(r"[A-Z]{1,4}", parts[-1]):  # PubMed style: Surname + initials
        return f"{' '.join(parts[:-1])}, {parts[-1]}"
    return f"{parts[-1]}, {' '.join(parts[:-1])}"


def blank_record():
    return {"key": "", "doi": "", "pmid": "", "arxiv": "", "s2": "", "openalex": "", "title": "", "authors": [],
            "year": None, "venue": "", "abstract": "", "oa_pdf": "", "found_by": [], "status": "new", "reason": ""}


def mkrec(**kw):
    r = blank_record()
    r.update(kw)
    r["doi"] = norm_doi(r["doi"])
    r["arxiv"] = norm_arxiv(r["arxiv"])
    r["title"] = re.sub(r"\s+", " ", r["title"] or "").strip()
    r["abstract"] = re.sub(r"\s+", " ", r["abstract"] or "").strip()
    r["venue"] = re.sub(r"\s+", " ", r["venue"] or "").strip()
    r["authors"] = [a for a in (name_to_cite(x) for x in r["authors"]) if a]
    try:
        r["year"] = int(r["year"]) if r["year"] else None
    except (TypeError, ValueError):
        r["year"] = None
    return r


def year_of(text):
    m = re.search(r"\b(1[5-9]\d\d|20\d\d)\b", text or "")
    return int(m.group(1)) if m else None


def norm_pubmed(summary, fetch_xml):
    """esummary JSON (dict or bytes) + efetch XML (bytes or None) -> records."""
    if isinstance(summary, (bytes, str)):
        summary = json.loads(summary)
    abstracts = {}
    if fetch_xml:
        for art in ET.fromstring(fetch_xml).iter("PubmedArticle"):
            pid = art.findtext("MedlineCitation/PMID")
            parts = []
            for at in art.findall(".//Abstract/AbstractText"):
                txt = "".join(at.itertext()).strip()
                label = at.get("Label")
                parts.append(f"{label}: {txt}" if label and txt else txt)
            abstracts[pid] = " ".join(p for p in parts if p)
    res = summary.get("result", {})
    out = []
    for uid in res.get("uids", []):
        r = res[uid]
        doi = next((a["value"] for a in r.get("articleids", []) if a.get("idtype") == "doi"), "")
        out.append(mkrec(pmid=uid, doi=doi, title=r.get("title", ""), authors=[a["name"] for a in r.get("authors", [])],
                         year=year_of(r.get("pubdate") or r.get("epubdate")), venue=r.get("fulljournalname") or r.get("source", ""),
                         abstract=abstracts.get(uid, "")))
    return out


def norm_s2(item):
    ext = item.get("externalIds") or {}
    oa = item.get("openAccessPdf") or {}
    return mkrec(s2=item.get("paperId") or "", doi=ext.get("DOI", ""), pmid=ext.get("PubMed", ""), arxiv=ext.get("ArXiv", ""),
                 title=item.get("title") or "", authors=[a.get("name", "") for a in item.get("authors") or []],
                 year=item.get("year"), venue=item.get("venue") or "", abstract=item.get("abstract") or "",
                 oa_pdf=oa.get("url") or "")


ATOM = {"a": "http://www.w3.org/2005/Atom", "x": "http://arxiv.org/schemas/atom"}


def norm_arxiv_feed(xml_bytes):
    out = []
    for e in ET.fromstring(xml_bytes).findall("a:entry", ATOM):
        aid = norm_arxiv(e.findtext("a:id", "", ATOM))
        pdf = next((l.get("href") for l in e.findall("a:link", ATOM) if l.get("title") == "pdf"), f"https://arxiv.org/pdf/{aid}")
        out.append(mkrec(arxiv=aid, doi=e.findtext("x:doi", "", ATOM), title=e.findtext("a:title", "", ATOM),
                         authors=[n.text for n in e.findall("a:author/a:name", ATOM)],
                         year=year_of(e.findtext("a:published", "", ATOM)),
                         venue=e.findtext("x:journal_ref", "", ATOM) or "arXiv",
                         abstract=e.findtext("a:summary", "", ATOM), oa_pdf=pdf))
    return out


def oa_abstract(inv):
    if not inv:
        return ""
    words = {}
    for w, positions in inv.items():
        for p in positions:
            words[p] = w
    return " ".join(words[i] for i in sorted(words))


def norm_openalex(w):
    ids = w.get("ids") or {}
    pmid = (ids.get("pmid") or "").rstrip("/").rsplit("/", 1)[-1]
    src = ((w.get("primary_location") or {}).get("source") or {}).get("display_name") or ""
    oa = (w.get("best_oa_location") or {}).get("pdf_url") or ""
    return mkrec(openalex=(w.get("id") or "").rsplit("/", 1)[-1], doi=w.get("doi") or "", pmid=pmid,
                 title=w.get("title") or w.get("display_name") or "",
                 authors=[(a.get("author") or {}).get("display_name", "") for a in w.get("authorships") or []],
                 year=w.get("publication_year"), venue=src, abstract=oa_abstract(w.get("abstract_inverted_index")),
                 oa_pdf=oa)


def norm_devonthink(row):
    """row: dict(name, path, uuid, url, doi) from AppleScript."""
    name = re.sub(r"\.(pdf|txt|md|rtf|html?)$", "", row.get("name", ""), flags=re.I)
    r = mkrec(doi=row.get("doi", ""), title=name, year=year_of(name))
    r["devonthink_uuid"] = row.get("uuid", "")
    r["devonthink_url"] = row.get("url", "")
    r["path"] = row.get("path", "")
    return r


# ---------------------------------------------------------------- candidates

def make_key(rec, taken):
    first = (rec["authors"][0].split(",")[0] if rec["authors"] else "")
    if not first:
        stop = {"the", "a", "an", "on", "of", "and", "using", "towards", "toward", "for", "in"}
        words = re.findall(r"[^\W\d_]{3,}", rec["title"], flags=re.U)
        first = next((w for w in words if w.lower() not in stop), "Anon")  # DEVONthink hits have no authors
    first = unicodedata.normalize("NFKD", first)
    first = "".join(c for c in first if c.isalnum() and ord(c) < 128)
    first = (first[:1].upper() + first[1:]) or "Anon"
    base = f"{first}{rec['year'] or 'nd'}"
    key, i = base, 1
    while key in taken:
        key = base + chr(ord("a") + i) if i < 26 else f"{base}{i}"  # first stays bare; later ones get b, c, ...
        i += 1
    return key


def load_candidates(d):
    p = Path(d) / "candidates.jsonl"
    if not p.exists():
        return []
    out = []
    for n, line in enumerate(p.read_text(encoding="utf-8").splitlines(), 1):
        if line.strip():
            try:
                out.append(json.loads(line))
            except ValueError:
                raise LitError(f"{p}:{n}: invalid JSON")
    return out


def save_candidates(d, recs):
    p = Path(d) / "candidates.jsonl"
    tmp = p.with_suffix(".jsonl.tmp")
    tmp.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in recs), encoding="utf-8")
    tmp.replace(p)


def id_keys(r):
    ks = []
    if r.get("doi"):
        ks.append("doi:" + norm_doi(r["doi"]))
    for f in ("pmid", "arxiv", "s2", "openalex"):
        if r.get(f):
            ks.append(f"{f}:{r[f]}")
    return ks


def merge_into(old, new):
    for f in ("doi", "pmid", "arxiv", "s2", "openalex", "venue", "oa_pdf", "year", "title", "devonthink_uuid",
              "devonthink_url", "path"):
        if not old.get(f) and new.get(f):
            old[f] = new[f]
    if len(new.get("abstract", "")) > len(old.get("abstract", "")):
        old["abstract"] = new["abstract"]
    if len(new.get("authors", [])) > len(old.get("authors", [])):
        old["authors"] = new["authors"]
    for fb in new.get("found_by", []):
        if fb not in old["found_by"]:
            old["found_by"].append(fb)


def merge_records(existing, incoming):
    """Merge incoming records into existing (list, modified in place). Returns list of (record, is_new) per incoming.

    Match order: DOI, PMID, arXiv id, S2 id, OpenAlex id, then normalised title with a compatible year
    (equal, or missing on either side) unless both records carry different DOIs.
    """
    by_id = {}
    by_title = collections.defaultdict(list)

    def index(r):
        for k in id_keys(r):
            by_id.setdefault(k, r)
        t = norm_title(r.get("title"))
        if t and not any(x is r for x in by_title[t]):
            by_title[t].append(r)

    for r in existing:
        index(r)
    taken = {r["key"] for r in existing}
    results = []
    for n in incoming:
        hit = next((by_id[k] for k in id_keys(n) if k in by_id), None)
        if hit is None:
            hit = next((c for c in by_title.get(norm_title(n.get("title")), [])
                        if (not c.get("year") or not n.get("year") or c["year"] == n["year"])
                        and not (c.get("doi") and n.get("doi") and c["doi"] != n["doi"])), None)
        if hit is not None:
            merge_into(hit, n)
            rec, is_new = hit, False
        else:
            rec, is_new = n, True
            rec["key"] = make_key(rec, taken)
            taken.add(rec["key"])
            existing.append(rec)
        index(rec)
        results.append((rec, is_new))
    return results


def esc_cell(s):
    return str(s).replace("|", "\\|").replace("\n", " ").strip()


def append_log(d, source, query, filters, hits, new, note=""):
    p = Path(d) / "search_log.md"
    text = p.read_text(encoding="utf-8") if p.exists() else ""
    if "| # |" not in text:
        text = (text.rstrip("\n") + "\n\n" if text.strip() else "# Search log\n\n") + LOG_HEADER + "\n" + LOG_SEP + "\n"
    n = len(re.findall(r"^\|\s*\d+\s*\|", text, flags=re.M)) + 1
    row = f"| {n} | {datetime.date.today().isoformat()} | {esc_cell(source)} | {esc_cell(query)} | {esc_cell(filters)} | {hits} | {new} | {esc_cell(note)} |"
    p.write_text(text.rstrip("\n") + "\n" + row + "\n", encoding="utf-8")


def print_table(results):
    if not results:
        print("(no results)")
        return
    print(f"{'':1} {'key':<22} {'year':<5} {'title':<80} {'venue':<28} oa")
    for rec, is_new in results:
        print(f"{'+' if is_new else ' '} {rec['key']:<22} {str(rec['year'] or ''):<5} {rec['title'][:80]:<80} "
              f"{rec['venue'][:28]:<28} {'oa' if rec['oa_pdf'] else ''}")
    print(f"({sum(1 for _, n in results if n)} new of {len(results)}; + marks new)")


def ingest(d, source, query, filters, records, found_by, note=""):
    for r in records:
        r["found_by"] = [found_by]
    existing = load_candidates(d)
    results = merge_records(existing, records)
    save_candidates(d, existing)
    new = sum(1 for _, n in results if n)
    append_log(d, source, query, filters, len(records), new, note)
    print_table(results)
    return results


# ---------------------------------------------------------------- sources

def search_pubmed(query, maxn, since):
    key = os.environ.get("NCBI_API_KEY", "")
    pause = 0.12 if key else 0.4
    base = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/"
    p = {"db": "pubmed", "retmode": "json", "retmax": min(maxn, 500), "term": query, "api_key": key}
    if since:
        p.update(datetype="pdat", mindate=str(since), maxdate="3000")
    res = get_json(base + "esearch.fcgi?" + qs(p)).get("esearchresult", {})
    ids = res.get("idlist", [])
    records = []
    for i in range(0, len(ids), 100):
        chunk = ",".join(ids[i:i + 100])
        time.sleep(pause)
        summ = get_json(base + "esummary.fcgi?" + qs({"db": "pubmed", "retmode": "json", "id": chunk, "api_key": key}))
        time.sleep(pause)
        xml = http_get(base + "efetch.fcgi?" + qs({"db": "pubmed", "retmode": "xml", "rettype": "abstract", "id": chunk, "api_key": key}))
        records += norm_pubmed(summ, xml)
    return records, f"total {res.get('count', len(records))}"


def search_s2(query, maxn, since):
    hdrs = {"x-api-key": os.environ["S2_API_KEY"]} if os.environ.get("S2_API_KEY") else {}
    records, offset = [], 0
    while len(records) < maxn:
        limit = min(100, maxn - len(records))
        p = {"query": query, "limit": limit, "offset": offset, "fields": S2_FIELDS, "year": f"{since}-" if since else ""}
        js = get_json("https://api.semanticscholar.org/graph/v1/paper/search?" + qs(p), hdrs)
        data = js.get("data") or []
        records += [norm_s2(x) for x in data]
        offset += limit
        if len(data) < limit or "next" not in js:
            break
        time.sleep(1)
    return records[:maxn], f"total {js.get('total', len(records))}"


def arxiv_query(q, since):
    if not re.search(r"\b(all|ti|abs|au|cat|co|jr|id):", q):
        q = " AND ".join(f"all:{w}" for w in q.split())
    if since:
        q += f" AND submittedDate:[{since}01010000 TO 300012312359]"
    return q


def search_arxiv(query, maxn, since):
    p = {"search_query": arxiv_query(query, since), "max_results": min(maxn, 200), "sortBy": "relevance"}
    return norm_arxiv_feed(http_get("https://export.arxiv.org/api/query?" + qs(p))), ""


def openalex_params(extra):
    p = {"select": OA_SELECT, "api_key": os.environ.get("OPENALEX_API_KEY", "")}
    p.update(extra)
    return "https://api.openalex.org/works?" + qs(p)


def search_openalex(query, maxn, since):
    flt = f"from_publication_date:{since}-01-01" if since else ""
    js = get_json(openalex_params({"search": query, "per-page": min(maxn, 200), "filter": flt}))
    return [norm_openalex(w) for w in js.get("results", [])], f"total {(js.get('meta') or {}).get('count', '')}"


# ---------------------------------------------------------------- DEVONthink

def dt_disabled():
    return os.environ.get("LIT_DEVONTHINK", "").lower() in ("off", "0", "no", "false")


def osa(script, timeout=60):
    return subprocess.run(["osascript", "-"], input=script, text=True, capture_output=True, timeout=timeout)


def dt_reason(stderr):
    s = stderr or ""
    if "-1743" in s:
        return ("not authorised: grant the automation permission in System Settings > Privacy & Security > Automation "
                "(error -1743)")
    if "-1728" in s or "Can't get application" in s or "-10814" in s:
        return "DEVONthink is not installed (no application with id DNtp)"
    if "-600" in s or "isn't running" in s:
        return "DEVONthink is not running"
    return "AppleScript error: " + (s.strip().splitlines() or ["unknown"])[-1][:200]


def dt_status():
    """Return (ok, reason). Never raises."""
    if dt_disabled():
        return False, "disabled by LIT_DEVONTHINK=off"
    if sys.platform != "darwin":
        return False, "not macOS (DEVONthink needs macOS and osascript)"
    if not shutil.which("osascript"):
        return False, "osascript not found on PATH"
    if shutil.which("mdfind"):  # referring to an uninstalled app by id can raise a "where is it?" dialog
        found = subprocess.run(["mdfind", "kMDItemCFBundleIdentifier == 'com.devon-technologies.think*'"],
                               capture_output=True, text=True).stdout.strip()
        if not found:
            return False, "DEVONthink is not installed (Spotlight finds no com.devon-technologies.think app)"
    try:
        p = osa('return application id "DNtp" is running', 30)
        if p.returncode != 0:
            return False, dt_reason(p.stderr)
        if p.stdout.strip() != "true":
            return False, "DEVONthink is not running"
        p = osa('tell application id "DNtp" to return count of databases', 60)
    except subprocess.TimeoutExpired:
        return False, "timed out (a permission dialog may be waiting; answer it and retry)"
    except OSError as e:
        return False, f"could not run osascript: {e}"
    if p.returncode != 0:
        return False, dt_reason(p.stderr)
    return True, f"DEVONthink reachable, {p.stdout.strip()} database(s) open"


def as_quote(s):
    return s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", " ")


def dt_search(query, maxn=25):
    ok, why = dt_status()
    if not ok:
        raise LitError("DEVONthink unavailable: " + why, 2)
    script = f'''
set RS to ASCII character 30
set TB to ASCII character 9
set out to ""
tell application id "DNtp"
  set found to {{}}
  repeat with d in databases
    try
      set found to found & (search "{as_quote(query)}" in root of d)
    end try
  end repeat
  set n to count of found
  if n > 500 then set n to 500
  set cnt to 0
  repeat with i from 1 to n
    if cnt >= {int(maxn)} then exit repeat
    set r to item i of found
    try
      set p to path of r
      if p is not missing value and p is not "" then
        set dv to ""
        try
          set dv to (digital object identifier of r) as text
        end try
        set out to out & (name of r) & TB & p & TB & (uuid of r) & TB & (reference URL of r) & TB & dv & RS
        set cnt to cnt + 1
      end if
    end try
  end repeat
end tell
return out
'''
    try:
        p = osa(script, 120)
    except subprocess.TimeoutExpired:
        raise LitError("DEVONthink search timed out", 2)
    if p.returncode != 0:
        raise LitError("DEVONthink unavailable: " + dt_reason(p.stderr), 2)
    rows = []
    for rec in p.stdout.split("\x1e"):
        parts = rec.strip("\n").split("\t")
        if len(parts) >= 4 and parts[0]:
            rows.append(dict(name=parts[0], path=parts[1], uuid=parts[2], url=parts[3],
                             doi=norm_doi(parts[4]) if len(parts) > 4 and parts[4] != "missing value" else ""))
    return rows


def search_devonthink(query, maxn, since):
    return [norm_devonthink(r) for r in dt_search(query, maxn)], ""


SOURCES = {"pubmed": search_pubmed, "s2": search_s2, "arxiv": search_arxiv, "openalex": search_openalex,
           "devonthink": search_devonthink}


# ---------------------------------------------------------------- commands: init, search, cites, screen

def cmd_init(a):
    d = Path(a.dir)
    subs = {"{{question}}": a.question, "{{type}}": a.type, "{{date}}": datetime.date.today().isoformat()}
    files = {}
    for name in ("question.md", "search_log.md", "ledger.md", "synthesis.md", "to_fetch.md"):
        src = TEMPLATES / name
        if not src.exists():
            raise LitError(f"template missing: {src}")
        text = src.read_text(encoding="utf-8")
        for k, v in subs.items():
            text = text.replace(k, v)
        files[d / name] = text
    files[d / "candidates.jsonl"] = ""
    files[d / "verify" / ".gitkeep"] = ""
    clash = [str(p) for p in files if p.exists()]
    if clash:
        raise LitError("refusing to overwrite existing files:\n  " + "\n  ".join(clash))
    for p, text in files.items():
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text, encoding="utf-8")
    print(f"created {d} ({len(files)} files); fill in question.md before searching")
    return 0


def cmd_search(a):
    d = Path(a.dir)
    if not d.is_dir():
        raise LitError(f"{d} is not a folder; run `lit.py init` first")
    maxn = max(1, a.max)
    records, note = SOURCES[a.source](a.query, maxn, a.since)
    if a.source == "devonthink" and a.since:
        note = "since ignored for devonthink"
    filters = f"max={maxn}" + (f"; since={a.since}" if a.since else "")
    ingest(d, a.source, a.query, filters, records, a.source, note)
    return 0


def s2_paper_id(r):
    if r.get("s2"):
        return r["s2"]
    for f, pre in (("doi", "DOI:"), ("arxiv", "ARXIV:"), ("pmid", "PMID:")):
        if r.get(f):
            return pre + r[f]
    return ""


def cites_s2(r, direction, maxn):
    pid = s2_paper_id(r)
    if not pid:
        raise LitError("no identifier for Semantic Scholar")
    hdrs = {"x-api-key": os.environ["S2_API_KEY"]} if os.environ.get("S2_API_KEY") else {}
    ep, field = ("references", "citedPaper") if direction == "refs" else ("citations", "citingPaper")
    js = get_json(f"https://api.semanticscholar.org/graph/v1/paper/{urllib.parse.quote(pid, safe=':')}/{ep}?"
                  + qs({"fields": S2_FIELDS, "limit": min(maxn, 1000)}), hdrs)
    out = [norm_s2(x[field]) for x in js.get("data") or [] if x.get(field) and x[field].get("title")]
    return out[:maxn]


def cites_openalex(r, direction, maxn):
    if r.get("openalex"):
        url = f"https://api.openalex.org/works/{r['openalex']}"
    elif r.get("doi"):
        url = "https://api.openalex.org/works/doi:" + urllib.parse.quote(r["doi"], safe="/:()")
    else:
        js = get_json(openalex_params({"search": r["title"], "per-page": 1}))
        if not js.get("results"):
            raise LitError("paper not found in OpenAlex")
        url = f"https://api.openalex.org/works/{js['results'][0]['id'].rsplit('/', 1)[-1]}"
    work = get_json(url + "?" + qs({"select": "id,referenced_works", "api_key": os.environ.get("OPENALEX_API_KEY", "")}))
    wid = work["id"].rsplit("/", 1)[-1]
    if direction == "citedby":
        js = get_json(openalex_params({"filter": f"cites:{wid}", "per-page": min(maxn, 200)}))
        return [norm_openalex(w) for w in js.get("results", [])][:maxn]
    ids = [x.rsplit("/", 1)[-1] for x in work.get("referenced_works", [])][:maxn]
    out = []
    for i in range(0, len(ids), 50):
        js = get_json(openalex_params({"filter": "openalex:" + "|".join(ids[i:i + 50]), "per-page": 50}))
        out += [norm_openalex(w) for w in js.get("results", [])]
    return out


def find_candidate(d, key):
    for r in load_candidates(d):
        if r["key"] == key:
            return r
    raise LitError(f"no candidate with key {key!r} in {Path(d) / 'candidates.jsonl'}")


def cmd_cites(a):
    r = find_candidate(a.dir, a.key)
    direction = "refs" if a.refs else "citedby"
    note, via = "", "s2"
    try:
        records = cites_s2(r, direction, a.max)
        if not records:
            note = "s2 returned nothing (often publisher-elided); used openalex"
    except LitError as e:
        records, note = [], f"s2 failed ({e}); used openalex"
    if not records:
        via = "openalex"
        records = cites_openalex(r, direction, a.max)
    ingest(a.dir, f"{via}:{direction}", f"{direction}:{a.key}", f"max={a.max}", records, f"{direction}:{a.key}", note)
    return 0


def cmd_screen(a):
    recs = load_candidates(a.dir)
    for r in recs:
        if r["key"] == a.key:
            r["status"], r["reason"] = a.status, a.reason
            save_candidates(a.dir, recs)
            print(f"{a.key}: {a.status} - {a.reason}")
            return 0
    raise LitError(f"no candidate with key {a.key!r}")


# ---------------------------------------------------------------- full text: fetch, text

def project_root(d):
    p = Path(d).resolve()
    for q in [p, *p.parents]:
        if (q / ".git").exists():
            return q
    return p.parents[2] if len(p.parents) > 2 else p


def words_of(title):
    return [w for w in norm_title(title).split() if len(w) >= 4]


def name_matches(rec, filename):
    stem = norm_title(Path(filename).stem)
    if rec["key"].lower() in filename.lower():
        return True
    if rec.get("doi") and re.sub(r"[^a-z0-9]+", "", rec["doi"]) in re.sub(r"[^a-z0-9]+", "", filename.lower()):
        return True
    ws = words_of(rec["title"])
    return len(ws) >= 3 and sum(w in stem.split() for w in ws) >= max(3, int(0.6 * len(ws)))


def pdftotext_page1_has(path, needle):
    exe = shutil.which("pdftotext")
    if not exe:
        return False
    p = subprocess.run([exe, "-f", "1", "-l", "1", str(path), "-"], capture_output=True, text=True, errors="replace")
    return needle.lower() in p.stdout.lower()


def dt_accept(rec, row, by_doi):
    if not row["path"].lower().endswith(".pdf") or not Path(row["path"]).exists():
        return False
    if rec.get("doi") and row.get("doi") == rec["doi"]:
        return True
    sim = difflib.SequenceMatcher(None, norm_title(Path(row["name"]).stem), norm_title(rec["title"])).ratio()
    if sim >= 0.5:
        return True
    return by_doi and rec.get("doi") and pdftotext_page1_has(row["path"], rec["doi"])


def fetch_devonthink(rec):
    tries = ([("doi", rec["doi"])] if rec.get("doi") else []) + ([("title", rec["title"])] if rec.get("title") else [])
    for how, q in tries:
        for row in dt_search(q, 15):
            if dt_accept(rec, row, how == "doi"):
                return row["path"], f"devonthink ({how})"
    return None


def fetch_papers_dir(rec, papers):
    if papers and papers.is_dir():
        for f in sorted(papers.rglob("*.pdf")):
            if name_matches(rec, f.name):
                return str(f), "papers folder"
    return None


def oa_urls(rec):
    urls = [rec.get("oa_pdf")]
    if rec.get("arxiv"):
        urls.append(f"https://arxiv.org/pdf/{rec['arxiv']}")
    return [u for u in urls if u]


def openalex_pdf_urls(rec):
    key = os.environ.get("OPENALEX_API_KEY", "")
    if rec.get("openalex"):
        url = f"https://api.openalex.org/works/{rec['openalex']}"
    elif rec.get("doi"):
        url = "https://api.openalex.org/works/doi:" + urllib.parse.quote(rec["doi"], safe="/:()")
    else:
        return []
    w = get_json(url + "?" + qs({"select": "best_oa_location,locations", "api_key": key}))
    locs = [w.get("best_oa_location")] + (w.get("locations") or [])
    return list(dict.fromkeys(l["pdf_url"] for l in locs if l and l.get("pdf_url")))


def download_pdf(urls, dest):
    errors = []
    for u in urls:
        try:
            data = http_get(u, {"Accept": "application/pdf"}, timeout=60)
        except LitError as e:
            errors.append(f"{u}: {e}")
            continue
        if data[:5] == b"%PDF-":
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
            return True, errors
        errors.append(f"{u}: not a PDF (landing page?)")
    return False, errors


def add_to_fetch(d, rec, why):
    p = Path(d) / "to_fetch.md"
    text = p.read_text(encoding="utf-8") if p.exists() else ""
    if "| key |" not in text:
        text = (text.rstrip("\n") + "\n\n" if text.strip() else "# Papers the owner must fetch\n\n") + FETCH_HEADER + "\n" + FETCH_SEP + "\n"
    if re.search(rf"^\|\s*{re.escape(rec['key'])}\s*\|", text, flags=re.M):
        return False
    text = text.rstrip("\n") + f"\n| {rec['key']} | {esc_cell(rec['title'])} | {rec.get('doi', '')} | {esc_cell(why)} |\n"
    p.write_text(text, encoding="utf-8")
    return True


def cmd_fetch(a):
    rec = find_candidate(a.dir, a.key)
    papers = Path(a.papers).expanduser() if a.papers else project_root(a.dir) / "references" / "papers"
    if rec.get("path") and Path(rec["path"]).exists():
        print(f"{rec['path']}\nroute: devonthink (candidate record)")
        return 0
    notes = []
    if dt_disabled():
        notes.append("devonthink: disabled")
    else:
        try:
            hit = fetch_devonthink(rec)
            if hit:
                print(f"{hit[0]}\nroute: {hit[1]}")
                return 0
            notes.append("devonthink: no matching PDF")
        except LitError as e:
            notes.append(f"devonthink: skipped ({e})")
    hit = fetch_papers_dir(rec, papers)
    if hit:
        print(f"{hit[0]}\nroute: {hit[1]}")
        return 0
    urls = oa_urls(rec)
    try:
        urls += [u for u in openalex_pdf_urls(rec) if u not in urls]
    except LitError as e:
        notes.append(f"openalex lookup failed ({e})")
    ok, errs = download_pdf(urls, papers / f"{rec['key']}.pdf")
    notes += errs
    if ok:
        print(f"{papers / (rec['key'] + '.pdf')}\nroute: open access download")
        return 0
    why = a.why or "full text needed for verification; no open-access copy found"
    added = add_to_fetch(a.dir, rec, why)
    for n in notes:
        print(n, file=sys.stderr)
    print(f"not found: {rec['key']} {'added to' if added else 'already in'} {Path(a.dir) / 'to_fetch.md'}; ask the owner", file=sys.stderr)
    return 3


def need_pdftotext():
    exe = shutil.which("pdftotext")
    if not exe:
        raise LitError("pdftotext not found on PATH (install poppler, e.g. `brew install poppler`); "
                       "needed to extract text from PDFs", 2)
    return exe


MARK = re.compile(r"^=== page (\d+) ===$", re.M)


def cache_path(pdf, raw):
    pdf = Path(pdf).resolve()
    suffix = ".raw.txt" if raw else ".txt"
    local = pdf.with_suffix(suffix)
    if ".dtBase2" not in str(pdf) and os.access(pdf.parent, os.W_OK):
        return local
    h = hashlib.sha1(str(pdf).encode()).hexdigest()[:12]
    return Path.home() / ".cache" / "literature-research" / f"{h}-{pdf.stem}{suffix}"


def split_marked(text):
    ms = list(MARK.finditer(text))
    return [text[m.end() + 1:(ms[i + 1].start() if i + 1 < len(ms) else len(text))].rstrip("\n") for i, m in enumerate(ms)]


def extract_pdf(pdf, raw=False):
    """Return (cache path, pages)."""
    pdf = Path(pdf)
    if not pdf.exists():
        raise LitError(f"no such file: {pdf}")
    cache = cache_path(pdf, raw)
    if cache.exists() and cache.stat().st_mtime >= pdf.stat().st_mtime:
        return cache, split_marked(cache.read_text(encoding="utf-8"))
    exe = need_pdftotext()
    cmd = [exe] + ([] if raw else ["-layout"]) + [str(pdf), "-"]
    p = subprocess.run(cmd, capture_output=True)
    if p.returncode != 0:
        raise LitError(f"pdftotext failed on {pdf}: {p.stderr.decode(errors='replace').strip()}")
    pages = p.stdout.decode("utf-8", errors="replace").split("\f")
    if pages and not pages[-1].strip():
        pages.pop()
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_text("".join(f"=== page {i} ===\n{t.rstrip()}\n" for i, t in enumerate(pages, 1)), encoding="utf-8")
    return cache, pages


def load_pages(path, raw=False):
    p = Path(path)
    if p.suffix.lower() == ".pdf":
        pages = extract_pdf(p, raw)[1]
    else:
        if not p.exists():
            raise LitError(f"no such file: {p}")
        text = p.read_text(encoding="utf-8", errors="replace")
        pages = split_marked(text) if MARK.search(text) else text.split("\f")
    return [unicodedata.normalize("NFC", t) for t in pages]


def cmd_text(a):
    p = Path(a.path)
    if p.suffix.lower() != ".pdf":
        raise LitError("text expects a PDF")
    cache, pages = extract_pdf(p, a.raw)
    print(cache)
    print(f"({len(pages)} pages)", file=sys.stderr)
    return 0


# ---------------------------------------------------------------- quote

DASHES = set("-\u2010\u2011\u2012\u2013\u2014\u2015\u2212\u00ad")
QUOTE_MAP = {"\u2018": "'", "\u2019": "'", "\u201a": "'", "\u2032": "'", "`": "'", "\u201c": '"', "\u201d": '"',
             "\u201e": '"', "\u2033": '"'}


def canon(text):
    """Canonical form for matching, plus a map from canonical index to index in `text`.

    NFKC (ligatures), lower case, straight quotes, whitespace collapsed, dashes dropped, and a dash at the end of a
    line joined with the next line (hyphenation).
    """
    out, idx = [], []
    i, n = 0, len(text)
    while i < n:
        ch = text[i]
        if ch in DASHES:
            j = i + 1
            while j < n and text[j] in " \t\r":
                j += 1
            if j < n and text[j] in "\n\f" and out and out[-1] != " ":
                while j < n and text[j].isspace():
                    j += 1
                i = j
            else:
                i += 1
            continue
        if ch.isspace():
            if out and out[-1] != " ":
                out.append(" ")
                idx.append(i)
            i += 1
            continue
        for c in unicodedata.normalize("NFKC", ch):
            out.append(QUOTE_MAP.get(c, c.lower()))
            idx.append(i)
        i += 1
    while out and out[-1] == " ":
        out.pop()
        idx.pop()
    return "".join(out), idx


def match_in(C, q):
    """Best fuzzy match of canonical q in canonical C -> (score, start, end) in C coordinates."""
    m = len(q)
    pos = C.find(q)
    if pos >= 0:
        return 1.0, pos, pos + m
    k = min(8, m)
    votes = collections.Counter()
    for off in range(0, m - k + 1, 4):
        g, p = q[off:off + k], C.find(q[off:off + k])
        seen = 0
        while p >= 0 and seen < 200:
            votes[p - off] += 1
            p = C.find(g, p + 1)
            seen += 1
    best = (0.0, 0, 0)
    chosen = []
    for s, _ in votes.most_common(40):
        if any(abs(s - c) < 6 for c in chosen):
            continue
        chosen.append(s)
        if len(chosen) > 6:
            break
        w0 = max(0, s - 8)
        window = C[w0:s + m + int(m * 0.15) + 8]
        blocks = [b for b in difflib.SequenceMatcher(None, q, window, autojunk=False).get_matching_blocks() if b.size]
        if not blocks:
            continue
        matched = sum(b.size for b in blocks)
        first, last = blocks[0].b, blocks[-1].b + blocks[-1].size
        score = matched / max(m, last - first)
        if score > best[0]:
            best = (score, w0 + first, w0 + last)
    return best


def locate_quote(pages, quote, page=None):
    """Return dict(page, score, text, a, b, lines) for the best match; page limits the search (1-based)."""
    q, _ = canon(unicodedata.normalize("NFC", quote))
    if not q:
        raise LitError("empty quote")
    if page:
        if not 1 <= page <= len(pages):
            raise LitError(f"page {page} out of range (document has {len(pages)} pages)")
        first_page, sel = page, pages[page - 1:page]
    else:
        first_page, sel = 1, pages
    full = "\n".join(sel)  # same length as a form feed, so lines (context) break at pages
    starts = [0]
    for t in sel[:-1]:
        starts.append(starts[-1] + len(t) + 1)
    C, idx = canon(full)
    score, s, e = match_in(C, q) if C else (0.0, 0, 0)
    if score == 0.0 or e <= s:
        return dict(page=None, score=0.0, passage="", context=[], end_page=None)
    nums = lambda t: re.findall(r"\d+(?:[.,]\d+)?", t)
    differ = nums(q) != nums(C[s:e])
    if differ and score >= 0.9:  # one changed digit barely moves the text score but changes the value
        score = 0.89
    a, b = idx[s], idx[e - 1] + 1
    pg = bisect.bisect_right(starts, a) - 1
    end_pg = bisect.bisect_right(starts, b - 1) - 1
    lines, off = [], 0
    for ln in full.split("\n"):
        lines.append((off, off + len(ln), ln))
        off += len(ln) + 1
    first = next(i for i, (x, y, _) in enumerate(lines) if x <= a <= y)
    last = next(i for i, (x, y, _) in enumerate(lines) if x <= b - 1 <= y or x > b - 1)
    shown = []
    for i in range(max(0, first - 1), min(len(lines), last + 2)):
        shown.append((">" if first <= i <= last else " ") + " " + lines[i][2].rstrip())
    return dict(page=first_page + pg, score=round(score, 3), end_page=first_page + end_pg, context=shown,
                numbers=(nums(q), nums(C[s:e])) if differ else None)


def cmd_quote(a):
    pages = load_pages(a.path)
    res = locate_quote(pages, a.quote, a.page)
    mode = "layout"
    if res["score"] < 0.9 and Path(a.path).suffix.lower() == ".pdf":  # two-column papers: retry in reading order
        try:
            alt = locate_quote(load_pages(a.path, raw=True), a.quote, a.page)
        except LitError:
            alt = None
        if alt and alt["score"] > res["score"]:
            res, mode = alt, "reading-order"
    if not res["page"]:
        print(f"no match (score 0.00) for the quote in {a.path}")
        return 1
    span = f", continues on page {res['end_page']}" if res["end_page"] != res["page"] else ""
    print(f"page {res['page']} | score {res['score']:.2f} | {mode}{span}")
    if res.get("numbers"):
        print(f"numbers differ: quote has {res['numbers'][0]}, text has {res['numbers'][1]}")
    print("\n".join(res["context"]))
    return 0 if res["score"] >= 0.9 else 1


# ---------------------------------------------------------------- check, bib

def split_row(line):
    line = line.strip()
    if line.startswith("|"):
        line = line[1:]
    if line.endswith("|") and not line.endswith("\\|"):
        line = line[:-1]
    return [c.replace("\\|", "|").strip() for c in re.split(r"(?<!\\)\|", line)]


def parse_table(path, first_col):
    """Rows of the first markdown table whose header starts with `first_col`, as dicts."""
    p = Path(path)
    if not p.exists():
        return None
    header, rows = None, []
    for line in p.read_text(encoding="utf-8").splitlines():
        if not line.strip().startswith("|"):
            continue
        cells = split_row(line)
        if header is None:
            if cells and cells[0].lower() == first_col:
                header = [c.lower() for c in cells]
            continue
        if all(re.fullmatch(r":?-{2,}:?", c) or not c for c in cells):
            continue
        rows.append(dict(zip(header, cells + [""] * (len(header) - len(cells)))))
    return rows


CITE = re.compile(r"\[(L\d+(?:\s*[,;]\s*L\d+)*)\]")


def lint(d):
    """Return (errors, warnings) for the folder."""
    d = Path(d)
    errors, warns = [], []
    rows = parse_table(d / "ledger.md", "id")
    if rows is None:
        return [f"{d / 'ledger.md'} is missing"], []
    try:
        cands = load_candidates(d)
    except LitError as e:
        return [str(e)], []
    by_key = {}
    for c in cands:
        if c["key"] in by_key:
            errors.append(f"candidates.jsonl: duplicate key {c['key']}")
        by_key[c["key"]] = c
    ids = {}
    used = set()
    for r in rows:
        rid = r.get("id", "")
        if not re.fullmatch(r"L\d+", rid):
            errors.append(f"ledger row {rid or '?'}: id must look like L1")
            continue
        if rid in ids:
            errors.append(f"{rid}: duplicate id")
        ids[rid] = r
        for col in ("claim", "conditions", "source", "locator", "evidence", "verified"):
            if not r.get(col):
                errors.append(f"{rid}: {col} is empty")
        if r.get("evidence") and r["evidence"] not in EVIDENCE:
            errors.append(f"{rid}: evidence {r['evidence']!r} not in {'|'.join(EVIDENCE)}")
        if r.get("verified") and r["verified"] not in VERIFIED:
            errors.append(f"{rid}: verified {r['verified']!r} not in {'|'.join(VERIFIED)}")
        if not r.get("quote") and r.get("evidence") != "inferred":
            errors.append(f"{rid}: quote is empty (required unless evidence is inferred)")
        src = r.get("source", "").strip("` []")
        if src:
            c = by_key.get(src)
            if c is None:
                errors.append(f"{rid}: source {src!r} is not a key in candidates.jsonl")
            elif c.get("status") != "in":
                errors.append(f"{rid}: source {src} has status {c.get('status')!r}, not 'in' (screen it first)")
            else:
                used.add(src)
    syn = d / "synthesis.md"
    if syn.exists():
        cited = {}
        for m in CITE.finditer(syn.read_text(encoding="utf-8")):
            for i in re.findall(r"L\d+", m.group(1)):
                cited[i] = True
        for i in cited:
            if i not in ids:
                errors.append(f"synthesis.md cites [{i}] which is not in the ledger")
            elif ids[i].get("verified") in ("unchecked", "not-found"):
                errors.append(f"synthesis.md cites {i} which is {ids[i]['verified']}")
            elif ids[i].get("verified") == "abstract-only":
                warns.append(f"synthesis.md cites {i} which is abstract-only (full text not read)")
            elif ids[i].get("verified") == "indirect":
                warns.append(f"synthesis.md cites {i} which is indirect (the source cites another paper for it)")
    else:
        warns.append("synthesis.md not found; citations not checked")
    for c in cands:
        if c.get("status") == "in" and c["key"] not in used:
            warns.append(f"candidate {c['key']} is 'in' but no ledger row uses it")
    return errors, warns


def cmd_check(a):
    errors, warns = lint(a.dir)
    for e in errors:
        print("ERROR", e)
    for w in warns:
        print("WARN ", w)
    print(f"lit check: {len(errors)} problem(s), {len(warns)} warning(s)")
    return 1 if errors else 0


def bib_escape(s):
    s = re.sub(r"[{}]", "", s)
    return re.sub(r"([&%#_$])", r"\\\1", s)


def bib_entry(r):
    kind = "article" if r.get("venue") and r["venue"] != "arXiv" else "misc"
    f = []
    if r.get("authors"):
        f.append(("author", " and ".join(bib_escape(x) for x in r["authors"])))
    f.append(("title", "{" + bib_escape(r["title"]) + "}"))
    if kind == "article":
        f.append(("journal", bib_escape(r["venue"])))
    if r.get("year"):
        f.append(("year", str(r["year"])))
    if r.get("doi"):
        f.append(("doi", r["doi"]))
    if r.get("arxiv"):
        f += [("eprint", r["arxiv"]), ("archiveprefix", "arXiv")]
    body = ",\n".join(f"  {k} = {{{v}}}" for k, v in f)
    return f"@{kind}{{{r['key']},\n{body}\n}}\n"


def cmd_bib(a):
    d = Path(a.dir)
    rows = parse_table(d / "ledger.md", "id")
    if not rows:
        raise LitError("ledger.md has no rows; nothing to write")
    by_key = {c["key"]: c for c in load_candidates(d)}
    keys = list(dict.fromkeys(r.get("source", "").strip("` []") for r in rows if r.get("source")))
    entries, missing = [], []
    for k in keys:
        (entries if k in by_key else missing).append(bib_entry(by_key[k]) if k in by_key else k)
    (d / "sources.bib").write_text("% generated by lit.py bib; do not edit\n\n" + "\n".join(entries), encoding="utf-8")
    print(f"wrote {d / 'sources.bib'} ({len(entries)} entries)")
    if missing:
        print("not in candidates.jsonl, skipped: " + ", ".join(missing), file=sys.stderr)
        return 1
    return 0


def cmd_dt_status(a):
    ok, why = dt_status()
    print(("OK: " if ok else "unavailable: ") + why)
    return 0 if ok else 2


# ---------------------------------------------------------------- cli

def build_parser():
    ap = argparse.ArgumentParser(prog="lit.py", description=__doc__.split("\n\n")[0],
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = ap.add_subparsers(dest="cmd", required=True)

    s = sp.add_parser("init", help="create a literature folder from the templates")
    s.add_argument("dir")
    s.add_argument("--question", required=True)
    s.add_argument("--type", default="value", choices=QUESTION_TYPES)
    s.set_defaults(fn=cmd_init)

    s = sp.add_parser("search", help="search a source, merge into candidates.jsonl, log it")
    s.add_argument("dir")
    s.add_argument("source", choices=list(SOURCES))
    s.add_argument("query")
    s.add_argument("--max", type=int, default=25)
    s.add_argument("--since", type=int, metavar="YEAR")
    s.set_defaults(fn=cmd_search)

    s = sp.add_parser("cites", help="citation chasing (Semantic Scholar, fallback OpenAlex)")
    s.add_argument("dir")
    s.add_argument("key")
    g = s.add_mutually_exclusive_group(required=True)
    g.add_argument("--refs", action="store_true", help="papers this one cites")
    g.add_argument("--citedby", action="store_true", help="papers citing this one")
    s.add_argument("--max", type=int, default=50)
    s.set_defaults(fn=cmd_cites)

    s = sp.add_parser("screen", help="mark a candidate in or out")
    s.add_argument("dir")
    s.add_argument("key")
    s.add_argument("status", choices=("in", "out"))
    s.add_argument("reason")
    s.set_defaults(fn=cmd_screen)

    s = sp.add_parser("fetch", help="find or download the full text (DEVONthink, papers folder, open access)")
    s.add_argument("dir")
    s.add_argument("key")
    s.add_argument("--papers", help="folder of PDFs (default <repo>/references/papers)")
    s.add_argument("--why", help="reason written to to_fetch.md when the paper cannot be found")
    s.set_defaults(fn=cmd_fetch)

    s = sp.add_parser("text", help="extract text from a PDF with page markers (cached next to it)")
    s.add_argument("path")
    s.add_argument("--raw", action="store_true", help="reading order instead of -layout")
    s.set_defaults(fn=cmd_text)

    s = sp.add_parser("quote", help="fuzzy-find a quote in a PDF/text; exit 0 if score >= 0.9")
    s.add_argument("path")
    s.add_argument("quote")
    s.add_argument("--page", type=int)
    s.set_defaults(fn=cmd_quote)

    s = sp.add_parser("check", help="lint ledger, candidates and synthesis")
    s.add_argument("dir")
    s.set_defaults(fn=cmd_check)

    s = sp.add_parser("bib", help="write sources.bib for the ledger's sources")
    s.add_argument("dir")
    s.set_defaults(fn=cmd_bib)

    s = sp.add_parser("devonthink-status", help="is DEVONthink reachable?")
    s.set_defaults(fn=cmd_dt_status)
    return ap


def main(argv=None):
    args = build_parser().parse_args(argv)
    try:
        return args.fn(args)
    except LitError as e:
        print(f"lit.py: {e}", file=sys.stderr)
        return e.code
    except BrokenPipeError:
        return 0


if __name__ == "__main__":
    sys.exit(main())
