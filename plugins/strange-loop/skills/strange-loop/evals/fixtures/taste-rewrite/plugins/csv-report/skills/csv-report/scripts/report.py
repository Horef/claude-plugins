"""Summarise each column of a CSV file: count, empty cells, and min/max for numbers."""
import argparse
import csv


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True)
    rows = list(csv.DictReader(open(ap.parse_args().input, newline="")))
    for col in (rows[0].keys() if rows else []):
        vals = [r[col] for r in rows if r[col].strip()]
        nums = []
        for v in vals:
            try:
                nums.append(float(v))
            except ValueError:
                pass
        rng = f", min {min(nums)}, max {max(nums)}" if nums and len(nums) == len(vals) else ""
        print(f"{col}: {len(vals)} values, {len(rows) - len(vals)} empty{rng}")


if __name__ == "__main__":
    main()
