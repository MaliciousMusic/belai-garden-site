"""servir.py: the shop's pages served locally for checks, as http.server does, but every answer says Cache-Control:
no-cache, so a browser asks again for every file it holds (a plain http.server sends none, and a browser then keeps
scripts and manifests at its own pace: on 2026-10-26 the frieze showed rebaked clumps under their old boxes).
Cloudflare Pages already asks browsers to check each file again (max-age=0, must-revalidate).

    python public/scene/servir.py <port> <directory> [/prefix=directory ...]

Each extra /prefix=directory serves that directory under /prefix/ besides the root.
"""
import os
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCache(SimpleHTTPRequestHandler):
    mounts = {}

    def translate_path(self, path):
        for prefix, directory in self.mounts.items():
            if path.startswith(prefix + '/'):
                rest = SimpleHTTPRequestHandler.translate_path(self, path[len(prefix):])
                return os.path.join(directory, os.path.relpath(rest, self.directory))
        return super().translate_path(path)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()


if __name__ == '__main__':
    port, root = int(sys.argv[1]), sys.argv[2]
    NoCache.mounts = dict(a.split('=', 1) for a in sys.argv[3:])
    ThreadingHTTPServer(('127.0.0.1', port), partial(NoCache, directory=root)).serve_forever()
