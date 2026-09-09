#!/usr/bin/env bash
# CI Playwright Chromium install.
#
# GitHub ubuntu-latest ships /etc/apt/sources.list.d/google-chrome.list.
# `playwright install --with-deps` runs apt-get update against that repo.
# When dl.google.com's Release file and Packages.gz hashes disagree
# (Hash Sum mismatch), the whole E2E job dies before any test runs.
# Playwright's bundled Chromium does not need branded Chrome from that repo.
set -euo pipefail

if command -v sudo >/dev/null 2>&1; then
  sudo rm -f \
    /etc/apt/sources.list.d/google-chrome.list \
    /etc/apt/sources.list.d/google-chrome.list.save \
    /etc/apt/sources.list.d/google-chrome.sources \
    || true
fi

npx playwright install --with-deps chromium
