# Office Status — written answers

## Hosting

I’d run the app on a small Amazon EC2 instance in a private VPC subnet with an encrypted EBS volume for SQLite. The instance would have no public IP. I’d put an internal Application Load Balancer in front of it for HTTPS and give the page a name in a Route 53 private hosted zone. The instance’s security group would accept app traffic only from the load balancer’s security group.

Staff would connect using AWS Client VPN, authenticated through the company’s identity provider with MFA. I’d limit VPN authorization to the staff group and give clients access to the private DNS resolver and app subnets. The load balancer would allow HTTPS only from the VPN security group. I’d test that a staff account can reach the page on the VPN and that an outside device and an account outside the staff group cannot. If the VPN being monitored is also the only way in, staff need a separate way to report an outage, such as the IT phone line.

## Backup

I’d schedule a nightly SQLite online backup so the app can stay running while a consistent snapshot is made. I’d upload each snapshot to a private, encrypted, versioned S3 bucket with 30 days of retention and alert IT if the job fails or the latest backup is more than a day old. A nightly schedule means up to 24 hours of new requests or updates could be lost.

Once a month I’d download a backup into a separate test directory and run SQLite’s `PRAGMA integrity_check`. Then I’d start the app with `--db` pointing at the restored copy. I’d check the request count against the backup’s recorded count, confirm a known open and resolved request survived, and submit and resolve a test request to verify the copy is writable. I’d record how long the restore took and fix any gaps before the next drill.

## Support

> Hi, thanks for letting me know. I’ll check whether the VPN is affecting other people too. Can you open a regular website and tell me what happens when you try to connect to the VPN? If there’s an error, please send the text and the time it happened. Let me know which task is blocked so I can check for a workaround. I’ll update you in 15 minutes.

1. Check for other reports and planned maintenance. Check the VPN service from a known-good connection to see how widespread the problem is.
2. Confirm the employee’s device can reach the internet. Use their error message and timestamp to check VPN and sign-in logs.
3. If it affects one person, check their account and MFA, then the VPN client and profile. If it affects several people, check gateway health and recent network or identity changes, then escalate and send a status update.
