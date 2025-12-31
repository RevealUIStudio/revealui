---
alwaysApply: true
---

# Penetration Testing Guide for RevealUI Framework

## Overview

This guide provides a structured approach to security testing the RevealUI Framework before production deployment.

---

## ⚠️ IMPORTANT: Testing Ethics & Legal

**ONLY perform penetration testing on:**
- Your own systems
- Systems you have explicit written permission to test
- Non-production environments

**DO NOT**:
- Test production without approval
- Perform DoS attacks
- Access data you're not authorized to view
- Share vulnerabilities publicly before they're fixed

---

## Testing Scope

### In-Scope Systems

- CMS Application (`apps/cms`)
- Web Application (`apps/web`)
- API Endpoints (`/api/*`)
- Authentication System
- Payment Processing
- Multi-Tenant Isolation

### Out-of-Scope

- Third-party services (Stripe, Supabase, Vercel)
- Infrastructure provided by cloud vendors
- Other tenants' data (respect isolation)

---

## Testing Categories

### 1. Authentication & Session Management

**Tests to Perform:**

- [ ] **Brute Force Attack**
  - Attempt multiple login failures
  - Verify rate limiting kicks in
  - Check account lockout mechanism

- [ ] **Session Fixation**
  - Verify session ID changes after login
  - Verify fix for GHSA-26rv-h2hf-3fw4

- [ ] **JWT Token Security**
  - Attempt to modify JWT payload
  - Attempt to use expired token
  - Verify token invalidated after logout
  - Check for JWT secrets in error messages

- [ ] **Password Reset**
  - Test password reset token expiration
  - Verify reset tokens are single-use
  - Check for information disclosure

**Tools:**
- Burp Suite
- OWASP ZAP
- Postman/curl

**Example:**
```bash
# Test rate limiting
for i in {1..10}; do
  curl -X POST http://localhost:4000/api/users/login \
    -H "Content-Type: application/json" \
    -d '{"email":"wrong@example.com","password":"wrong"}'
done
# Should receive 429 Too Many Requests after 5 attempts
```

---

### 2. Authorization & Access Control

**Tests to Perform:**

- [ ] **Privilege Escalation**
  - Regular user tries to access admin endpoints
  - Tenant admin tries to access super admin functions
  - Verify role checks enforced

- [ ] **Multi-Tenant Isolation**
  - User from Tenant A tries to access Tenant B's data
  - Modify URL parameters to access other tenant IDs
  - Check for tenant ID in JWT claims

- [ ] **IDOR (Insecure Direct Object Reference)**
  - Access resources by guessing IDs
  - Modify ID parameters in API calls
  - Verify proper authorization checks

**Example:**
```bash
# Try to access another user's data
curl http://localhost:4000/api/users/999 \
  -H "Authorization: JWT <regular-user-token>"
# Should return 403 Forbidden
```

---

### 3. Input Validation & Injection Attacks

**Tests to Perform:**

- [ ] **SQL Injection**
  - Test query parameters with SQL payloads
  - Test form inputs with SQL injection attempts
  - Verify PayloadCMS/Drizzle ORM prevents injection

- [ ] **XSS (Cross-Site Scripting)**
  - Input `<script>alert('XSS')</script>` in form fields
  - Test rich text editor for script injection
  - Verify CSP blocks inline scripts

- [ ] **Command Injection**
  - Test file upload functionality
  - Test any system command execution
  - Verify input sanitization

- [ ] **Path Traversal**
  - Test file access with `../../etc/passwd`
  - Test media upload paths
  - Verify filesystem restrictions

**Example Payloads:**
```javascript
// SQL Injection
"' OR '1'='1"
"1; DROP TABLE users--"

// XSS
"<script>alert('XSS')</script>"
"<img src=x onerror=alert('XSS')>"

// Path Traversal
"../../.env.development.local"
"../../../etc/passwd"
```

---

### 4. API Security

**Tests to Perform:**

- [ ] **CSRF Protection**
  - Verify CSRF tokens on state-changing requests
  - Test cross-origin requests
  - Check SameSite cookie attributes

- [ ] **CORS Misconfiguration**
  - Test requests from unauthorized origins
  - Verify `Access-Control-Allow-Origin` not set to `*`
  - Check credentials handling

- [ ] **Mass Assignment**
  - Try to set unexpected fields in POST/PATCH
  - Attempt to modify protected fields
  - Verify field-level permissions

- [ ] **API Rate Limiting**
  - Verify rate limits on all endpoints
  - Test different attack patterns
  - Check rate limit bypass techniques

**Example:**
```bash
# Test CORS from unauthorized origin
curl http://localhost:4000/api/pages \
  -H "Origin: https://malicious-site.com" \
  -v
# Should not include Access-Control-Allow-Origin header
```

---

### 5. Payment Security

**Tests to Perform:**

- [ ] **Webhook Signature Bypass**
  - Send webhook without signature
  - Send webhook with invalid signature
  - Attempt to replay old webhooks

- [ ] **Price Manipulation**
  - Modify price in checkout request
  - Verify prices fetched from Stripe, not client
  - Check for price validation

- [ ] **Payment Data Exposure**
  - Verify no card data stored locally
  - Check API responses don't leak payment info
  - Verify PCI compliance

**Example:**
```bash
# Test webhook without signature
curl -X POST http://localhost:4000/api/webhooks/stripe \
  -H "Content-Type: application/json" \
  -d '{"type":"payment_intent.succeeded","data":{}}'
# Should return 400 Bad Request
```

---

### 6. File Upload Security

**Tests to Perform:**

- [ ] **Malicious File Upload**
  - Upload executable files (.exe, .sh)
  - Upload files with double extensions
  - Upload oversized files

- [ ] **File Type Validation**
  - Upload non-image file to image field
  - Verify MIME type checking
  - Test file content validation

- [ ] **Path Traversal via Filename**
  - Upload with filename `../../malicious.php`
  - Verify filename sanitization

---

## Security Testing Tools

### Automated Scanning

1. **OWASP ZAP**
   ```bash
   # Install ZAP
   # Run automated scan
   zap-cli quick-scan --self-contained \
     --start-options '-config api.disablekey=true' \
     http://localhost:4000
   ```

2. **Nuclei**
   ```bash
   # Install Nuclei
   nuclei -u http://localhost:4000 -t ~/nuclei-templates/
   ```

3. **npm audit**
   ```bash
   pnpm audit --audit-level=moderate
   ```

### Manual Testing Tools

- **Burp Suite**: Comprehensive web security testing
- **Postman**: API testing and automation
- **curl**: Command-line HTTP testing
- **Browser DevTools**: Network inspection, cookie analysis

---

## Vulnerability Reporting

### Internal Process

1. **Document Finding**
   - Vulnerability description
   - Steps to reproduce
   - Potential impact
   - Suggested remediation

2. **Severity Classification**
   - **Critical**: Authentication bypass, data exposure
   - **High**: Privilege escalation, injection attacks
   - **Medium**: Information disclosure, DoS
   - **Low**: Minor security improvements

3. **Report to Team**
   - Use private channel
   - Include reproduction steps
   - Provide fix recommendations

### Report Template

```markdown
## Vulnerability Report

**Title**: [Brief description]
**Severity**: Critical/High/Medium/Low
**Date Found**: YYYY-MM-DD
**Tester**: [Your name]

### Description
[What is the vulnerability?]

### Impact
[What could an attacker do?]

### Steps to Reproduce
1. [Step 1]
2. [Step 2]
3. [Expected malicious outcome]

### Affected Components
- [File paths]
- [Endpoints]

### Suggested Fix
[How to remediate]

### References
- [CVE numbers if applicable]
- [Related documentation]
```

---

## Test Checklist

### Authentication Security
- [ ] Brute force protection active
- [ ] Session fixation prevented
- [ ] JWT properly validated and invalidated
- [ ] Password strength enforced
- [ ] Account enumeration prevented

### Authorization Security
- [ ] Role-based access control working
- [ ] Tenant isolation enforced
- [ ] Privilege escalation prevented
- [ ] IDOR vulnerabilities patched

### Input Validation
- [ ] SQL injection prevented
- [ ] XSS attacks blocked
- [ ] Command injection prevented
- [ ] Path traversal blocked
- [ ] File upload restrictions enforced

### API Security
- [ ] CORS properly configured
- [ ] CSRF protection enabled
- [ ] Rate limiting active
- [ ] Mass assignment prevented
- [ ] API authentication required

### Data Protection
- [ ] Sensitive data encrypted in transit (HTTPS)
- [ ] Sensitive data encrypted at rest
- [ ] No secrets in code or logs
- [ ] Environment variables secured
- [ ] Database access restricted

### Payment Security
- [ ] Webhook signatures verified
- [ ] No card data stored
- [ ] Price validation server-side
- [ ] PCI compliance maintained

---

## Remediation Timeline

### Critical Vulnerabilities
- **Fix**: Within 24 hours
- **Deploy**: Emergency patch
- **Communicate**: Immediate team notification

### High Vulnerabilities
- **Fix**: Within 1 week
- **Deploy**: Next scheduled release
- **Communicate**: Daily standup

### Medium Vulnerabilities
- **Fix**: Within 2 weeks
- **Deploy**: Regular sprint cycle

### Low Vulnerabilities
- **Fix**: Backlog priority
- **Deploy**: When convenient

---

## Post-Testing Actions

1. **Fix All Critical/High Findings**
   - Before production deployment
   - Verify fixes with retesting

2. **Document Security Posture**
   - Record all findings
   - Document mitigations
   - Update security documentation

3. **Schedule Regular Testing**
   - Quarterly penetration tests
   - After major feature releases
   - When significant dependencies updated

4. **Security Awareness**
   - Share learnings with team
   - Update secure coding guidelines
   - Improve security practices

---

## External Security Audit

### When to Engage External Auditors

- Before major product launch
- After significant architecture changes
- Annually for compliance
- When handling sensitive data increases

### Recommended Services

- HackerOne
- Bugcrowd
- Professional penetration testing firms
- Security consulting services

---

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)
- [PayloadCMS Security Best Practices](https://payloadcms.com/docs/security)
- [Next.js Security](https://nextjs.org/docs/app/building-your-application/configuring/security)

---

**Last Updated**: January 16, 2025  
**Status**: Ready for Security Team Review  
**Next Review**: Before Production Launch

