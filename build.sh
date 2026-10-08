#!/usr/bin/env bash
# Build every talk in talks/ in both themes and make an index page.
#
#   ./build.sh                         -> all talks, HTML
#   ./build.sh pdf                     -> all talks, PDF (needs Chrome)
#   ./build.sh all                     -> all talks, HTML + PDF
#   ./build.sh html 2026-10-20-tamachi-go   -> one talk only
#
# Output:
#   dist/index.html                    list of all talks
#   dist/<talk>/light.html, navy.html  (and .pdf)
#
# Folders starting with "_" (_template, _shared) are not built as talks.
# Run `npm ci` once first so the local Marp CLI is installed.
set -euo pipefail

FORMAT="${1:-html}"
ONLY="${2:-}"
MARP="./node_modules/.bin/marp"
THEMES=(ainews-light ainews-navy)

if [ ! -x "$MARP" ]; then
  echo "Marp CLI not found. Run: npm ci" >&2
  exit 1
fi

case "$FORMAT" in
  html) FORMATS=(html) ;;
  pdf)  FORMATS=(pdf) ;;
  all)  FORMATS=(html pdf) ;;
  *) echo "Unknown format: $FORMAT (use html, pdf or all)" >&2; exit 1 ;;
esac

mkdir -p dist
[ -d talks/_shared ] && rm -rf dist/_shared && cp -r talks/_shared dist/_shared

build_talk() {
  local dir="$1" name out
  name="$(basename "$dir")"
  out="dist/$name"
  mkdir -p "$out"
  [ -d "$dir/img" ] && rm -rf "$out/img" && cp -r "$dir/img" "$out/img"
  for theme in "${THEMES[@]}"; do
    for fmt in "${FORMATS[@]}"; do
      "$MARP" "$dir/slides.md" \
        --theme-set ./themes \
        --theme "$theme" \
        --html \
        --allow-local-files \
        "--$fmt" \
        -o "$out/${theme#ainews-}.$fmt"
    done
  done
}

for dir in talks/*/; do
  dir="${dir%/}"
  name="$(basename "$dir")"
  [[ "$name" == _* ]] && continue
  [ -f "$dir/slides.md" ] || continue
  [ -n "$ONLY" ] && [ "$name" != "$ONLY" ] && continue
  build_talk "$dir"
done

# Index page: newest talk first, title taken from the first "# " heading
{
  cat <<'HTML'
<!doctype html>
<html lang="ja">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Slides — 0hJonny</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=Noto+Sans+JP:wght@400;700&family=JetBrains+Mono&display=swap">
<style>
  :root { --bg:#fff; --text:#1a1a1a; --muted:#667085; --accent:#6941c6; --pill-bg:#ede9fe; --pill-text:#5b21b6; --line:#e4e4e7; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#090d1f; --text:#fff; --muted:#c0c5d0; --accent:#9365ff; --pill-bg:#2a2350; --pill-text:#c4b5fd; --line:#2b3150; }
  }
  body { background:var(--bg); color:var(--text); font-family:Inter,'Noto Sans JP',sans-serif; max-width:760px; margin:64px auto; padding:0 16px; }
  h1 { font-weight:800; margin:0 0 32px; }
  .talk { padding:20px 0; border-bottom:1px solid var(--line); }
  .date { font-family:'JetBrains Mono',monospace; font-size:14px; color:var(--muted); }
  .title { font-size:20px; font-weight:700; margin:4px 0 10px; }
  a.pill { display:inline-block; background:var(--pill-bg); color:var(--pill-text); border-radius:999px; padding:2px 14px; margin:0 6px 6px 0; font-size:14px; font-weight:600; text-decoration:none; }
</style>
<h1>Slides</h1>
HTML
  for dir in $(ls -d talks/*/ | sort -r); do
    dir="${dir%/}"
    name="$(basename "$dir")"
    [[ "$name" == _* ]] && continue
    [ -d "dist/$name" ] || continue
    title="$(grep -m1 '^# ' "$dir/slides.md" | sed -e 's/^# //' -e 's/<br>/ /g')"
    date="${name:0:10}"
    echo "<div class=\"talk\"><div class=\"date\">$date</div><div class=\"title\">$title</div>"
    for f in light.html navy.html light.pdf navy.pdf; do
      [ -f "dist/$name/$f" ] && echo "<a class=\"pill\" href=\"$name/$f\">$f</a>"
    done
    echo "</div>"
  done
} > dist/index.html

echo "Built into dist/:"
find dist -maxdepth 2 -type f -not -path 'dist/*/img/*' | sort
