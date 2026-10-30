"""Scripted evals for strange-loop: the loop.py unit tests (exit 1 on any failure)."""
import sys
import unittest
from pathlib import Path

suite = unittest.defaultTestLoader.discover(str(Path(__file__).parent), pattern="test_*.py")
sys.exit(0 if unittest.TextTestRunner(verbosity=1).run(suite).wasSuccessful() else 1)
