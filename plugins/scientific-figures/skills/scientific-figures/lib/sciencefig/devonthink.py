"""Getting figures into DEVONthink Markdown notes (and Anki).

Rules learned the hard way (all enforced here):
  * the <svg> must be ONE line with no blank lines inside
  * white background rect; explicit colours (no currentColor)
  * no raw '&' anywhere in the SVG
  * a BLANK line between </svg> and the italic caption, otherwise the
    asterisks show literally
  * DEVONthink WikiLinks must be "Square Brackets" only, otherwise
    "Names and Aliases" injects links into SVG text
"""
import re

from .check import check_inline

PLACEHOLDER = re.compile(r"\{\{FIG:([A-Za-z0-9_-]+)\}\}")


def md_figure(svg, caption):
    """Markdown block: svg line, blank line, italic caption."""
    probs = check_inline(svg)
    if probs:
        raise ValueError("SVG not inline-safe: " + "; ".join(probs))
    caption = caption.strip().replace("*", "")
    return f"{svg}\n\n*{caption}*\n"


def substitute(markdown, figures):
    """Replace {{FIG:name}} placeholders. figures: {name: (svg, caption)}.
    Raises if a placeholder has no figure."""
    def rep(m):
        name = m.group(1)
        if name not in figures:
            raise KeyError(f"no figure for placeholder {name}")
        svg, cap = figures[name]
        return md_figure(svg, cap)
    return PLACEHOLDER.sub(rep, markdown)
