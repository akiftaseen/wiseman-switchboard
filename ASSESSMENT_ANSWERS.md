# Hosting, backup and support

## 1. Hosting for staff on AWS

I’d run Express and the built React app on one EC2 instance in a private subnet, with SQLite on an encrypted EBS volume. The EC2 instance would have no public IP or public load balancer. A reverse proxy would serve HTTPS using a certificate from the company’s internal CA, trusted by managed devices, and forward requests to Express on localhost.

Staff would sign in to AWS Client VPN with their company identity and MFA. A VPN authorization rule would grant the staff group access, and the instance security group would accept HTTPS only from the VPN endpoint’s security group. Route 53 private DNS, resolved through the VPN, would give staff a friendly address. I’d test access as staff, off the VPN, and with an account outside the staff group. If the VPN fails, I’d post updates in company chat or email that staff can reach without it.

I’d manage the server through AWS Systems Manager Session Manager with no inbound SSH. I’d schedule OS patching through Patch Manager and give the instance outbound access to approved package repositories through a NAT gateway.

## 2. Backing up and proving recovery

Every night, I’d use the SQLite CLI’s `.backup` command to create a consistent snapshot while the app runs. A scheduled job would upload it over TLS to a private, encrypted S3 bucket through an S3 gateway endpoint. The job’s role could upload snapshots. Designated IT staff could retrieve them. S3 would expire backups after 30 days, and a missed job would alert IT. Successful nightly backups limit potential data loss to one day’s changes.

Once a month, I’d restore a snapshot to a separate directory, check its SHA-256 checksum against the value recorded at backup time, and run `PRAGMA integrity_check`. I’d start a temporary app pointed at the restored file and compare the queue’s request count and newest ID with the snapshot records. Then I’d create and resolve a test request and restart the app to confirm it persisted. I’d record the result and how long the restore took.

## 3. When an employee reports a VPN problem

> Hi, thanks for letting me know. I understand this is blocking your work. Can you open a regular website? What message do you see when you try to connect, and when did it last work? If company webmail is available to you, you can use it in the meantime. I’ll check whether others are affected and update you within 15 minutes. I’m happy to jump on a quick call if that helps.

1. Check recent reports and try connecting from another device and network. Check when the dashboard status was last updated.
2. Find where the connection stops. Check internet access, the sign-in error, account access and whether the verification prompt appeared. Never request a password or verification code.
3. If the VPN connects, test the specific internal service and DNS. If several people are affected, check gateway health, sign-in logs and recent changes. Escalate with timestamps and symptoms, then send the promised update.
