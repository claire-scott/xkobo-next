#!/usr/bin/env python3
"""Tiny dev server. Serves this folder and prints LAN URLs so you can try it on a phone.

    python3 serve.py [port]
"""
import functools, http.server, socket, sys

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000

class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      '.js': 'text/javascript', '.webmanifest': 'application/manifest+json'}
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')   # always fresh while developing
        super().end_headers()

def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1)); return s.getsockname()[0]
    except OSError:
        return None
    finally:
        s.close()

httpd = http.server.ThreadingHTTPServer(('0.0.0.0', port), Handler)
print(f'XKOBO Mobile\n  this computer: http://localhost:{port}/')
ip = lan_ip()
if ip: print(f'  your phone:    http://{ip}:{port}/   (same Wi-Fi)')
try:
    httpd.serve_forever()
except KeyboardInterrupt:
    print()
