# Ledger: <write-up title>

## Message
<!-- One paragraph: the question, what was done, what was found, what it means. Every section serves it. -->

## Reader
<!-- Who reads this, what they know, the questions they arrive with. -->

## Values
<!-- Named numbers live in values/*.json, written by the analysis scripts (a bare number, {"value": 0.035, "fmt": ".3f",
     "source": "run id", "unit": "..."}, or {"expr": "a / b", "fmt": ".2f"} for a derived one). The text uses them as
     \val{name} (also in captions and the In short box), so a changed result changes every sentence that uses it.
     `wr.py values DIR` regenerates values.tex; `wr.py confirm DIR` records that you re-read the sentences using them. -->

## Facts
<!-- Atomic results, each stated once in the text (\fact{F1} before the sentence), the claims rest on them.
     fact: one sentence, a result. values: comma-separated value names it uses. test: optional true/false expression over
     value names (min_site_share_pass >= 0.23); when it turns false the fact no longer holds and `check` says so.
     status: holds | fails | open | superseded by Fn (a replaced fact stays here so the history of the result is kept;
     it is no longer stated in the text). condition: what it was tested under. evidence: the result entry or run id.
     `wr.py confirm DIR` also records each fact's sentence and test; check lists a fact reworded since, with its claims. -->
| id | fact (one sentence, a result) | values | test | status | condition | evidence |
|---|---|---|---|---|---|---|
| F1 | | | | | | |

## Claims
<!-- One row per claim, in the order of the argument. status: established | plausible | open.
     evidence: the result entry or run id that supports it. figure: its label (fig:...) or "none".
     condition: what the claim was tested under (a parameter strength, a dataset, a regime), or "all" when none applies;
     each section states the conditions of its claims.
     facts: the F ids (from Facts) the claim rests on; a claim whose facts no longer hold is flagged. -->
| id | claim (one sentence, a finding) | status | evidence | figure | condition | facts |
|---|---|---|---|---|---|---|
| C1 | | | | | | |

## Out of scope
<!-- Results that exist but do not serve the message; say where they live instead. -->
