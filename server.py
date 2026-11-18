"""Serve the local status dashboard and persist support requests."""
import argparse
from contextlib import closing
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import re
import sqlite3

ROOT = Path(__file__).resolve().parent
SERVICE_FILE = ROOT / "data" / "services.json"
STATUSES = {"Up", "Degraded", "Down"}
ISSUE_TYPES = {"Email", "VPN", "File share", "Other"}
MAX_BODY = 16_384

ASSETS = {
    "/": ("index.html", "text/html; charset=utf-8"),
    "/styles.css": ("styles.css", "text/css; charset=utf-8"),
    "/app.js": ("app.js", "text/javascript; charset=utf-8"),
}


def connect(path):
    db = sqlite3.connect(path)
    db.row_factory = sqlite3.Row
    return db


def initialize(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with closing(connect(path)) as db, db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS requests (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                issue_type TEXT NOT NULL,
                description TEXT NOT NULL,
                created_at TEXT NOT NULL,
                resolved_at TEXT
            )
        """)


def utc_now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def load_services():
    services = json.loads(SERVICE_FILE.read_text(encoding="utf-8"))
    for service in services:
        if service["status"] not in STATUSES:
            raise ValueError("Unknown service status")
        if datetime.fromisoformat(service["checked_at"]).utcoffset() is None:
            raise ValueError("Service timestamps must include a time zone")
    return services


class StatusHandler(BaseHTTPRequestHandler):
    def send_content(self, status, content_type, body):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def send_json(self, status, data):
        self.send_content(status, "application/json; charset=utf-8", json.dumps(data).encode())

    def problem(self, status, message):
        self.send_json(status, {"error": message})

    def database_error(self, error):
        self.log_error("Database error: %s", error)
        self.problem(HTTPStatus.INTERNAL_SERVER_ERROR, "Request storage is unavailable.")

    def do_GET(self):
        if self.path in ASSETS:
            filename, content_type = ASSETS[self.path]
            self.send_content(HTTPStatus.OK, content_type, (ROOT / "public" / filename).read_bytes())
        elif self.path == "/api/services":
            try:
                services = load_services()
            except (OSError, ValueError, KeyError, TypeError) as error:
                self.log_error("Sample status data error: %s", error)
                self.problem(HTTPStatus.INTERNAL_SERVER_ERROR, "Service statuses are unavailable.")
                return
            self.send_json(HTTPStatus.OK, services)
        elif self.path == "/api/requests":
            try:
                with closing(connect(self.server.db_path)) as db:
                    requests = db.execute("SELECT * FROM requests ORDER BY id DESC").fetchall()
            except sqlite3.Error as error:
                self.database_error(error)
                return
            self.send_json(HTTPStatus.OK, [dict(row) for row in requests])
        else:
            self.problem(HTTPStatus.NOT_FOUND, "Page not found.")

    def do_POST(self):
        if self.path != "/api/requests":
            self.problem(HTTPStatus.NOT_FOUND, "Page not found.")
            return
        if self.headers.get_content_type() != "application/json":
            self.problem(HTTPStatus.UNSUPPORTED_MEDIA_TYPE, "Send a JSON request.")
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length > MAX_BODY:
                self.problem(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, "This request is too large.")
                return
            if length <= 0:
                raise ValueError("Missing request body")
            data = json.loads(self.rfile.read(length))
            if not isinstance(data, dict):
                raise ValueError("Expected a JSON object")
        except (ValueError, RecursionError):
            self.problem(HTTPStatus.BAD_REQUEST, "Send a valid JSON object.")
            return

        name = data.get("name")
        issue_type = data.get("issue_type")
        description = data.get("description")
        if not isinstance(name, str) or not 1 <= len(name.strip()) <= 80:
            self.problem(HTTPStatus.BAD_REQUEST, "Enter a name up to 80 characters.")
            return
        if not isinstance(issue_type, str) or issue_type not in ISSUE_TYPES:
            self.problem(HTTPStatus.BAD_REQUEST, "Choose a valid issue type.")
            return
        if not isinstance(description, str) or not 1 <= len(description.strip()) <= 1000:
            self.problem(HTTPStatus.BAD_REQUEST, "Enter a description up to 1,000 characters.")
            return
        try:
            name = name.strip()
            description = description.strip()
            name.encode("utf-8")
            description.encode("utf-8")
        except UnicodeEncodeError:
            self.problem(HTTPStatus.BAD_REQUEST, "Enter valid text.")
            return

        try:
            with closing(connect(self.server.db_path)) as db, db:
                result = db.execute(
                    """INSERT INTO requests (name, issue_type, description, created_at)
                       VALUES (?, ?, ?, ?)""",
                    (name, issue_type, description, utc_now()),
                )
                request = db.execute("SELECT * FROM requests WHERE id = ?", (result.lastrowid,)).fetchone()
        except sqlite3.Error as error:
            self.database_error(error)
            return
        self.send_json(HTTPStatus.CREATED, dict(request))

    def do_PATCH(self):
        match = re.fullmatch(r"/api/requests/([1-9][0-9]{0,18})/resolve", self.path)
        if not match or int(match[1]) > 2**63 - 1:
            self.problem(HTTPStatus.NOT_FOUND, "Request not found.")
            return
        request_id = int(match[1])
        try:
            with closing(connect(self.server.db_path)) as db, db:
                db.execute(
                    "UPDATE requests SET resolved_at = ? WHERE id = ? AND resolved_at IS NULL",
                    (utc_now(), request_id),
                )
                request = db.execute("SELECT * FROM requests WHERE id = ?", (request_id,)).fetchone()
        except sqlite3.Error as error:
            self.database_error(error)
            return
        if request is None:
            self.problem(HTTPStatus.NOT_FOUND, "Request not found.")
            return
        self.send_json(HTTPStatus.OK, dict(request))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--db", type=Path, default=ROOT / "data" / "requests.sqlite3")
    args = parser.parse_args()
    initialize(args.db)
    with ThreadingHTTPServer(("127.0.0.1", args.port), StatusHandler) as server:
        server.db_path = args.db
        print(f"Office Status running at http://127.0.0.1:{server.server_port}", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
