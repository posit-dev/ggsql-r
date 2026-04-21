#!/usr/bin/env bash
#
# Downloads vendored Vega dependencies into inst/lib/.
# Sources: https://cdn.jsdelivr.net/npm/<package>@<version>
#
set -euo pipefail

VEGA_VERSION="6.2.0"
VEGA_LITE_VERSION="6.4.2"
VEGA_EMBED_VERSION="7.1.0"

CDN="https://cdn.jsdelivr.net/npm"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LIB_DIR="$SCRIPT_DIR/../inst/htmlwidgets/lib"

download() {
  local pkg="$1" version="$2" dir="$3"
  local url="$CDN/$pkg@$version/build/$pkg.min.js"
  mkdir -p "$LIB_DIR/$dir"
  echo "Downloading $pkg@$version ..."
  curl -fsSL "$url" -o "$LIB_DIR/$dir/$pkg.min.js"
}

download vega "$VEGA_VERSION" vega
download vega-lite "$VEGA_LITE_VERSION" vega-lite
download vega-embed "$VEGA_EMBED_VERSION" vega-embed

echo "Done. Remember to update version strings in inst/htmlwidgets/ggsql_viz.yaml if versions changed."
