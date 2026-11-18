# Switchboard technical specification

Switchboard is a local IT service desk for a 25-person office. The dashboard shows the last manually recorded check for Email, VPN and File Share. Employees can submit an issue and see it progress through a shared request queue. The application works offline once dependencies are installed. It uses sample data and makes no calls to company systems.

## Application boundaries

- The dashboard shows Up, Degraded and Down. A fresh database starts with Email and File Share Up and VPN Degraded. The initial timestamps are fixed sample times. A person can record another check without changing the status. The saved timestamp is the time the server received that update.
- A request has an integer ID, employee name, issue type, description, timestamp and state. The queue shows the latest requests first. A new request is Open. Resolving it changes its state to Resolved. Reopening it restores Open. The three filters use the same saved records.
- The interface supports light and dark appearance, keyboard navigation and a stacked phone-width layout. A saved theme is a browser preference. SQLite is the source of truth for the service checks and requests.
- The assessment runs on loopback. It has a shared queue, no login, no real monitoring, no check history and no real-time updates between tabs. Other users' changes become visible on reload. The private hosting and backup procedures in the written assessment are proposals.

## How the pieces work together

1. In development, Vite serves React and forwards relative `/api` requests to Express. In the local built application, Express serves both the API and Vite's generated `dist/` files. In either case the browser uses the same relative URL. The frontend never opens the SQLite file.
2. At startup, Express receives an open database and prepares its SQL once. When React mounts, it loads services and requests independently. Each section can display loading, failure and retry information.
3. For a service check, the dialog sends the selected status by PATCH. Express validates it, supplies the current UTC timestamp and updates one row. The database returns that row. React replaces the previous service with it and recomputes the totals and summary.
4. For a new request, the form applies the shared field rules and posts JSON. The server validates again, trims the name and description and inserts the record. React adds the saved row to the top, selects All, clears the successful draft and announces the request ID. Failed submissions keep the draft.
5. For resolution or reopening, the queue sends the desired final state. The API updates and returns the row. React replaces that row without changing its creation time. A selected filter may hide the row after the change. If focus was on that action, the queue moves it to the active filter before the row disappears.
6. Reloading the browser fetches the same records from SQLite. Restarting the server reopens the existing file. The theme toggle saves its preference separately in local storage.

## HTTP and storage contract

| Endpoint | Input | Success |
| --- | --- | --- |
| GET /api/services | None | 200 with service objects containing `id`, `name`, `status` and `checkedAt` |
| PATCH /api/services/:id | `status` chosen from Up, Degraded or Down | 200 with the saved service |
| GET /api/requests | None | 200 with request objects containing `id`, `name`, `issueType`, `description`, `createdAt` and `state` |
| POST /api/requests | `name`, `issueType` and `description` | 201 with the saved Open request |
| PATCH /api/requests/:id | `state` set to Open or Resolved | 200 with the saved request |

API writes accept uncompressed JSON with a 32 KB parser limit. Names accept up to 80 characters and descriptions up to 2,000 after trimming. Issue types are Email, VPN, File Share, Hardware and Other. Invalid input returns 400, absent resources or API routes 404, oversized JSON 413, unsupported content type or encoding 415 and unhandled errors 500. The JSON body includes `error` and may include `fields` keyed by form field. API responses set `Cache-Control: no-store`. The backend rejects request IDs outside the positive JavaScript safe integer range.

SQLite constrains allowed status and request state values. Service IDs are text primary keys, and SQLite assigns integer request IDs when inserting. Record timestamps use UTC ISO strings for storage and chronological sorting. The requests query sorts descending by creation time, then descending by ID to break ties. Write parameters are passed separately from SQL. `RETURNING *` lets the frontend render the saved record, including server-generated fields.

### Existing database upgrade

The previous service table allowed the value Operational through a CHECK constraint. At startup, `initializeServices()` examines the stored table definition. A database with that constraint gets a replacement service table in one transaction. The copy maps Operational to Up, keeps IDs, names, row order and check times, and leaves the request table intact. It then inserts any missing built-in service rows and commits. Failure rolls back the service transaction. Subsequent starts skip the conversion. The local checkout's demo data was reset separately from this migration. Regular starts preserve saved records.

## File-by-file walkthrough

### Root files and assets

- **`.gitignore`** excludes installed packages, generated frontend files, local database and journal files, environment files, logs and desktop metadata. A reviewer recreates the generated files locally.
- **`.nvmrc`** selects the Node 24 major in nvm. The supported minimum in the package manifest is Node 22.13 because the backend imports built-in `node:sqlite`. SQLite can emit an experimental warning on some supported releases.
- **`package.json`** declares the Node requirement, ES module mode and four commands. `npm run dev` runs Vite, `npm start` opens the Express server, `npm run build` generates `dist/` and `npm test` runs the built-in Node test runner. React and React DOM render the UI, Express handles HTTP, Lucide supplies icons and Vite handles development and bundling.
- **`package-lock.json`** records resolved direct and transitive dependencies and their integrity metadata. Commit it when dependencies change. `npm ci` installs the recorded versions.
- **`vite.config.js`** uses the automatic JSX transform and starts Vite on loopback port 5173. `strictPort` reports an occupied port instead of moving silently. The API proxy targets loopback port 3001 or the supplied `PORT`.
- **`index.html`** supplies the document language, viewport, title, favicon, React mount element and module entry. Vite uses this file as the build entry.
- **`public/wiseman.svg`** is the transparent Wiseman brand asset used by the header and favicon. Vite serves public assets by their root-relative URL and copies them to the build output.

### Shared rules and backend

- **`shared/domain.js`** exports the canonical choices, constants for named states and character limits. `requestErrors()` produces a map with one message for each invalid field. The browser can use it immediately and the server enforces it independently. The SQLite schema also uses the status and state choices.
- **`server/index.js`** is the process entry point. It opens SQLite, gives it to `createApp()`, listens on `127.0.0.1` and uses `PORT` or 3001. It closes the database if listening fails, and stops accepting connections before closing the file on SIGINT or SIGTERM.
- **`server/db.js`** resolves the default database path relative to the module and accepts a `DB_PATH` override. `openDatabase()` creates the containing directory, sets a three-second busy timeout, enables WAL where supported, creates the request table and initializes the services. `initializeServices()` owns the transaction, seed checks and legacy upgrade. `prepareQueries()` groups the five reusable list or write statements.
- **`server/app.js`** exports `createApp(db)` so production startup and tests use the same routing. API middleware handles content type, cache policy and JSON parsing before the handlers. Each handler validates its input, calls the corresponding prepared statement and sends its result. An API fallback returns JSON for unknown routes. The static handler serves `dist/`. The final error handler translates parser failures and logs unexpected errors while returning a generic 500 to the browser.

### React entry, data and display helpers

- **`src/main.jsx`** imports the global stylesheet and mounts `App` into the HTML root.
- **`src/App.jsx`** lays out the branded header and theme button, service section and two support panels. Its `useCollection()` hook loads a collection, tracks loading and error state, retries on demand and ignores stale effect callbacks. `LoadState` renders the status or the retry control. `App` owns the loaded rows and queue filter so the form and queue can update the same list. Saving a service or changing request state replaces the row from the server. The form waits for queue initialization to avoid an initial fetch overwriting a newly added row. If the fetch fails, the queue offers Retry.
- **`src/api.js`** exposes a small wrapper around `fetch()`. It prefixes paths with `/api/`, sets the JSON header for writes, parses the response and turns network or API failures into errors. A validation error carries the server's field map.
- **`src/format.js`** formats the UTC strings with `Intl.DateTimeFormat` in the viewer's local timezone and locale. `ticketId()` displays an integer such as `1` as `REQ-001`. The prefix and padding are display formatting. The API uses the underlying integer.

### React components

- **`src/components/Services.jsx`** counts the saved status values, describes affected services, renders the overview ribbons and lists `ServiceCard` instances. `ServiceCard` shows a service name, icon, status, check time and action. Known IDs have specific icons and descriptions. A row with an unfamiliar ID uses a generic icon. `Services` tracks which service is being edited and reports a successful check beside the service section.
- **`src/components/CheckDialog.jsx`** opens a native modal with `showModal()` and uses the saved status as the initial select value. Native dialog focus handling keeps interaction in the modal. The cancel event and the close buttons honor the pending save state. A failed PATCH displays the error and leaves the dialog open. A successful PATCH tells the parent to update the service and close the dialog.
- **`src/components/RequestForm.jsx`** holds the three controlled inputs, their validation messages and pending state. It associates each invalid input with its message and focuses the first invalid field on client validation failure. The submit flow uses the shared validation and then the API. On success it passes the returned record upward, resets fields and announces the ID. On failure it preserves the draft and displays the error.
- **`src/components/RequestQueue.jsx`** has explicit props for loading content, filter state and row updates. It derives filters from the shared request states. Each `RequestItem` shows the request's details and calls PATCH for Resolve or Reopen. A pending action stays focusable with `aria-disabled` and a handler guard, so the queue can move focus to the active filter if the row is about to disappear. Row failures are shown near the button. Queue-level success text is announced in a live region within the queue, including when a filter is empty.
- **`src/components/Badge.jsx`** gives statuses and states a consistent text treatment. It derives a CSS modifier from the value. The CSS uses green for Up, amber for Degraded, red for Down and distinct styling for requests. The displayed text carries the same meaning as the color.
- **`src/components/ThemeToggle.jsx`** reads a saved light or dark preference and otherwise follows the device's initial color-scheme preference. React applies `data-theme` on the root and the toggle writes the new value to local storage where available. The button names the mode it will switch to. Theme initialization runs when React starts, so the first page paint can precede that choice on slow loads.
- **`src/styles.css`** declares theme tokens for surfaces, text, borders and status colors, with dark variants under `data-theme="dark"`. Three sizing tokens define the type scale, reused through headings, counts, controls and metadata. The layout keeps the overview ribbons and status cards aligned on desktop and reflows at smaller widths. The form precedes the queue on phones. Buttons share interaction styling and the submit variant supplies the neutral action color. Empty feedback regions are removed from normal layout while remaining mounted for assistive technology. Focus outlines and text labels make actions and states readable independently of color.

### Tests and assessment documents

- **`tests/api.test.js`** uses real temporary SQLite files and the real Express app. It checks seed rows and timestamps, persisting a manual check, request ordering and resolve/reopen across simulated restarts, invalid fields, invalid JSON and transport metadata, missing resources and the migration from the legacy schema. Test cleanup closes the DB and deletes the temporary folder.
- **`tests/http.js`** exposes `send(server, path, options)`. It connects a pair of in-memory streams to Node's HTTP client and server so tests exercise the real parser without reserving a port. Options specify the method, body, content type and extra headers. The helper collects the response and returns status, headers and decoded data.
- **`README.md`** provides setup, start and build commands, a workflow walkthrough, the API summary and the repository guide. It is the entry point for a reviewer running the project.
- **`ASSESSMENT_ANSWERS.md`** answers private AWS hosting, consistent SQLite backups with restore verification, and how to respond to an employee reporting a VPN problem. It explains how employees can report VPN trouble if they cannot reach a VPN-only application.
- **`AI_USAGE.md`** describes how Codex and Claude assisted and lists technical references. It attributes verification to the tools that performed it.
- **`DEMO_SCRIPT.md`** is a timed outline for recording the workflow and explaining the React, Express, SQLite, hosting and backup decisions.
- **`INTERVIEW_NOTES.md`** explains the decisions and trade-offs in conversational terms, including SQLite, manual checks and private access.
- **`specification.md`** is this technical walkthrough. Use it as a map when reading source files or comparing the implementation to the hiring brief.

## How to verify the implementation

Run `npm ci`, `npm test` and `npm run build` from a clean checkout. For a fresh interactive run, choose a temporary `DB_PATH` and start Express with `npm start`. Record a check and submit a sample request, reload, resolve it from Open, then find and reopen it under Resolved. Restart the server with that same database path and check the saved rows again. Separately, run with another fresh path to confirm seeding and the empty queue.

Use a phone-width viewport and test keyboard interaction. Verify that the status text stays readable in both themes, invalid input moves focus to its first field and resolution from a filtered queue leaves focus on the active filter. Browser and keyboard checks complement the automated API tests. Actual live announcements can be checked with a screen reader such as VoiceOver.
