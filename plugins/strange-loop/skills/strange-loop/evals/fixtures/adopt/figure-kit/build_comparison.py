"""Build the before/after comparison report for lecture 1 and import it into DEVONthink (the owner's notes database)."""
import subprocess
from pathlib import Path

REPORT = Path(__file__).parent / "benchmark" / "comparison.md"

if __name__ == "__main__":
    REPORT.write_text("# Lecture 1 figures, before and after\n")
    subprocess.run(["osascript", "-e", f'tell application id "DNtp" to import "{REPORT}"'])
