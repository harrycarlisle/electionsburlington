#!/usr/bin/env python3
"""Commit generated files and safely push them from GitHub Actions.

Automated Burlington News workflows share main. This helper stages the requested
paths, commits only material changes, rebases onto the latest origin/main, and
retries the push when another bot wins the race.
"""
from __future__ import annotations

import argparse
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def run(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        list(args),
        cwd=ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        check=check,
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--name", required=True)
    parser.add_argument("--email", default="actions@users.noreply.github.com")
    parser.add_argument("--message", required=True)
    parser.add_argument("--branch", default="main")
    parser.add_argument("--retries", type=int, default=4)
    parser.add_argument("paths", nargs="+")
    args = parser.parse_args()

    run("git", "config", "user.name", args.name)
    run("git", "config", "user.email", args.email)
    run("git", "add", "--", *args.paths)

    staged = run("git", "diff", "--cached", "--quiet", check=False)
    if staged.returncode == 0:
        print("No repository changes.")
        return 0

    run("git", "commit", "-m", args.message)

    for attempt in range(1, args.retries + 1):
        run("git", "fetch", "origin", args.branch)
        rebase = run("git", "rebase", f"origin/{args.branch}", check=False)
        print(rebase.stdout, end="")
        if rebase.returncode != 0:
            run("git", "rebase", "--abort", check=False)
            print("Automated rebase conflicted; refusing to overwrite main.", file=sys.stderr)
            return 2

        push = run("git", "push", "origin", f"HEAD:{args.branch}", check=False)
        print(push.stdout, end="")
        if push.returncode == 0:
            return 0

        if attempt < args.retries:
            time.sleep(attempt * 2)

    print(f"Push failed after {args.retries} attempts.", file=sys.stderr)
    return 3


if __name__ == "__main__":
    raise SystemExit(main())
