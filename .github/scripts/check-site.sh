#!/usr/bin/env bash
# Checks a running copy of the site (the Docker image) for broken pages,
# broken local links and images, and missing server settings.
# Usage: .github/scripts/check-site.sh http://localhost:8080
set -u
BASE="${1:-http://localhost:8080}"
cd "$(dirname "$0")/../.."
fail=0

status() { curl -s -o /dev/null -w '%{http_code}' "$1"; }
bad() { echo "FAIL: $*"; fail=1; }

# 1. Every page loads without its .html ending.
for f in *.html; do
  page="${f%.html}"
  [ "$page" = "404" ] && continue
  [ "$page" = "index" ] && page=""
  code=$(status "$BASE/$page")
  [ "$code" = "200" ] || bad "page /$page returned $code"
done

# 2. Every local link, image, stylesheet and script on every page exists.
grep -ohE '(href|src)="[^"]+"' *.html partials/*.html \
  | sed -E 's/^(href|src)="//; s/"$//' \
  | grep -vE '^(https?:|mailto:|tel:|#|data:|javascript:)' \
  | sed -E 's/[#?].*$//; s#^\./##' \
  | sort -u \
  | while read -r link; do
      code=$(status "$BASE/$link")
      [ "$code" = "200" ] || { echo "FAIL: link $link returned $code"; echo x >> /tmp/nh-check-failed; }
    done
[ -f /tmp/nh-check-failed ] && { fail=1; rm -f /tmp/nh-check-failed; }

# 3. The shared header and footer (partials/) are inserted into every page,
#    and the partial files themselves can't be opened directly.
for f in *.html; do
  page="${f%.html}"
  case "$page" in 404|camp-photos*) continue ;; esac
  [ "$page" = "index" ] && page=""
  body=$(curl -s "$BASE/$page")
  echo "$body" | grep -q 'class="site-header"' || bad "page /$page has no header"
  echo "$body" | grep -q 'class="site-footer"' || bad "page /$page has no footer"
  echo "$body" | grep -q '<!--# include' && bad "page /$page still has an unprocessed include"
done
code=$(status "$BASE/partials/header.html")
[ "$code" = "404" ] || bad "/partials/header.html can be opened directly (returned $code)"

# 4. Missing pages get the custom 404 page.
code=$(status "$BASE/no-such-page")
[ "$code" = "404" ] || bad "missing page returned $code, expected 404"
curl -s "$BASE/no-such-page" | grep -q 'Page not found' || bad "missing page did not show 404.html"

# 5. Server settings.
headers=$(curl -sI "$BASE/")
for h in X-Content-Type-Options Referrer-Policy X-Frame-Options; do
  echo "$headers" | grep -qi "^$h:" || bad "header $h missing"
done
echo "$headers" | grep -qi '^Server: nginx/' && bad "nginx version is visible"
for f in nginx.conf README.md Dockerfile; do
  code=$(status "$BASE/$f")
  [ "$code" = "404" ] || bad "/$f is published (returned $code)"
done
code=$(status "$BASE/pictures/source/groupchurch.jpg")
[ "$code" = "404" ] || bad "pictures/source is published (returned $code)"

if [ "$fail" = 0 ]; then echo "All checks passed."; fi
exit "$fail"
