"""Local preview server: like `python -m http.server`, but /connect also serves
connect.html, the same way the live server does."""
import http.server
import os
import sys


class Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        full = super().translate_path(path)
        if not os.path.exists(full) and os.path.isfile(full + '.html'):
            return full + '.html'
        return full


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    http.server.ThreadingHTTPServer(('127.0.0.1', port), Handler).serve_forever()
