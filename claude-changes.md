# Changes made by Claude

A record of everything Claude (Anthropic, Claude Code) changed in this project, so other assistants such as ChatGPT or Codex can follow along. Paths are relative to the repository root.

> **Current status (2026-11-19): all of Claude's file edits have been reverted.** At the user's request, every file was restored to the version Codex (ChatGPT) left. The revert is the commit "Revert Claude's edits to Codex's versions" on `review-fixes`. See the "Revert" section at the end. Sections 1–7 below describe edits that **no longer exist in the code**. They are kept only as a history.

## Summary

| Item | Value |
| --- | --- |
| Branch created | `review-fixes`, branched from `main` at `7521855` |
| Commit | `1f96234` "Use Up/Degraded/Down statuses and apply review fixes" |
| Commit author | `akiftaseen <akiftaseen@users.noreply.github.com>`, passed with `git -c` for that commit only |
| `main` branch | Not changed. Still at `7521855` |
| Pushed to a remote | No |
| Git config changed | No. No `user.name` or `user.email` was saved |
| Files outside the repo | Only scratch copies in a temporary folder for testing, now unused |

## Session history

1. **First review: read-only.** Read every tracked file and ran `npm test` (6/6 passed). Started a separate server on port 3101 with a scratch database and tested it in a browser on desktop and phone sizes. Changed no project files. The user's own server on port 3001 and `data/servicedesk.sqlite` were not touched.
2. **Second review: read-only.** Re-checked after Codex made uncommitted changes. Ran tests and `npm audit`, built into a scratch folder, and tested on port 3101 with a fresh scratch database. Changed no project files.
3. **Fix and commit.** The user asked Claude to fix the remaining items and commit. All edits below come from this step.

## Important: the commit also contains Codex's work

When Claude began step 3, Codex had already left changes uncommitted. They are in commit `1f96234` together with Claude's edits, because the two sets of edits overlap in the same files. **Claude did not write these Codex changes:**

- `package.json`: Node requirement changed to `>=22.13.0` and Vite updated to `7.3.8`. `package-lock.json` changed to match.
- `server/app.js`: queries moved to `prepareQueries()`, `express.json` gets `inflate: false`, plus layout changes.
- `server/db.js`: the `prepareQueries()` function.
- `src/App.jsx`: `useCollection` rewritten with separate `loading` and `error` state and a `ready` flag. Named handlers `updateService`, `addRequest` and `resolveRequest`. Date formatter moved to `dateLabel`. JSX reformatted.
- `src/components/CheckDialog.jsx`: new file, the dialog split out of `Services.jsx`.
- `src/components/Services.jsx`, `RequestForm.jsx`, `RequestQueue.jsx`, `Badge.jsx`: refactored and reformatted. `setFilter` prop renamed to `onFilterChange`.
- `tests/api.test.js`: gzip/`Content-Encoding` test added. `tests/http.js`: `extraHeaders` parameter added.
- `ASSESSMENT_ANSWERS.md`: hosting, backup and support answers rewritten and expanded.
- `README.md`: Node 22.13+ wording, "uncompressed JSON", `CheckDialog.jsx` added to the file list.
- `AI_USAGE.md`: Route 53, Session Manager and Patch Manager reference links added, plus a first version of the Claude paragraph (Claude later replaced it, see below).
- `DEMO_SCRIPT.md`: the Express and SQLite row updated to mention `prepareQueries`.

## Claude's edits, file by file

### 1. Status renamed from "Operational" to "Up"

The brief asks for Up, Degraded and Down.

- **`shared/domain.js`**: `statuses` changed from `['Operational', 'Degraded', 'Down']` to `['Up', 'Degraded', 'Down']`.
- **`server/db.js`**:
  - The services table definition moved into a `servicesTable` constant. Its CHECK rule is now `('Up','Degraded','Down')`.
  - The PRAGMAs now run in their own `db.exec`. `migrateOperationalToUp(db)` runs next, and then the CREATE TABLE statements.
  - Seed rows for `email` and `file-share` use `'Up'` instead of `'Operational'`.
  - **New function `migrateOperationalToUp(db)`.**
    - It only runs when the existing `services` table's stored SQL contains `'Operational'`. SQLite can't change a CHECK rule in place, so the table has to be rebuilt.
    - Inside a transaction (`BEGIN`, then `COMMIT`, with `ROLLBACK` on error), it renames `services` to `services_old` and creates the new table.
    - It then copies the rows in `rowid` order, changing `Operational` to `Up`, and drops `services_old`.
    - Saved statuses, check times and the `requests` table are kept.
- **`server/app.js`**: the 400 error message changed from "Choose Operational, Degraded, or Down." to "Choose Up, Degraded, or Down."
- **`src/components/Services.jsx`**:
  - `counts` keys changed from `{ Operational, Degraded, Down }` to `{ Up, Degraded, Down }`.
  - The `affected` filter now checks `!== 'Up'`.
  - Heading text changed from "All services operational" to "All services up".
  - Summary text changed from "All three services are marked operational." to "All three services are marked up."
- **`src/styles.css`**: `.dot.operational` became `.dot.up`, and `.badge.operational` became `.badge.up`. The colors are unchanged.
- **`tests/api.test.js`**:
  - Added `import { DatabaseSync } from 'node:sqlite';`.
  - The seed test now expects `['Email', 'Up'], ['VPN', 'Degraded'], ['File Share', 'Up']`.
  - **New test** "upgrades a database that stored Operational to the Up status". It builds an old-style database, opens it with `openDatabase`, and checks that statuses and check times survive the upgrade. It also checks that saving `Up` works afterwards. The suite now has 7 tests.

### 2. Request-resolved message moved into the queue panel

Before, "REQ-00X marked resolved." appeared below both panels, which is off-screen on a phone.

- **`src/App.jsx`**: removed `<div role="status" className="feedback">{notice}</div>` from the bottom of `<main>`. `notice={notice}` is now passed to `<RequestQueue>`.
- **`src/components/RequestQueue.jsx`**:
  - Added the `notice` prop.
  - Added `<div role="status" className="feedback queue-notice">{notice ? <><Check size={15} />{notice}</> : null}</div>` between the filter buttons and the list.
- **`src/styles.css`**: added `.queue-notice:not(:empty) { margin: -5px 0 12px; }`.

### 3. Disabled button cursor

- **`src/styles.css`**: `button:disabled` cursor changed from `wait` to `not-allowed`.

### 4. Prep documents moved out of git

- `DEMO_SCRIPT.md` and `INTERVIEW_NOTES.md` were moved to **`prep-notes/`**. Git records them as deleted from the repository, but the files still exist on disk.
- **`.gitignore`**: added `prep-notes/` at the end.
- **`prep-notes/DEMO_SCRIPT.md`**: "Select Operational and save" changed to "Select Up and save". This file is ignored by git.
- Both files are still in git history, in commits `d8d0a72` and `7521855`. Claude did not rewrite history.

### 5. README.md

- Added a paragraph under "Run locally". It explains that `npm ci` may report a high-severity `picomatch` advisory. The advisory comes from Vite's development tooling, the Express server doesn't load Vite, and npm's only fix is downgrading Vite.
- "Try the workflow":
  - Step 1 now says Email and File Share are **Up**, and the check example uses **Down** or **Up**.
  - Step 3 now mentions that the confirmation appears at the top of the queue.
  - Step 4 now says seven tests and adds "upgrading an older database" to the coverage list.
- Implementation paragraph: added two sentences explaining that older databases stored `Operational` and are upgraded once on startup.
- API table: the PATCH services example is now `{"status":"Up"}`.
- "Status values are Up, Degraded and Down."
- Project structure: removed the `DEMO_SCRIPT.md` and `INTERVIEW_NOTES.md` lines.

### 6. AI_USAGE.md

Replaced the Claude paragraph with an accurate description. Claude reviewed the project against the brief, and Codex then updated the Node requirement, dependencies and written answers. Claude ran the app in desktop and phone-sized browsers, renamed the status to Up with a database upgrade and test, and moved the resolved confirmation into the queue. The paragraph on line 5 about Codex not doing a live browser walkthrough was left unchanged.

### 7. Build output

Ran `npm run build`, which regenerated `dist/` (`index-CvlkewhI.js`, `index-za0aNy0i.css`). `dist/` is ignored by git.

## Checks Claude ran after the edits

- `npm test`: 7 of 7 passed.
- Ran the upgrade on a **copy** of `data/servicedesk.sqlite` in a scratch folder. Statuses, check times and both requests were kept, and the new CHECK rule was in place. The real database file was not opened.
- Ran the built app on port 3101 against a copy of that database:
  - Phone-sized view showed the "Up" badges and "Up" totals.
  - PATCH `Down` returned 200, PATCH `Operational` returned 400, POST of a new request returned 201.
  - Mark resolved showed the message inside the queue.
  - No console errors.
- Afterwards, only the expected references to "Operational" remain: the upgrade code, the upgrade test, the README note and `AI_USAGE.md`.

## Not done, and things to know

- **`data/servicedesk.sqlite` has not been upgraded yet.** It will be upgraded the first time the new server code starts. The user's server on port 3001 was still running the old code. Restart it before use, or saving a status will fail.
- `main` has not been merged. To bring the fixes in: `git switch main`, then `git merge --ff-only review-fixes`.
- Nothing was pushed.
- The two earlier commits are still credited to "OpenAI Codex".
- The `picomatch` audit warning remains. npm's only fix is downgrading Vite.
- `claude-changes.md` (this file) is not committed.

## Revert (2026-11-19)

The user asked Claude to restore every file to the version Codex (ChatGPT) made, because something was broken.

**Cause of the breakage.** The user's server on port 3001 had been running since 23:14 on 2026-11-18, which was older code that stores and accepts only `Operational`. When Claude ran `npm run build`, that running server started serving the new frontend from `dist/`. The new frontend expected `Up`, so the page and status saving stopped matching the server. The database upgrade never ran, because that server was never restarted.

**What was restored.** Each file now matches Codex's version exactly. Claude confirmed this with `git hash-object`, comparing against the file fingerprints recorded before Claude's edits.
- Back to the `7521855` originals, since Codex hadn't changed them: `shared/domain.js`, `src/styles.css`, `.gitignore`, `INTERVIEW_NOTES.md`.
- Back to Codex's uncommitted versions: `server/db.js` (original `openDatabase` plus Codex's `prepareQueries`, with no upgrade code), `server/app.js`, `tests/api.test.js` (keeps Codex's gzip test; Claude's upgrade test is removed), `README.md`, `AI_USAGE.md`, `DEMO_SCRIPT.md`.
- Claude's edits removed from Codex's refactored files: `src/App.jsx` (bottom notice back in place), `src/components/RequestQueue.jsx` (no `notice` prop), `src/components/Services.jsx` (`Operational` wording).
- `DEMO_SCRIPT.md` and `INTERVIEW_NOTES.md` moved back to the repo root and tracked again. The `prep-notes/` folder was removed.
- Codex's own changes were left untouched: `package.json`, `package-lock.json`, `src/components/CheckDialog.jsx`, `RequestForm.jsx`, `Badge.jsx`, `tests/http.js`, `ASSESSMENT_ANSWERS.md`.

**Checks after the revert**
- `npm test`: 6 of 6 passed.
- `npm run build` produced `index-DWGzpqTE.js` and `index-Deu7cjqu.css`. These are the same file names and fingerprints as Codex's earlier build.
- The running app on port 3001 loads with `Operational` labels and correct totals, with no console errors.

**Database.** `data/servicedesk.sqlite` was never changed by Claude. It still uses the `Operational` schema, so nothing needed restoring.

**What remains from Claude.** Only this file and the commit history on `review-fixes`. `main` is still at `7521855`, without Codex's later changes. Nothing was pushed.
