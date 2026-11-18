# Interview notes

**What happens when I click Submit?** React holds the draft while I type. The form checks it and sends JSON to Express. Express independently validates it, trims surrounding spaces and inserts a row into SQLite. The database assigns an ID. React receives that saved row, adds it to the queue, then clears the form. If the save fails, the draft stays on screen.

**Why use SQLite here?** A small office can keep short requests and three service records in one file on one host. SQLite handles concurrent access and transactions. A single insert or update is atomic. Write-ahead logging allows readers to continue during writes. The Node SQLite calls are synchronous, so long queries would hold up other requests. Here the queries are small. Sustained write contention or multiple app hosts would be reasons to revisit the database choice.

**What makes the timestamps trustworthy?** The server supplies UTC time when it accepts a manual check or new request. The three initial checks are labelled sample data. The browser converts saved times into local time for display. Reading a card leaves its timestamp alone. Saving the same status records a fresh check.

**Why validate twice?** Browser validation helps the employee correct a field immediately. A caller can also use the API directly, so Express must check the input before writing. Both sides import the same rules from `shared/domain.js`. SQL placeholders keep user input separate from the statement.

**What happens if two people edit at once?** The latest saved service check wins. Resolving a request twice gives the same Resolved state. Each new submission creates a separate request. If a connection drops after the server commits, refreshing the queue before retrying helps avoid a duplicate. A larger service could use submission IDs for safe retries.

**Why build React before the demo?** Vite turns the source into browser assets in `dist/`. Express serves those assets and the API from one address. When developing, Vite serves the interface and proxies API calls to Express. This keeps browser code the same in both modes.

**How do the tests demonstrate persistence?** They create a real SQLite file in a temporary directory, make HTTP requests through Express, close SQLite, and reopen the file in a fresh app instance. They check the saved state before cleaning up. An in-process HTTP connection lets the tests run without an available TCP port.

**How would I handle a wider VPN outage?** Check the age of the manual status and get independent evidence from another account or network. If the VPN itself fails, the internal page may also be unreachable. Keep the employee updated through a channel that still works. For recovery, distinguish how much data could be lost (up to a day with nightly backups) from how long restoring takes (measure that in a drill).
