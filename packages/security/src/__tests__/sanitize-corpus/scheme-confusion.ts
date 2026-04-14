export interface UrlVector {
  input: string;
  rationale: string;
}

export const DANGEROUS_URL_VECTORS: readonly UrlVector[] = [
  { input: 'javascript:alert(1)', rationale: 'classic script URL' },
  { input: 'JavaScript:alert(1)', rationale: 'mixed case evasion' },
  { input: 'JAVASCRIPT:alert(1)', rationale: 'upper case evasion' },
  { input: ' javascript:alert(1)', rationale: 'leading-whitespace evasion' },
  { input: '\tjavascript:alert(1)', rationale: 'leading-tab evasion' },
  { input: 'vbscript:msgbox(1)', rationale: 'legacy IE script protocol' },
  { input: 'data:text/html,<script>alert(1)</script>', rationale: 'HTML data URI' },
  { input: 'data:application/javascript,alert(1)', rationale: 'JS data URI' },
  { input: 'DATA:text/html,x', rationale: 'upper case data URI' },
  {
    input: 'data:image/svg+xml,<svg onload=alert(1)>',
    rationale: 'SVG data URI (blocked as image payload too)',
  },
  { input: 'ftp://example.com/', rationale: 'unknown scheme — deny-by-default' },
  { input: 'file:///etc/passwd', rationale: 'local file URL' },
  { input: 'chrome://settings', rationale: 'browser-internal URL' },
] as const;

export const SAFE_URL_VECTORS: readonly UrlVector[] = [
  { input: 'https://example.com/x?y=1#z', rationale: 'standard HTTPS URL' },
  {
    input: 'http://example.com/',
    rationale: 'HTTP allowed (we intentionally do not force TLS here)',
  },
  { input: 'mailto:founder@revealui.com', rationale: 'email link' },
  { input: 'tel:+15551234567', rationale: 'phone link' },
  { input: '/relative/path', rationale: 'relative URL' },
  { input: '#section-2', rationale: 'anchor' },
  { input: '', rationale: 'empty — treated as no-op anchor' },
  { input: 'image-name-without-protocol.png', rationale: 'relative image path' },
] as const;

export const SAFE_IMAGE_DATA_VECTORS: readonly UrlVector[] = [
  {
    input:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    rationale: '1x1 PNG data URI — allowed in image context only',
  },
  {
    input: 'data:image/jpeg;base64,/9j/4AAQ',
    rationale: 'JPEG data URI — allowed in image context only',
  },
] as const;
