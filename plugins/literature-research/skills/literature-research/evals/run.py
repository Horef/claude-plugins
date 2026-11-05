"""Scripted evals for literature-research (lit.py): offline by default, under 30 s.

    python evals/run.py          # offline: recorded fixtures, no network, DEVONthink off
    python evals/run.py --live   # additionally one real query per web source (network failures are skipped and reported)

Exit 0 = all ran tests passed (skipped ones are listed, never counted as passes), 1 = a failure.
Fixtures in evals/fixtures/ are recorded API responses (s2_search.json is hand-written to the documented schema, see its
_note), a text paper with form feeds, and a good and a bad literature folder. The tiny PDF is generated here.
"""
import contextlib
import importlib.util
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import traceback
import urllib.error
from pathlib import Path

HERE = Path(__file__).resolve().parent
FIX = HERE / "fixtures"
LIT_PATH = HERE.parent / "scripts" / "lit.py"
spec = importlib.util.spec_from_file_location("lit", LIT_PATH)
lit = importlib.util.module_from_spec(spec)
sys.modules["lit"] = lit
spec.loader.exec_module(lit)

os.environ["LIT_DEVONTHINK"] = "off"
for k in ("NCBI_API_KEY", "S2_API_KEY", "OPENALEX_API_KEY"):
    os.environ.pop(k, None)

TESTS, RESULTS = [], []


class Skip(Exception):
    pass


def test(fn):
    TESTS.append(fn)
    return fn


def run(*argv):
    out, err = io.StringIO(), io.StringIO()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
        code = lit.main([str(a) for a in argv])
    return code, out.getvalue(), err.getvalue()


def fx(name):
    return (FIX / name).read_bytes()


def make_pdf(pages):
    """Minimal PDF, one page per list of text lines (Helvetica, Latin-1)."""
    objs = {1: b"<< /Type /Catalog /Pages 2 0 R >>", 3: b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"}
    kids = []
    for i, lines in enumerate(pages):
        pg, ct = 4 + 2 * i, 5 + 2 * i
        kids.append(f"{pg} 0 R")
        esc = lambda s: s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        stream = "BT /F1 11 Tf 72 720 Td 14 TL " + " T* ".join(f"({esc(l)}) Tj" for l in lines) + " ET"
        objs[pg] = (f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents {ct} 0 R "
                    f"/Resources << /Font << /F1 3 0 R >> >> >>").encode()
        objs[ct] = f"<< /Length {len(stream)} >>\nstream\n{stream}\nendstream".encode("latin-1")
    objs[2] = f"<< /Type /Pages /Kids [{' '.join(kids)}] /Count {len(pages)} >>".encode()
    out = b"%PDF-1.4\n"
    offs = {}
    for n in sorted(objs):
        offs[n] = len(out)
        out += f"{n} 0 obj\n".encode() + objs[n] + b"\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n".encode()
    for n in sorted(objs):
        out += f"{offs[n]:010d} 00000 n \n".encode()
    out += f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    return out


PDF_PAGES = [
    ["Page one of the test paper.",
     "We argue that the classification of simple and complex cells is not a dichot-",
     "omy but a continuum, as shown by the modulation ratio distribution."],
    ["Page two begins here.",
     "The distribution of modulation ratios is bimodal, with a clear gap between",
     "the two groups of cells in cat primary visual cortex."],
]


class FakeNet:
    """Replaces lit.http_get; serves fixtures by URL and records the requests."""

    def __init__(self, fail=(), html=()):
        self.urls, self.fail, self.html = [], fail, html

    def __call__(self, url, headers=None, timeout=30, retries=3):
        self.urls.append(url)
        if any(f in url for f in self.fail):
            raise lit.NetError("HTTP 429 (simulated)")
        if any(h in url for h in self.html):
            return b"<html>landing page</html>"
        if "esearch" in url:
            return fx("pubmed_esearch.json")
        if "esummary" in url:
            return fx("pubmed_esummary.json")
        if "efetch" in url:
            return fx("pubmed_efetch.xml")
        if "semanticscholar" in url and "/references" in url:
            return fx("s2_refs.json")
        if "semanticscholar" in url:
            return fx("s2_search.json")
        if "export.arxiv.org" in url:
            return fx("arxiv_search.xml")
        if "openalex.org/works/" in url:
            return fx("openalex_work.json")
        if "openalex.org/works?" in url:
            return fx("openalex_works.json")
        if url.endswith((".pdf", "/pdf")) or "/pdf/" in url:
            return make_pdf(PDF_PAGES)
        raise lit.NetError(f"unexpected URL in test: {url}")


@contextlib.contextmanager
def patched(fake):
    old = lit.http_get
    lit.http_get = fake
    try:
        yield fake
    finally:
        lit.http_get = old


def tmpdir():
    return Path(tempfile.mkdtemp(prefix="littest-"))


def new_folder():
    d = tmpdir() / "topic"
    assert run("init", d, "--question", "What is the modulation ratio gap?", "--type", "value")[0] == 0
    return d


def table_rows(path):
    return [lit.split_row(l) for l in Path(path).read_text().splitlines() if l.startswith("|")][2:]


def check(cond, msg):
    if not cond:
        raise AssertionError(msg)


# ---------------------------------------------------------------- normalisation

@test
def norm_pubmed():
    recs = lit.norm_pubmed(fx("pubmed_esummary.json"), fx("pubmed_efetch.xml"))
    by = {r["pmid"]: r for r in recs}
    m = by["11934453"]
    check(m["doi"] == "10.1016/s0042-6989(02)00025-1", m["doi"])
    check(m["year"] == 2002 and m["venue"].lower() == "vision research", (m["year"], m["venue"]))
    check(m["authors"][:2] == ["Mechler, F", "Ringach, DL"], m["authors"])
    check(len(m["abstract"]) > 100, "abstract from efetch missing")
    check(by["15338009"]["doi"] == "10.1038/nn1310", "second record doi")


@test
def norm_s2():
    items = json.loads(fx("s2_search.json"))["data"]
    r = lit.norm_s2(items[0])
    check(r["doi"] == "10.1016/s0042-6989(02)00025-1" and r["pmid"] == "11934453", r["doi"])
    check(r["authors"][0] == "Mechler, F." and r["oa_pdf"].endswith("/pdf"), (r["authors"], r["oa_pdf"]))
    check(lit.norm_s2(items[1])["doi"] == "" and lit.norm_s2(items[1])["authors"][0] == "Priebe, Nicholas J.", "no-doi record")
    check(lit.norm_s2(items[2])["arxiv"] == "2012.09027", "arxiv id")


@test
def norm_arxiv():
    recs = lit.norm_arxiv_feed(fx("arxiv_search.xml"))
    check(len(recs) == 3, len(recs))
    check(recs[0]["arxiv"] == "2010.00743" and recs[0]["venue"] == "arXiv", (recs[0]["arxiv"], recs[0]["venue"]))
    check(recs[2]["doi"] == "10.1162/neco_a_00163", recs[2]["doi"])
    check(recs[0]["oa_pdf"].startswith("http") and recs[0]["year"] == 2020, (recs[0]["oa_pdf"], recs[0]["year"]))
    check(all(" " in r["title"] and "\n" not in r["title"] for r in recs), "titles whitespace-normalised")


@test
def norm_openalex():
    recs = [lit.norm_openalex(w) for w in json.loads(fx("openalex_works.json"))["results"]]
    r = recs[0]
    check(r["doi"] == "10.1016/s0042-6989(02)00025-1" and r["openalex"].startswith("W"), (r["doi"], r["openalex"]))
    check(r["year"] == 2002 and r["venue"] == "Vision Research", (r["year"], r["venue"]))
    check(r["oa_pdf"].endswith("/pdf"), r["oa_pdf"])
    check(recs[0]["abstract"] == "", "no abstract in the index gives an empty string")
    check(len(recs[1]["abstract"]) > 50 and "  " not in recs[1]["abstract"], "abstract rebuilt from inverted index")


@test
def norm_devonthink_row():
    r = lit.norm_devonthink({"name": "Mechler 2002 On the classification.pdf", "path": "/x/y.pdf", "uuid": "U1",
                             "url": "x-devonthink-item://U1", "doi": "10.1/x"})
    check(r["devonthink_uuid"] == "U1" and r["year"] == 2002 and r["title"].endswith("classification"), r)


# ---------------------------------------------------------------- search, dedupe, log

@test
def search_dedupe_and_log():
    d = new_folder()
    with patched(FakeNet()) as net:
        c1, out1, _ = run("search", d, "pubmed", "simple complex cells", "--max", 5, "--since", 2000)
        c2, out2, _ = run("search", d, "s2", "simple complex cells")
        c3, _, _ = run("search", d, "openalex", "simple complex cells")
        c4, _, _ = run("search", d, "arxiv", "simple complex cells")
    check((c1, c2, c3, c4) == (0, 0, 0, 0), (c1, c2, c3, c4))
    check("Mechler2002" in out1 and "On the classification" in out1, out1)
    check(any("mindate=2000" in u for u in net.urls), "since filter sent to PubMed")
    check(any("api.semanticscholar" in u for u in net.urls) and any("export.arxiv.org" in u for u in net.urls), "all sources queried")
    cands = lit.load_candidates(d)
    keys = [c["key"] for c in cands]
    check(len(keys) == len(set(keys)) == 7, keys)  # 2 pubmed + 1 s2 (DOI and title dupes) + 2 openalex + 2 arxiv (DOI dupe)
    m = next(c for c in cands if c["key"] == "Mechler2002")
    check(m["found_by"] == ["pubmed", "s2", "openalex"], m["found_by"])
    check(m["oa_pdf"] and m["pmid"] == "11934453" and m["openalex"].startswith("W"), "fields merged from all sources")
    p = next(c for c in cands if c["key"] == "Priebe2004")
    check(p["found_by"] == ["pubmed", "s2"] and p["doi"] == "10.1038/nn1310", "title+year dedupe of the S2 record without DOI")
    h = next(c for c in cands if c["arxiv"] == "2012.09027" or c["doi"] == "10.1162/neco_a_00163")
    check(h["found_by"] == ["s2", "arxiv"] and h["arxiv"] and h["doi"], h["found_by"])
    rows = table_rows(d / "search_log.md")
    check([r[2] for r in rows] == ["pubmed", "s2", "openalex", "arxiv"], rows)
    check([(r[5], r[6]) for r in rows] == [("2", "2"), ("3", "1"), ("3", "2"), ("3", "2")], [(r[5], r[6]) for r in rows])
    check(rows[0][4] == "max=5; since=2000" and rows[0][0] == "1" and rows[3][0] == "4", rows[0])
    with patched(FakeNet()):
        code, out, _ = run("search", d, "s2", "simple complex cells")
    check("0 new" in out and len(lit.load_candidates(d)) == 7, "repeat search adds nothing")


@test
def key_collisions_get_suffixes():
    a = lit.mkrec(title="One", authors=["Smith, A"], year=2001)
    b = lit.mkrec(title="Two", authors=["Smith, B"], year=2001)
    c = lit.mkrec(title="Three", authors=["Smith, C"], year=2001)
    res = lit.merge_records([], [a, b, c])
    check([r["key"] for r, _ in res] == ["Smith2001", "Smith2001b", "Smith2001c"], [r["key"] for r, _ in res])


@test
def different_dois_are_not_merged_by_title():
    a = lit.mkrec(title="Same title", authors=["Lee, A"], year=2020, doi="10.1/a")
    b = lit.mkrec(title="Same title", authors=["Lee, A"], year=2020, doi="10.1/b")
    check(len(lit.merge_records([a], [b])) == 1 and len({a["key"] or "x", b["key"]}) == 2, "preprint and paper with different DOIs stay apart")


@test
def search_network_failure_exits_4_and_logs_nothing():
    d = new_folder()
    with patched(FakeNet(fail=("openalex",))):
        code, _, err = run("search", d, "openalex", "x")
    check(code == 4 and "429" in err, (code, err))
    check(table_rows(d / "search_log.md") == [] and lit.load_candidates(d) == [], "nothing written after a failed search")


@test
def http_get_backs_off_on_429():
    calls = []
    real_open, real_sleep = lit.urllib.request.urlopen, lit.time.sleep

    class R:
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def read(self): return b"ok"

    def fake_open(req, timeout=0):
        calls.append(1)
        if len(calls) <= n_fail[0]:
            raise urllib.error.HTTPError(req.full_url, 429, "Too Many", {}, None)
        return R()

    lit.urllib.request.urlopen, lit.time.sleep = fake_open, lambda s: None
    try:
        n_fail = [2]
        check(lit.http_get("https://api.semanticscholar.org/x") == b"ok" and len(calls) == 3, len(calls))
        calls.clear()
        n_fail[0] = 99
        try:
            lit.http_get("https://api.semanticscholar.org/x")
            raise AssertionError("expected NetError")
        except lit.NetError as e:
            check(len(calls) == 4 and "S2_API_KEY" in str(e), (len(calls), str(e)))
    finally:
        lit.urllib.request.urlopen, lit.time.sleep = real_open, real_sleep


@test
def search_devonthink_unavailable_exits_2():
    d = new_folder()
    code, _, err = run("search", d, "devonthink", "x")
    check(code == 2 and "DEVONthink unavailable" in err, (code, err))
    check(table_rows(d / "search_log.md") == [], "no log row when nothing was searched")


# ---------------------------------------------------------------- cites

@test
def cites_falls_back_to_openalex():
    d = new_folder()
    with patched(FakeNet()):
        run("search", d, "pubmed", "q")
        c1, out1, _ = run("cites", d, "Mechler2002", "--refs", "--max", 10)  # s2 returns data:null (publisher-elided)
        c2, _, _ = run("cites", d, "Mechler2002", "--citedby")
    check(c1 == 0 and c2 == 0, (c1, c2))
    cands = lit.load_candidates(d)
    check(any("refs:Mechler2002" in c["found_by"] for c in cands), "refs found_by")
    check(any("citedby:Mechler2002" in c["found_by"] for c in cands) or len(cands) > 2, "citedby merged")
    rows = table_rows(d / "search_log.md")
    check(rows[1][2] == "openalex:refs" and rows[1][3] == "refs:Mechler2002", rows[1])
    check("elided" in rows[1][7] or "nothing" in rows[1][7], rows[1][7])


@test
def cites_uses_s2_when_it_has_data():
    d = new_folder()
    wrapped = json.dumps({"data": [{"citedPaper": x} for x in json.loads(fx("s2_search.json"))["data"]]}).encode()

    class Net(FakeNet):
        def __call__(self, url, *a, **k):
            if "/references" in url:
                self.urls.append(url)
                return wrapped
            return super().__call__(url, *a, **k)

    with patched(Net()):
        run("search", d, "pubmed", "q")
        code, _, _ = run("cites", d, "Mechler2002", "--refs")
    check(code == 0 and table_rows(d / "search_log.md")[1][2] == "s2:refs", table_rows(d / "search_log.md")[1])
    check(any("refs:Mechler2002" in c["found_by"] for c in lit.load_candidates(d)), "found_by")


# ---------------------------------------------------------------- screen, init

@test
def screen_sets_status():
    d = new_folder()
    with patched(FakeNet()):
        run("search", d, "pubmed", "q")
    check(run("screen", d, "Mechler2002", "in", "cat V1, bimodality")[0] == 0, "screen in")
    check(run("screen", d, "Priebe2004", "out", "model paper")[0] == 0, "screen out")
    st = {c["key"]: (c["status"], c["reason"]) for c in lit.load_candidates(d)}
    check(st["Mechler2002"] == ("in", "cat V1, bimodality") and st["Priebe2004"] == ("out", "model paper"), st)
    check(run("screen", d, "Nobody1999", "in", "x")[0] == 1, "unknown key")


@test
def init_creates_and_refuses_overwrite():
    d = new_folder()
    for name in ("question.md", "search_log.md", "ledger.md", "synthesis.md", "to_fetch.md", "candidates.jsonl"):
        check((d / name).exists(), name)
    check((d / "verify").is_dir(), "verify/")
    q = (d / "question.md").read_text()
    check("What is the modulation ratio gap?" in q and "value" in q and "{{" not in q, q[:200])
    (d / "ledger.md").write_text("mine\n")
    code, _, err = run("init", d, "--question", "again")
    check(code == 1 and "refusing" in err and (d / "ledger.md").read_text() == "mine\n", (code, err))
    check("What is the modulation" in (d / "question.md").read_text(), "existing files untouched")


# ---------------------------------------------------------------- quote, text

PAPER = FIX / "paper.txt"


@test
def quote_exact_and_page():
    code, out, _ = run("quote", PAPER, "The distribution of modulation ratios is bimodal, with a clear gap between")
    check(code == 0 and out.startswith("page 2 | score 1.00"), out)
    check("> The distribution" in out and "  Page two begins here." in out, out)
    check(run("quote", PAPER, "Page two begins here.", "--page", 2)[0] == 0, "page restriction")


@test
def quote_survives_hyphenation_ligatures_and_linebreaks():
    q = "classification of simple and complex cells is not a dichotomy but a continuum, as shown by the well known modulation ratio"
    code, out, _ = run("quote", PAPER, q)
    check(code == 0 and out.startswith("page 1"), out)
    score = float(out.split("score ")[1].split()[0])
    check(score >= 0.9, score)
    q2 = "Spike threshold turns a unimodal membrane potential distribution into a bimodal firing rate distribution."
    check(run("quote", PAPER, q2)[0] == 0, "fi ligature in the text matches 'fi' in the quote")
    code, out, _ = run("quote", PAPER, "SPIKE   threshold turns a unimodal\nmembrane potential")
    check(code == 0, out)


@test
def quote_across_page_break():
    code, out, _ = run("quote", PAPER, "A closing line for page one. Page two begins here.")
    check(code == 0 and out.startswith("page 1") and "continues on page 2" in out, out)


@test
def quote_below_threshold_exits_1():
    code, out, _ = run("quote", PAPER, "The distribution of modulation ratios is trimodal, with a vague overlap among\nthe three populations of neurons in macaque")
    check(code == 1, (code, out))
    score = float(out.split("score ")[1].split()[0])
    check(0 < score < 0.9, score)
    code, out, _ = run("quote", PAPER, "Completely unrelated sentence about zebrafish tectum calcium imaging.")
    check(code == 1, out)
    code, out, _ = run("quote", PAPER, "The distribution of modulation ratios is bimodal", "--page", 1)
    check(code == 1, "quote from page 2 not found on page 1")


@test
def quote_catches_a_changed_number():
    code, out, _ = run("quote", PAPER, "The modulation ratio threshold was 1.5 in 85 cells.")
    check(code == 1 and "numbers differ" in out, (code, out))
    check(run("quote", PAPER, "The modulation ratio threshold was 1.0 in 85 cells.")[0] == 0, "right number passes")


@test
def text_and_quote_on_pdf():
    if not shutil.which("pdftotext"):
        raise Skip("pdftotext not installed")
    d = tmpdir()
    pdf = d / "paper.pdf"
    pdf.write_bytes(make_pdf(PDF_PAGES))
    code, out, _ = run("text", pdf)
    cache = Path(out.strip())
    check(code == 0 and cache.resolve() == (d / "paper.txt").resolve() and cache.exists(), (code, out))
    body = cache.read_text()
    check("=== page 1 ===" in body and "=== page 2 ===" in body and "Page two begins here." in body, body)
    code, out, _ = run("quote", pdf, "classification of simple and complex cells is not a dichotomy but a continuum")
    check(code == 0 and out.startswith("page 1"), out)
    code, out, _ = run("quote", pdf, "bimodal, with a clear gap between the two groups of cells", "--page", 2)
    check(code == 0 and out.startswith("page 2"), out)


@test
def missing_pdftotext_exits_2():
    d = tmpdir()
    pdf = d / "paper.pdf"
    pdf.write_bytes(make_pdf(PDF_PAGES))
    empty = tmpdir()
    env = dict(os.environ, PATH=str(empty))
    for argv in (["text", str(pdf)], ["quote", str(pdf), "Page two"]):
        p = subprocess.run([sys.executable, str(LIT_PATH), *argv], env=env, capture_output=True, text=True)
        check(p.returncode == 2 and "pdftotext not found" in p.stderr and "Traceback" not in p.stderr, (argv, p.returncode, p.stderr))
    p = subprocess.run([sys.executable, str(LIT_PATH), "quote", str(PAPER), "Page two begins here."], env=env,
                       capture_output=True, text=True)
    check(p.returncode == 0, "a text file needs no pdftotext")


# ---------------------------------------------------------------- check, bib

def copy_folder(name):
    d = tmpdir() / name
    shutil.copytree(FIX / name, d)
    return d


@test
def check_good_folder():
    d = copy_folder("folder_good")
    code, out, _ = run("check", d)
    check(code == 0 and "0 problem(s)" in out, out)
    check("WARN" in out and "Priebe2004" in out, out)
    check("L3 which is indirect" in out, "'indirect' is accepted and flagged as a warning")


@test
def check_bad_folder():
    d = copy_folder("folder_bad")
    code, out, _ = run("check", d)
    check(code == 1, code)
    for needle in ("L1: quote is empty", "L2: source Hansard2011 has status 'out'", "L3: evidence 'guess'",
                   "L3: verified 'maybe'", "L5: locator is empty", "L5: source 'Nobody1999' is not a key",
                   "cites L4 which is unchecked", "[L9] which is not in the ledger"):
        check(needle in out, f"missing: {needle}\n{out}")
    check("WARN" in out and "L6 which is abstract-only" in out, out)


@test
def check_fresh_folder_is_clean():
    d = new_folder()
    code, out, _ = run("check", d)
    check(code == 0, out)


@test
def bib_output():
    d = copy_folder("folder_good")
    code, out, _ = run("bib", d)
    bib = (d / "sources.bib").read_text()
    check(code == 0 and bib.count("@article{Mechler2002,") == 1 and bib.count("@") == 1, bib)
    check("doi = {10.1016/s0042-6989(02)00025-1}" in bib and "author = {Mechler, F and Ringach, D}" in bib, bib)
    check("year = {2002}" in bib and "journal = {Vision Research}" in bib, bib)


@test
def bib_arxiv_entry():
    r = lit.mkrec(arxiv="2012.09027", title="A model & more", authors=["Hansard, Miles"], year=2020, venue="arXiv")
    r["key"] = "Hansard2020"
    e = lit.bib_entry(r)
    check(e.startswith("@misc{Hansard2020,") and "eprint = {2012.09027}" in e and "A model \\& more" in e, e)


# ---------------------------------------------------------------- fetch

def folder_with(cands):
    d = new_folder()
    lit.save_candidates(d, cands)
    return d


def cand(key, **kw):
    r = lit.mkrec(title=kw.pop("title", "On the classification of simple and complex cells"), authors=["Mechler, F"], year=2002, **kw)
    r["key"] = key
    return r


@test
def fetch_from_papers_folder():
    d = folder_with([cand("Mechler2002")])
    papers = tmpdir() / "papers"
    papers.mkdir()
    (papers / "other_paper.pdf").write_bytes(b"%PDF-1.4")
    (papers / "Mechler 2002 - On the classification of simple and complex cells.pdf").write_bytes(make_pdf(PDF_PAGES))
    with patched(FakeNet(fail=("",))) as net:  # any network use fails the test
        code, out, _ = run("fetch", d, "Mechler2002", "--papers", papers)
    check(code == 0 and "On the classification" in out and "papers folder" in out and not net.urls, (code, out, net.urls))


@test
def fetch_open_access_download():
    d = folder_with([cand("Mechler2002", oa_pdf="https://publisher.example/landing.pdf", arxiv="2012.09027")])
    papers = tmpdir() / "new" / "papers"
    with patched(FakeNet(html=("publisher.example",))):
        code, out, _ = run("fetch", d, "Mechler2002", "--papers", papers)
    pdf = papers / "Mechler2002.pdf"
    check(code == 0 and pdf.exists() and pdf.read_bytes()[:5] == b"%PDF-" and "open access" in out, (code, out))


@test
def fetch_openalex_location():
    d = folder_with([cand("Mechler2002", doi="10.1016/s0042-6989(02)00025-1")])
    papers = tmpdir() / "p"
    with patched(FakeNet()) as net:
        code, out, _ = run("fetch", d, "Mechler2002", "--papers", papers)
    check(code == 0 and (papers / "Mechler2002.pdf").exists(), (code, out))
    check(any("openalex.org/works/doi:" in u for u in net.urls), net.urls)


@test
def fetch_not_found_exits_3_and_lists_once():
    d = folder_with([cand("Nobody1999", title="A paper nobody can get")])
    papers = tmpdir() / "p"
    for _ in range(2):
        with patched(FakeNet()):
            code, _, err = run("fetch", d, "Nobody1999", "--papers", papers, "--why", "L7 value needed")
        check(code == 3 and "ask the owner" in err, (code, err))
    rows = table_rows(d / "to_fetch.md")
    check(len(rows) == 1 and rows[0][0] == "Nobody1999" and "L7 value needed" in rows[0][3], rows)


# ---------------------------------------------------------------- devonthink

@test
def devonthink_status_gives_a_reason():
    saved = os.environ.pop("LIT_DEVONTHINK")
    try:
        p = subprocess.run([sys.executable, str(LIT_PATH), "devonthink-status"], capture_output=True, text=True, timeout=120)
    finally:
        os.environ["LIT_DEVONTHINK"] = saved
    check(p.returncode in (0, 2) and p.stdout.strip() and "Traceback" not in p.stderr, (p.returncode, p.stdout, p.stderr))
    check(p.returncode == 0 or p.stdout.startswith("unavailable: "), p.stdout)


@test
def devonthink_status_reasons():
    real = sys.platform
    saved = os.environ.pop("LIT_DEVONTHINK")
    try:
        lit.sys.platform = "linux"
        ok, why = lit.dt_status()
        check(not ok and "not macOS" in why, why)
        lit.sys.platform = "darwin"
        real_which = lit.shutil.which
        lit.shutil.which = lambda n: None
        ok, why = lit.dt_status()
        lit.shutil.which = real_which
        check(not ok and "osascript not found" in why, why)
    finally:
        lit.sys.platform = real
        os.environ["LIT_DEVONTHINK"] = saved
    check("-1743" in lit.dt_reason("execution error: Not authorized to send Apple events (-1743)")
          and "Automation" in lit.dt_reason("(-1743)"), "-1743 explained")
    check("not running" in lit.dt_reason("(-600)"), "-600")
    code, out, _ = run("devonthink-status")
    check(code == 2 and "LIT_DEVONTHINK=off" in out, out)


# ---------------------------------------------------------------- live

def live():
    d = new_folder()
    results = []
    queries = {"pubmed": "Mechler Ringach simple complex cells classification", "s2": "classification of simple and complex cells",
               "arxiv": "complex cell model visual cortex", "openalex": "classification of simple and complex cells"}
    for src, q in queries.items():
        code, out, err = run("search", d, src, q, "--max", 3)
        if code == 4:
            results.append((src, "SKIPPED (network/API): " + err.strip()))
        elif code == 0 and lit.load_candidates(d):
            results.append((src, "ok"))
        else:
            results.append((src, f"FAIL exit {code}: {err.strip()}"))
        time.sleep(1.5)
    return results


def main():
    failures, skipped = 0, []
    t0 = time.time()
    for fn in TESTS:
        try:
            fn()
            print(f"  ok    {fn.__name__}")
        except Skip as e:
            skipped.append(fn.__name__)
            print(f"  SKIP  {fn.__name__}: {e}")
        except Exception as e:
            failures += 1
            print(f"  FAIL  {fn.__name__}: {e}")
            tb = traceback.extract_tb(e.__traceback__)[-1]
            print(f"        at {Path(tb.filename).name}:{tb.lineno}")
    ran = len(TESTS) - len(skipped)
    print(f"literature-research evals (offline): {ran - failures}/{ran} passed, {len(skipped)} skipped, {time.time() - t0:.1f}s")
    if "--live" in sys.argv:
        for src, res in live():
            print(f"  live {src}: {res}")
            failures += res.startswith("FAIL")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
