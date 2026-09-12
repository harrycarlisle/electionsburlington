#!/usr/bin/env python3
"""Discover Video Leads. Writes an internal queue. Never publishes articles."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from video_leads.run import main

if __name__ == "__main__":
    raise SystemExit(main())
