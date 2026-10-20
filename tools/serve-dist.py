"""Servidor estático de dist/ para las pruebas de Playwright (playwright.config.cjs › webServer).

Hace lo mismo que `python3 -m http.server 4182 --bind 127.0.0.1 -d dist`, pero solo registra las
peticiones que fallan (4xx/5xx). Las correctas, unas 120.000 líneas «[WebServer] GET ... 200» por
ejecución del CI, enterraban el error de la prueba que fallaba: la herramienta que lee el log solo
entrega el final y el mensaje quedaba fuera (sesión 326, 20/10/2026). Los errores de arranque y los
avisos del propio servidor se siguen viendo.

Uso: python3 tools/serve-dist.py [puerto=4182] [carpeta=dist]
"""
import functools
import http.server
import sys


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_request(self, code="-", size="-"):
        try:
            failed = int(code) >= 400
        except (TypeError, ValueError):
            failed = True
        if failed:
            super().log_request(code, size)


class QuietServer(http.server.ThreadingHTTPServer):
    def handle_error(self, request, client_address):
        # El navegador corta una descarga a medias al cambiar de página o al cerrar la prueba: no es un error del servidor.
        if isinstance(sys.exc_info()[1], (BrokenPipeError, ConnectionResetError)):
            return
        super().handle_error(request, client_address)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 4182
    directory = sys.argv[2] if len(sys.argv) > 2 else "dist"
    handler = functools.partial(QuietHandler, directory=directory)
    with QuietServer(("127.0.0.1", port), handler) as server:
        print(f"Sirviendo {directory} en http://127.0.0.1:{port}/ (solo se registran las peticiones que fallan)", flush=True)
        server.serve_forever()


if __name__ == "__main__":
    main()
