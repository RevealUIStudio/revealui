#!/usr/bin/env bash
#
# Regenerate the static OG fonts from the Inter Tight variable source.
#
# Why static instances and not the variable master:
#   satori parses fonts with @shuding/opentype.js, whose `fvar` (font-variations)
#   table parser throws "Cannot read properties of undefined" at runtime on a
#   variable font. Static single-weight instances have no `fvar` table, so
#   satori parses them reliably. See apps/server/src/routes/og.ts.
#
# This is a dev-time tool, NOT a build step: the generated .ttf files are
# committed, so the production build stays pure-Node (no Python dependency).
#
# Requires fonttools:  python3 -m pip install --user fonttools
# Run:                 bash apps/server/scripts/regen-og-fonts.sh
#
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fonts="${here}/../src/assets/fonts"
src="${fonts}/InterTight-Variable.ttf"

python3 -m fontTools.varLib.instancer "${src}" wght=400 -o "${fonts}/InterTight-Regular.ttf"
python3 -m fontTools.varLib.instancer "${src}" wght=700 -o "${fonts}/InterTight-Bold.ttf"

echo "Regenerated static OG fonts from ${src}:"
echo "  InterTight-Regular.ttf (wght=400)"
echo "  InterTight-Bold.ttf    (wght=700)"
