#!/usr/bin/env bash
# Builds host binaries around CrossPoint's own OPDS and OPF parsers: the 1.6.5
# release (what the X3 runs) and a pinned develop revision (what's coming).
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
cache="$here/../.cache/crosspoint"
crosspoint_sha=6c17b0eef6d7fca81842f4ade55a23da140fac8e
freeink_sha=059275ea8cd708cb252d8a94c9aaddf0a5433437
release_sha=93e98bb78702e29868a16a13b80c40e6b36ccdff # tag 1.6.5

checkout() {
  local repo=$1 dir=$2 sha=$3
  if [ "$(git -C "$dir" rev-parse HEAD 2>/dev/null)" = "$sha" ]; then return; fi
  mkdir -p "$dir"
  git -C "$dir" init -q
  git -C "$dir" remote add origin "$repo" 2>/dev/null || true
  git -C "$dir" fetch -q --depth 1 origin "$sha"
  git -C "$dir" checkout -q FETCH_HEAD
}

checkout https://github.com/crosspoint-reader/crosspoint-reader.git "$cache/crosspoint-reader" "$crosspoint_sha"
checkout https://github.com/Free-Ink/freeink-sdk.git "$cache/freeink-sdk" "$freeink_sha"
checkout https://github.com/crosspoint-reader/crosspoint-reader.git "$cache/crosspoint-1.6.5" "$release_sha"

cp=$cache/crosspoint-reader
opds=$cache/freeink-sdk/libs/network/Opds
mkdir -p "$cache/bin"
cxx=(clang++ -std=c++20 -O1 -w)

"${cxx[@]}" -I "$here/crosspoint/stubs" -I "$opds/include" \
  "$here/crosspoint/opds-check.cpp" "$opds/src/OpdsParser.cpp" -lexpat -o "$cache/bin/opds-check"

release=$cache/crosspoint-1.6.5
"${cxx[@]}" -DOPDS_PARSER_1_6 -I "$here/crosspoint/stubs" -I "$release/lib/OpdsParser" -I "$release/lib/XmlParserUtils" \
  "$here/crosspoint/opds-check.cpp" "$release/lib/OpdsParser/OpdsParser.cpp" -lexpat -o "$cache/bin/opds-check-1.6.5"

"${cxx[@]}" -I "$cp/test/content_opf_parser/stubs" -I "$here/crosspoint/gtest-shim" -I "$cp/lib/Epub/Epub/parsers" -I "$cp/lib/XmlParserUtils" \
  "$here/crosspoint/opf-check.cpp" "$cp/lib/Epub/Epub/parsers/ContentOpfParser.cpp" -lexpat -o "$cache/bin/opf-check"

"${cxx[@]}" "$here/crosspoint/xml-check.cpp" -lexpat -o "$cache/bin/xml-check"

echo "$cache/bin"
