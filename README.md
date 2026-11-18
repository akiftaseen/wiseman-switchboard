# Office Status

A local dashboard for checking the sample status of Email, VPN, and File share and managing IT support requests. Built with HTML, CSS, plain JavaScript, and Python’s standard library.

## Run locally

Requirements: Git and Python 3.11 or newer. No package installation is needed.

1. Clone this repository and open its directory.
2. Run `python3 server.py` (or `py -3 server.py` on Windows).
3. Open [http://127.0.0.1:8000](http://127.0.0.1:8000). Press Ctrl+C in the terminal to stop the server.

If port 8000 is taken, run `python3 server.py --port 8765` and open [http://127.0.0.1:8765](http://127.0.0.1:8765).

## Try it

- **Change a service status.** Edit its `status` in [data/services.json](data/services.json) to `Up`, `Degraded`, or `Down`. Update its `checked_at` to an ISO 8601 timestamp with a time zone, such as `2026-11-18T09:45:00Z`. Save the file and click **Refresh**. The page shows times in your browser’s time zone. The app reads sample data from this file and makes no calls to company services.
- **Report and resolve an issue.** Enter a name, issue type, and description. Submit it, then click **Mark resolved** on the saved request. Reload the page or restart the server to verify the request and its resolution are still there.

## Project files

| File | Purpose |
| --- | --- |
| `public/index.html` | Dashboard, request form, and templates |
| `public/styles.css` | Responsive layout and status styles |
| `public/app.js` | Loads data, submits requests, and updates the list |
| `server.py` | Serves the page and JSON endpoints, validates input, and writes to SQLite |
| `data/services.json` | Editable sample statuses and check times |

The server creates `data/requests.sqlite3` on first run. The database is ignored by Git. Use `--db PATH` to try the app with a separate database or open a restored copy.

The server binds to localhost and the demo has no login. See [written answers](WRITTEN-ANSWERS.md) for a proposed staff-only setup and backup plan, and [AI and references](AI-AND-REFERENCES.md) for tool use.
