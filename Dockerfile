FROM nginx:1.29-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf

# Only the website itself is published (not nginx.conf, the README, etc.).
# A new top-level file the site needs has to be added here.
COPY *.html robots.txt sitemap.xml site.webmanifest favicon.ico version.txt /usr/share/nginx/html/
COPY css /usr/share/nginx/html/css
COPY js /usr/share/nginx/html/js
COPY pictures /usr/share/nginx/html/pictures
COPY partials /usr/share/nginx/html/partials

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/ || exit 1
