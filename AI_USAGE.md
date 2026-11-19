# AI tools and references

## My contribution

I scoped Switchboard around the needs of a 25-person office. I asked for three sample service statuses with manually recorded check times, a form to report an issue, a persistent request queue with resolution controls, and a layout that works on phones. I specified React and Vite for the interface, Express for the API, and SQLite for local storage.

I directed the design iterations. I supplied the Wiseman logo, asked to use its teal in the status palette, simplified the header and status badges, and chose dark mode as the default. I requested a Reopen action so a request could return to the queue if the problem came back. I also brought Claude’s review findings back to Codex, shared my local test and build output, and requested a versioned migration to preserve existing records when Operational became Up.

## How the design works

When someone submits a request, React sends the form to Express, which validates it before saving it to SQLite. The queue displays the saved record, so its state survives a refresh or server restart. Recording a service check updates its timestamp on the server. Reading the dashboard leaves that timestamp alone because the service checks are manual.

SQLite fits this exercise because the app runs on one host and stores a small amount of data. For staff-only hosting, I’d put the service behind a private VPN. For recovery, I’d take a consistent SQLite snapshot and verify it by restoring a separate copy and checking that the app can read and update requests.

## AI assistance

OpenAI Codex assisted with the original prototype and this revision. It generated the React/Vite scaffolding, dashboard and responsive CSS, Express routes, SQLite initialization, API tests, and drafts of the README, assessment answers and recording outline. The revision keeps the original repository history and sample service checks.

Codex installed the dependencies, built the frontend and ran the API tests. It also exercised the built React interface in a simulated DOM connected to the real Express app and a temporary SQLite file, and ran a local SQLite backup-and-restore drill. A follow-up browser check covered the Wiseman logo, light and dark modes, a phone-width layout, and the saved status and request workflow.

Claude provided a second review of the Node version requirement, dependency warnings, written answers, accessibility, and maintainability. Codex checked the feedback against the project and implemented the follow-up changes.

Technical references used for the implementation and written answers

- [Node.js SQLite API](https://nodejs.org/api/sqlite.html)
- [AWS Client VPN authentication](https://docs.aws.amazon.com/vpn/latest/clientvpn-admin/client-authentication.html) and [authorization rules](https://docs.aws.amazon.com/vpn/latest/clientvpn-admin/cvpn-working-rules.html)
- [AWS security groups for Client VPN access](https://docs.aws.amazon.com/vpn/latest/clientvpn-admin/client-auth-rule-create.html), [S3 gateway endpoints](https://docs.aws.amazon.com/vpc/latest/privatelink/vpc-endpoints-s3.html) and [S3 lifecycle management](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lifecycle-mgmt.html)
- [SQLite online backup API](https://www.sqlite.org/backup.html) and [integrity checks](https://www.sqlite.org/pragma.html#pragma_integrity_check)
- [Route 53 private hosted zones](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/hosted-zones-private.html), [Session Manager](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager.html) and [Patch Manager prerequisites](https://docs.aws.amazon.com/systems-manager/latest/userguide/patch-manager-prerequisites.html)
