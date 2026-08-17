#!/usr/bin/env bash
#
# Builds the pinned OSM extract that the self-hosted OSRM foot profile serves
# (ADR-0005, issue #28): download each city's Geofabrik region at a pinned
# snapshot date, clip it to that city's bounding box, merge the boxes into one
# extract, and preprocess it for OSRM's MLD pipeline.
#
# The extract is NOT committed — it is hundreds of MB and re-derivable from this
# script plus regions.json. What is committed is everything needed to reproduce
# it from the same snapshot.
#
# Every tool runs in a pinned container, so the only host requirements are
# Docker, Node and curl. Written for macOS's bash 3.2, so no `mapfile` and no
# associative arrays. Expect a few hundred MB of download per city and roughly
# ten minutes for the full set.
#
# Usage:
#   ./prepare-extract.sh              # all eight seeded cities
#   ./prepare-extract.sh IST          # one city — enough to develop against
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
OUT_DIR="$BACKEND_DIR/data/osrm"
WORK_DIR="$OUT_DIR/work"

# Pinned so a rebuild years from now produces the same graph. osrm-routed in
# docker-compose.yml must stay on this same tag: OSRM's .osrm file format is
# version-specific, and a mismatch aborts at startup.
OSRM_IMAGE="ghcr.io/project-osrm/osrm-backend:v6.0.0"
# osmctools (osmconvert) is installed into a pinned Debian rather than pulled as
# its own image: the maintained OSM-tooling images are amd64-only, and this repo
# is developed on both arm64 (macOS) and amd64.
#
# osmconvert rather than osmium-tool, which is the more usual choice: clipping a
# country-sized region (turkey is ~600 MB) with `osmium extract` is OOM-killed
# outright in a 2 GB Docker VM, which is what both Docker Desktop and colima
# allocate by default on macOS. osmconvert does the same clip, complete ways
# included, in a fixed hash table that fits.
OSM_TOOLS_IMAGE="debian:bookworm-slim"

# osmconvert's node-id hash table for --complete-ways, in MB. Too small and it
# reports hash collisions and silently drops ways; 800 clears the densest of the
# eight boxes (ile-de-france) with room to spare.
HASH_MEMORY="${HASH_MEMORY:-800}"

SNAPSHOT="$(node -p "require('$SCRIPT_DIR/regions.json').snapshot")"
BASE_URL="$(node -p "require('$SCRIPT_DIR/regions.json').baseUrl")"

mkdir -p "$WORK_DIR"

# `IATA W,S,E,N REGION_PATH REGION_FILE` per line, the bbox derived from the
# seeded Attraction coordinates so it can never fall behind the dataset.
CITIES="$(node "$SCRIPT_DIR/city-bboxes.mjs" "$@")"
echo "==> $(echo "$CITIES" | wc -l | tr -d ' ') city/cities, Geofabrik snapshot $SNAPSHOT"

# ------------------------------------------------------------- 1. download regions
while read -r iata bbox region file; do
  if [ -f "$WORK_DIR/$file" ]; then
    echo "==> $iata: $file already downloaded"
  else
    echo "==> $iata: downloading $region ($SNAPSHOT)"
    curl -fL --retry 3 -o "$WORK_DIR/$file" "$BASE_URL/$region-$SNAPSHOT.osm.pbf"
  fi
done <<EOF
$CITIES
EOF

# ------------------------------------------------------------- 2. clip and merge
CLIP_SCRIPT="set -eu
export DEBIAN_FRONTEND=noninteractive
apt-get -qq update >/dev/null
apt-get -qq install -y osmctools >/dev/null
cd /work
"
CLIP_INPUTS=""
while read -r iata bbox region file; do
  CLIP_SCRIPT="${CLIP_SCRIPT}echo '    clipping $iata to $bbox'
osmconvert '$file' -b=$bbox --complete-ways --hash-memory=$HASH_MEMORY -o=city-$iata.osm.pbf
"
  CLIP_INPUTS="$CLIP_INPUTS city-$iata.osm.pbf"
done <<EOF
$CITIES
EOF

CLIP_SCRIPT="${CLIP_SCRIPT}echo '    merging into one extract'
osmconvert$CLIP_INPUTS -o=merged.osm.pbf
osmconvert merged.osm.pbf --out-statistics | grep -E 'nodes|ways|lon|lat'
"

echo "==> clipping and merging"
docker run --rm -v "$WORK_DIR:/work" "$OSM_TOOLS_IMAGE" bash -c "$CLIP_SCRIPT"

# ------------------------------------------------------------- 3. preprocess for OSRM
# MLD (partition + customize) rather than CH (contract): preprocessing is far
# cheaper, and SmartRoute only ever asks for small /table queries, where CH's
# query-time advantage does not show up.
rm -f "$OUT_DIR"/smartroute.osrm*
cp "$WORK_DIR/merged.osm.pbf" "$OUT_DIR/smartroute.osm.pbf"
echo "==> osrm-extract (foot profile, ferries removed)"
# The profile is mounted into /opt rather than /data so that its `require('foot')`
# resolves against the stock profile shipped in the image — OSRM puts only the
# profile's own directory on the Lua path.
docker run --rm -v "$OUT_DIR:/data" \
  -v "$SCRIPT_DIR/foot-smartroute.lua:/opt/foot-smartroute.lua:ro" "$OSRM_IMAGE" \
  osrm-extract -p /opt/foot-smartroute.lua /data/smartroute.osm.pbf
echo "==> osrm-partition"
docker run --rm -v "$OUT_DIR:/data" "$OSRM_IMAGE" osrm-partition /data/smartroute.osrm
echo "==> osrm-customize"
docker run --rm -v "$OUT_DIR:/data" "$OSRM_IMAGE" osrm-customize /data/smartroute.osrm

# ------------------------------------------------------------- 4. provenance
# Two records, because they answer different questions.
#
# PROVENANCE.txt sits next to the graph so an unlabelled data directory can be
# traced back to what produced it. It is gitignored along with the graph.
{
  echo "SmartRoute OSRM extract"
  echo "geofabrik-snapshot: $SNAPSHOT (dated extract, not -latest)"
  echo "clip:               osmconvert --complete-ways"
  echo "osrm-image:         $OSRM_IMAGE"
  echo "profile:            foot-smartroute.lua (stock foot, ferries removed)"
  echo "algorithm:          MLD"
  echo "cities:"
  while read -r iata bbox region file; do
    echo "  $iata bbox=$bbox region=$region"
  done <<EOF
$CITIES
EOF
  echo "source-checksums:"
  while read -r iata bbox region file; do
    echo "  $(cd "$WORK_DIR" && shasum -a 256 "$file")"
  done <<EOF
$CITIES
EOF
} >"$OUT_DIR/PROVENANCE.txt"

# checksums.txt is COMMITTED, and it is the half of provenance that has to be.
# Geofabrik keeps dated regional extracts for roughly 90 days, so the exact
# turkey-260815.osm.pbf this graph was built from will 404 well before the
# thesis is submitted. Once it does, "re-derivable from the pinned snapshot"
# only means anything if a substitute copy can be checked against the original
# — which needs the hash to be in the repo, not in a directory .gitignore drops.
#
# Only ever adds or updates the lines for the cities this run built, so
# `prepare-extract.sh IST` does not wipe the other seven cities' records.
for line in $(printf '%s\n' "$CITIES" | awk '{print $4}'); do
  sum="$(cd "$WORK_DIR" && shasum -a 256 "$line")"
  touch "$SCRIPT_DIR/checksums.txt"
  grep -v "  $line\$" "$SCRIPT_DIR/checksums.txt" >"$SCRIPT_DIR/checksums.tmp" || true
  echo "$sum" >>"$SCRIPT_DIR/checksums.tmp"
  sort -k2 "$SCRIPT_DIR/checksums.tmp" >"$SCRIPT_DIR/checksums.txt"
  rm -f "$SCRIPT_DIR/checksums.tmp"
done
echo "==> recorded source checksums in scripts/osrm/checksums.txt (commit this)"

echo
cat "$OUT_DIR/PROVENANCE.txt"
echo
echo "==> done. Start the service with:  docker compose --profile osrm up -d osrm"
echo "    then set WALKING_PROVIDER=osrm in apps/backend/.env"
