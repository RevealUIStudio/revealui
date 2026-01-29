#!/usr/bin/env python3
"""
Vultr Model Checker

Utility to check if a model exists in Vultr inference data.
Used by check-vultr-model.sh to avoid inline Python.

Usage:
    python check_model.py <json_file> <model_name>

Returns:
    Exit code 0 if model found, 1 if not found, 2 on error
"""

import sys
import json


def contains_model(obj, model: str) -> bool:
    """Recursively check if the model string exists in the object."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            if isinstance(v, str) and model in v:
                return True
            if contains_model(v, model):
                return True
    elif isinstance(obj, list):
        for item in obj:
            if contains_model(item, model):
                return True
    return False


def main():
    if len(sys.argv) < 3:
        print("Usage: check_model.py <json_file> <model_name>", file=sys.stderr)
        sys.exit(2)

    json_path = sys.argv[1]
    model = sys.argv[2]

    try:
        with open(json_path, "r") as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"File not found: {json_path}", file=sys.stderr)
        sys.exit(2)
    except json.JSONDecodeError as e:
        print(f"Invalid JSON: {e}", file=sys.stderr)
        sys.exit(2)

    if contains_model(data, model):
        print(f"Found model: {model}")
        sys.exit(0)
    else:
        print(f"Model not found: {model}")
        sys.exit(1)


if __name__ == "__main__":
    main()
