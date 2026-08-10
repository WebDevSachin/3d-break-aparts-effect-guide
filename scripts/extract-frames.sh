#!/usr/bin/env bash
# ============================================================
# extract-frames.sh — turn a product film into a scrub sequence
#
# The exact pipeline from PROMPT.md §3, wrapped as a script:
# extracts ≤ MAX evenly spaced, 1280px-wide JPEGs that main.js
# scrubs on canvas.
#
#   ./scripts/extract-frames.sh media/film.mp4
#   ./scripts/extract-frames.sh my-film.mp4 site/assets/frames 120 1280 4
#
# Rules of thumb baked in below:
#   - ~120 frames is the sweet spot for a 400–500 vh pin. Frames are
#     scroll positions, not playback fps — more frames just means
#     smaller scroll steps between them, at a bandwidth cost.
#   - 1280 px wide is plenty for a full-bleed cover-fit canvas; the
#     motion blur of a tumbling product hides JPEG compression well.
#   - -q:v 4 (2 best … 31 worst) lands ~40–70 KB per frame.
# ============================================================
set -euo pipefail

VIDEO="${1:?usage: extract-frames.sh <video.mp4> [outdir] [maxframes] [width] [quality]}"
OUTDIR="${2:-site/assets/frames}"
MAX="${3:-120}"
WIDTH="${4:-1280}"
QUALITY="${5:-4}"

mkdir -p "$OUTDIR"

DURATION=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$VIDEO")
echo "film: ${DURATION}s → up to $MAX evenly spaced frames"

# fps=MAX/DURATION spaces the picks evenly across the whole clip;
# -frames:v caps the count (fps-filter rounding can emit one extra)
ffmpeg -y -v error -i "$VIDEO" \
  -vf "fps=${MAX}/${DURATION},scale=${WIDTH}:-2" \
  -q:v "$QUALITY" -frames:v "$MAX" -start_number 0 \
  "$OUTDIR/frame_%03d.jpg"

COUNT=$(ls "$OUTDIR"/frame_*.jpg | wc -l)
echo "wrote $COUNT frames to $OUTDIR"
echo "→ if this isn't 120, update FRAME_COUNT in site/main.js to $COUNT"
echo "→ poster: cp $OUTDIR/frame_000.jpg site/assets/img/poster.jpg"
