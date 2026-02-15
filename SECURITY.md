# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Currently supported versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.x.x   | :white_check_mark: |

## Reporting a Vulnerability

We take the security of RevealUI seriously. If you discover a security vulnerability, please follow these steps:

### Where to Report

**Please DO NOT report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to: **security@revealui.com**

### What to Include

Please include the following information in your report:

- Type of vulnerability
- Full paths of source file(s) related to the manifestation of the vulnerability
- Location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the vulnerability, including how an attacker might exploit it

### Response Timeline

- We will acknowledge your email within 48 hours
- We will send a more detailed response within 7 days indicating the next steps
- We will work on a fix and coordinate a release timeline with you
- We will notify you when the vulnerability has been fixed

### Disclosure Policy

- Once a fix is released, we will publicly disclose the vulnerability
- We appreciate allowing us time to remediate before public disclosure
- We will credit you for responsible disclosure (unless you prefer to remain anonymous)

### Safe Harbor

We support safe harbor for security researchers who:

- Make a good faith effort to avoid privacy violations, destruction of data, and interruption or degradation of our services
- Only interact with accounts you own or with explicit permission of the account holder
- Do not exploit a security issue you discover for any reason
- Report the vulnerability promptly
- Allow a reasonable time to fix the issue before public disclosure

## Security Best Practices

When using RevealUI, we recommend:

1. **Keep dependencies updated**: Run `pnpm update` regularly
2. **Use environment variables**: Never commit secrets to your repository
3. **Enable CSP headers**: Configure Content Security Policy in your deployment
4. **Use HTTPS**: Always use HTTPS in production
5. **Validate user input**: Use Zod schemas for all user inputs
6. **Enable rate limiting**: Configure rate limits on authentication endpoints
7. **Monitor logs**: Set up monitoring for suspicious activity

## Security Features

RevealUI includes several security features out of the box:

- Input validation with Zod
- CSRF protection (SameSite cookies)
- Secure authentication with session-based auth
- Rate limiting and brute force protection
- Security headers configuration
- Environment variable validation
- SQL injection protection (via Drizzle ORM)

## Questions

If you have questions about this policy, please contact us at security@revealui.com
