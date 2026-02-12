# Security Policy

## Reporting a Vulnerability

Do not open a public issue for security vulnerabilities.

Use GitHub's private reporting flow for this repository:

1. Open the repository **Security** tab.
2. Click **Report a vulnerability**.
3. Include impact, reproduction steps, and affected version.

If private reporting is unavailable, open a minimal public issue requesting a private contact channel and do not include exploit details.

## What to Include

- Vulnerability description
- Reproduction steps
- Potential impact
- Suggested mitigation (optional)

## Response Targets

- Initial response: within 48 hours
- Ongoing status update: within 7 days
- Fix timeline: depends on severity

## Supported Versions

| Version | Supported |
| --- | --- |
| 0.1.x | Yes |

## Security Principles

- Local-only processing (no remote inference)
- Minimal data retention (settings only in local storage)
- No analytics or telemetry
- Open source for auditability

For implementation details, see [SECURITY_AUDIT.md](SECURITY_AUDIT.md).
