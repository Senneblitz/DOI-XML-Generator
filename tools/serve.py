"""Startet den lokalen Webserver für den DataCite Maker und öffnet die Anwendung.

Aufruf normalerweise über start.bat, direkt geht auch:  python tools/serve.py [Port] [--no-browser]

Der Port wird automatisch gewählt, falls der Standardport belegt ist. Ohne Argument
werden 8123 bis 8127 durchprobiert.
"""

from __future__ import annotations

import mimetypes
import os
import socket
import sys
import threading
import webbrowser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORTS = (8123, 8124, 8125, 8126, 8127)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Windows leitet MIME-Typen aus der Registry ab; dort steht für .js gelegentlich
# text/plain, womit der Browser ES-Module ablehnt. Deshalb hier fest setzen.
for extension, mime in (
    (".js", "text/javascript"),
    (".mjs", "text/javascript"),
    (".json", "application/json"),
    (".wasm", "application/wasm"),
    (".css", "text/css"),
    (".xml", "application/xml"),
    (".xsd", "application/xml"),
):
    mimetypes.add_type(mime, extension)


class Handler(SimpleHTTPRequestHandler):
    """Wie SimpleHTTPRequestHandler, aber ohne Caching.

    Sonst hält der Browser ES-Module aus einer früheren Sitzung fest, und Änderungen
    am Code wirken sich erst nach manuellem Leeren des Caches aus.
    """

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()


def free_port(candidates: tuple[int, ...]) -> int | None:
    """Erster Port, auf dem nichts lauscht."""
    for port in candidates:
        with socket.socket() as probe:
            probe.settimeout(0.3)
            if probe.connect_ex(("127.0.0.1", port)) != 0:
                return port
    return None


def main() -> int:
    if not os.path.exists(os.path.join(ROOT, "index.html")):
        print(f"FEHLER: index.html fehlt in {ROOT}.")
        return 1

    args = [a for a in sys.argv[1:] if a != "--no-browser"]
    open_browser = "--no-browser" not in sys.argv
    wanted = (int(args[0]),) if args else PORTS
    port = free_port(wanted)
    if port is None:
        print(f"FEHLER: Die Ports {wanted[0]} bis {wanted[-1]} sind alle belegt.")
        return 1

    url = f"http://localhost:{port}/"
    handler = partial(Handler, directory=ROOT)
    server = ThreadingHTTPServer(("127.0.0.1", port), handler)

    print()
    print("  DataCite Maker")
    print("  --------------")
    print(f"  Adresse: {url}")
    print(f"  Ordner:  {ROOT}")
    print()
    print("  Dieses Fenster offen lassen. Zum Beenden schließen oder Strg+C drücken.")
    print()
    sys.stdout.flush()

    if open_browser:
        threading.Timer(0.7, webbrowser.open, args=(url,)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer beendet.")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
