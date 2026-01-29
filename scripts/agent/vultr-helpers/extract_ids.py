#!/usr/bin/env python3
"""
Vultr Subscription ID Extractor

Extracts subscription IDs from Vultr inference list JSON.
Used by check-vultr-model.sh to avoid inline Python.

Usage:
    python extract_ids.py <json_file> <output_file>

Writes subscription IDs to output_file, one per line.
"""

import sys
import json


def main():
    if len(sys.argv) < 3:
        print("Usage: extract_ids.py <json_file> <output_file>", file=sys.stderr)
        sys.exit(2)

    json_path = sys.argv[1]
    output_path = sys.argv[2]

    try:
        with open(json_path, "r") as f:
            data = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        # Write empty file on error
        with open(output_path, "w") as f:
            pass
        sys.exit(0)

    ids = []
    if isinstance(data, dict):
        subs = data.get("subscriptions") or []
        for s in subs:
            if isinstance(s, dict) and s.get("id"):
                ids.append(s.get("id"))

    with open(output_path, "w") as f:
        f.write("\n".join(ids))


if __name__ == "__main__":
    main()
