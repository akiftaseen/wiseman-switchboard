# Switchboard

A local IT service desk for a 25-person office. Employees can see the last recorded status of Email, VPN and File Share, report a problem, and track it to resolution. The dashboard uses manually maintained sample checks. Opening the page never probes a service.

## Run locally

Use **Node.js 22.13 or later** with npm. Node 24 LTS is recommended and selected by `.nvmrc`. If you use nvm, run `nvm install` and `nvm use` from the repository. SQLite is built into Node. Some Node releases print an experimental SQLite warning during startup.

For the simplest walkthrough, run these commands in one terminal.

```sh
npm ci
npm run build
npm start
```

Open [Switchboard](http://127.0.0.1:3001). Express serves both the built frontend and the API. Press Ctrl+C to stop it. Package installation needs internet access on a fresh machine. The running application works offline.

### Development

After `npm ci`, start the backend with `npm run server`. In a second terminal in the same folder, run `npm run dev`. Open [the Vite development page](http://127.0.0.1:5173). Vite forwards requests under `/api` to Express on port 3001. Restart the backend after changing server code. Vite updates the frontend as you edit.

Both servers bind to 127.0.0.1. To preview the phone layout on the same computer, use your browser’s responsive device mode. Optional environment variables are `PORT` for the API port (give both development terminals the same value) and `DB_PATH` for a separate database file. Defaults work without configuration.

## Try the workflow

After pulling an update, stop the running server with Ctrl+C, then run `npm run build && npm start` to load the latest UI and API.

Use the header appearance button to switch themes. The initial appearance follows your device preference, and your selection is saved in the browser.

1. On a fresh database, Email and File Share are **Operational** (Up) and VPN is **Degraded**. The three tiles include icons, status text and last-checked times. The overview totals reflect the saved records. Click **Record check** on VPN, select **Down** or **Operational** and save. Recording the same status also updates its check time. Refresh and inspect the card.
2. In **New request**, try submitting an empty form to see field-specific guidance. Then enter a sample employee name, choose an issue type and describe the problem. Submit once. Look for the assigned request ID, a cleared form and the new Open request at the top of the queue. Failed saves leave the draft available for retry.
3. A queue item shows its ID, employee, issue type, description, submission time and state. Select **Open**, mark the item resolved, then select **Resolved** to find it again. On a resolved request, choose **Reopen** to move it back to **Open**. Restart Express and reload the page to check persistence. A fresh database starts with an empty queue.
4. Run `npm test` for the six automated API tests. Each uses a disposable database. Coverage includes seeding, same-status checks, validation, ordering, repeated state changes, missing records and persistence after closing and reopening SQLite.

## Implementation

React and Vite build the interface. Plain CSS supplies the responsive grid, focus outlines and text-labelled status colors. Lucide React supplies icons. Express receives JSON requests and uses Node’s built-in SQLite library. No separate database server or native npm SQLite module is required.

On first start, `server/db.js` creates `data/servicedesk.sqlite`. The seed inserts missing service IDs and preserves existing timestamps and statuses. Only submitted requests appear in the queue. UTC timestamps are stored in SQLite and formatted in the viewer’s local time. The database and SQLite’s journal files are excluded from Git.

| Method and route | Input | Successful response |
| --- | --- | --- |
| GET /api/services | — | 200, three service records |
| PATCH /api/services/:id | `{"status":"Operational"}` | 200, saved service and check time |
| GET /api/requests | — | 200, requests newest first, with ID breaking timestamp ties |
| POST /api/requests | `{"name":"Sam","issueType":"VPN","description":"Sign-in stops."}` | 201, saved Open request |
| PATCH /api/requests/:id | `{"state":"Resolved"}` or `{"state":"Open"}` | 200, saved request |

Service IDs are `email`, `vpn` and `file-share`. Status values are Operational, Degraded and Down. Issue types are Email, VPN, File Share, Hardware and Other. The API accepts uncompressed JSON on writes, validates field types and lengths, and returns a JSON `error` message on failure. Invalid request fields also receive a `fields` map. Invalid input returns 400, missing records 404, oversized bodies 413 and unsupported content types 415.

### Project structure

```text
public/wiseman.svg             Supplied Wiseman logo and favicon
src/
  main.jsx, App.jsx            React entry point, dashboard and data loading
  api.js, format.js            API calls, local time and request-ID display
  styles.css                   Responsive layout, controls and status styles
  components/
    Services.jsx               Service cards and status totals
    CheckDialog.jsx            Manual status update form
    RequestForm.jsx            Field validation and submission feedback
    RequestQueue.jsx           Filtered queue and resolution controls
    Badge.jsx                  Shared text and color status indicator
    ThemeToggle.jsx            Saved light/dark appearance preference
shared/domain.js               Statuses, issue types and request validation
server/
  index.js                     Local server startup and shutdown
  app.js                       Express routes and JSON errors
  db.js                        SQLite schema, sample checks and prepared queries
tests/api.test.js, tests/http.js    API tests and in-process HTTP transport
index.html, vite.config.js     HTML entry and development proxy
package.json, package-lock.json    Scripts and dependency versions
.nvmrc, .gitignore             Node version and generated-file exclusions
ASSESSMENT_ANSWERS.md          Private hosting, backups and support response
AI_USAGE.md                    Tools and references
DEMO_SCRIPT.md                 Timed recording outline
INTERVIEW_NOTES.md             Technical decisions and trade-offs
```

### Scope

This is a single-host demonstration with a shared queue and manual updates. Anyone who can reach it can read requests, record checks and resolve issues. Another person’s changes appear on refresh. The database holds the latest service check, with no historical check log. For the proposed staff-only hosting and recovery process, see [the written assessment](ASSESSMENT_ANSWERS.md).
