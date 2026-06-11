---
"@revealui/cli": patch
---

The `starter` template ships in the npm tarball and scaffolds correctly, but it was missing from the template type union, the `--template` flag validation, and the interactive picker, so `--template starter` silently fell back to the prompt (or to `basic-blog` with `--yes`). It is now selectable everywhere, the `--template` help text and docs enumerate all five templates, and a registry test pins the selectable list to the shipped `templates/` directories so the two can no longer drift.
