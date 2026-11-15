#!/usr/bin/env python3
"""Small parent + child-worker simulator fixture for local-run-queue judged evals."""
import subprocess
import sys
import time


def hold(mb: int) -> bytearray:
    buf = bytearray(mb * 2**20)
    for i in range(0, len(buf), 4096):
        buf[i] = 1
    return buf


def main() -> None:
    if "--worker" in sys.argv:
        mb = int(sys.argv[sys.argv.index("--worker") + 1])
        secs = float(sys.argv[sys.argv.index("--worker") + 2])
        _ = hold(mb)
        time.sleep(secs)
        return
    parent_mb = int(sys.argv[1]) if len(sys.argv) > 1 else 25
    worker_mb = int(sys.argv[2]) if len(sys.argv) > 2 else 150
    secs = float(sys.argv[3]) if len(sys.argv) > 3 else 3.0
    child = subprocess.Popen([sys.executable, __file__, "--worker", str(worker_mb), str(secs)])
    _ = hold(parent_mb)
    child.wait()


if __name__ == "__main__":
    main()
