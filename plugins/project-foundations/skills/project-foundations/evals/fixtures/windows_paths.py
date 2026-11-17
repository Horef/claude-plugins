"""Call docmap.py's path helpers as on Windows, where str() of a path joins parts with backslashes (O29).

Usage (from the fixture project's root): python windows_paths.py DOCMAP. Imports DOCMAP, swaps its Path for
PureWindowsPath (file access goes through ROOT, a real path), and prints code_dirs, id_scope and the
rows of folder_table for each folder code_dirs returns, one line each, for evals/run.py to compare with POSIX results.
"""
import importlib.util
import pathlib
import sys

spec = importlib.util.spec_from_file_location("docmap", sys.argv[1])
dm = importlib.util.module_from_spec(spec)
spec.loader.exec_module(dm)
dm.Path = pathlib.PureWindowsPath
files = dm.tracked_files()
print("dirs", " ".join(dm.code_dirs(files)))
print("scope", dm.id_scope("src/pkg/a.py"))
for d in dm.code_dirs(files):
    rows = [r.split("|")[1].strip() for r in dm.folder_table(d, files, {}, {}).splitlines()[2:]]
    print("table", d, " ".join(rows))
