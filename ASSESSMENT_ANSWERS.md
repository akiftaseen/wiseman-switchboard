# Hosting, backup and support

## 1. Hosting for staff on AWS

I’d run the application on one small EC2 instance in a private VPC subnet, with SQLite on an encrypted EBS volume. Express can serve the built React files and the API together. A reverse proxy on the same instance would accept HTTPS on its private address and forward requests to Express on localhost. The instance would have no public IP, public load balancer or inbound internet route.

Employees would connect through AWS Client VPN using their company identity and MFA. A VPN authorization rule would grant the staff group access to the application address. The instance security group would allow port 443 only from the VPN endpoint’s security group. I’d verify that a staff laptop can open the page on VPN and loses access after disconnecting. An account outside the staff group should also fail. A single host keeps operations simple for 25 people, with downtime during host maintenance as the trade-off.

## 2. Backing up and proving recovery

Each night I’d use SQLite’s online backup mechanism through the CLI command `.backup` to create a consistent snapshot while the app is running. I’d record its SHA-256 checksum, request count and newest request ID, all taken from that snapshot. A scheduled job would upload it over TLS through an S3 gateway endpoint to a private, encrypted S3 bucket. I’d restrict the instance role to writing backups, give restore access to designated IT staff, and expire dated snapshots after 30 days. A missed nightly backup would alert IT. With successful nightly jobs, up to one day of changes could be lost.

Monthly, I’d download a backup into a separate directory, compare its checksum, and run `PRAGMA integrity_check;`. Then I’d start a disposable app using that file, compare the queue with the saved count and ID, and create and resolve a test request. I’d reopen the restored database and confirm the resolution survived. I’d record the result and elapsed time so the team knows how long recovery takes.

## 3. When an employee reports a VPN problem

> Hi, thanks for letting me know. I understand this is blocking your work. Can you open an ordinary website, and what message do you see when you try to connect to the VPN? When did it last work? I’ll check whether anyone else is affected and update you here within 15 minutes.

1. Check recent reports, then try a connection from a separate device and network. The dashboard’s manual status is a clue, and the timestamp tells me how old it is.
2. Find where the connection stops. Check local internet access, the VPN sign-in message, account access and whether the MFA prompt arrived. Never ask for a password or verification code.
3. If the VPN connects, test the specific internal service and its DNS name. If several people cannot connect, check gateway health, authentication logs and recent changes. Escalate with timestamps and symptoms, then send the employee the promised update.
