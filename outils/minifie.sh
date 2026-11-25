#!/bin/sh
# minifie.sh: minifies the pages' scripts and styles in place, for the deployment only (.github/workflows/site.yml): the sources
# in git stay readable. No bundling, so every file keeps its name and its relative imports. Vendored libraries are left as they are.
#   sh outils/minifie.sh [folder]     (default: public)
set -e
P="${1:-public}"
# (the version the server's lock file pins, never one fetched on the spot: npm ci in api/ first. The modules apart: esbuild would
# write them beside their sources, as .js)
ESBUILD="$(dirname "$0")/../api/node_modules/.bin/esbuild"
OPT="--minify --charset=utf8 --legal-comments=none --allow-overwrite --outbase=$P --outdir=$P --log-level=warning"
"$ESBUILD" $(ls "$P"/squelette/*.js "$P"/squelette/*.css "$P"/scene/*.js "$P"/scene/*.css) $OPT
"$ESBUILD" $(ls "$P"/squelette/*.mjs "$P"/scene/*.mjs "$P"/insectes/runtime/*.mjs) $OPT --out-extension:.js=.mjs
