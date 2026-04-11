import { describe, expect, it } from 'vitest';
import { escapeHtml, renderHTMLShell, renderPage } from '../renderPage.js';

// ---------------------------------------------------------------------------
// Tests  -  escapeHtml
// ---------------------------------------------------------------------------
describe('escapeHtml', () => {
  it('escapes ampersand', () => {
    expect(escapeHtml('A & B')).toBe('A &amp; B');
  });

  it('escapes angle brackets', () => {
    expect(escapeHtml('<div>')).toBe('&lt;div&gt;');
  });

  it('escapes double quotes', () => {
    expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
  });

  it('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#x27;s');
  });

  it('escapes forward slashes', () => {
    expect(escapeHtml('</script>')).toBe('&lt;&#x2F;script&gt;');
  });

  it('prevents XSS script injection', () => {
    const input = '<script>alert("xss")</script>';
    const result = escapeHtml(input);

    expect(result).not.toContain('<script>');
    expect(result).not.toContain('</script>');
    expect(result).toContain('&lt;script&gt;');
  });

  it('prevents XSS via event handlers', () => {
    const input = '<img onerror="alert(1)" src=x>';
    const result = escapeHtml(input);

    expect(result).not.toContain('<img');
    expect(result).toContain('&lt;img');
  });

  it('preserves safe characters', () => {
    expect(escapeHtml('Hello World 123')).toBe('Hello World 123');
  });

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('escapes all special chars in one string', () => {
    const result = escapeHtml('&<>"\'/end');
    expect(result).toBe('&amp;&lt;&gt;&quot;&#x27;&#x2F;end');
  });
});

// ---------------------------------------------------------------------------
// Tests  -  renderHTMLShell
// ---------------------------------------------------------------------------
describe('renderHTMLShell', () => {
  it('renders minimal HTML with defaults', () => {
    const html = renderHTMLShell();

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<meta charset="UTF-8">');
    expect(html).toContain('<title>Page</title>');
  });

  it('renders custom title', () => {
    const html = renderHTMLShell({ title: 'My App' });
    expect(html).toContain('<title>My App</title>');
  });

  it('escapes title for XSS prevention', () => {
    const html = renderHTMLShell({ title: '<script>alert(1)</script>' });

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('renders description meta tag', () => {
    const html = renderHTMLShell({ description: 'A test page' });
    expect(html).toContain('<meta name="description" content="A test page">');
  });

  it('escapes description for XSS prevention', () => {
    const html = renderHTMLShell({ description: '"><script>xss</script>' });
    expect(html).not.toContain('<script>xss</script>');
  });

  it('omits description when empty', () => {
    const html = renderHTMLShell({ description: '' });
    expect(html).not.toContain('name="description"');
  });

  it('renders stylesheet links', () => {
    const html = renderHTMLShell({ styles: ['/css/main.css', '/css/theme.css'] });

    expect(html).toContain('<link rel="stylesheet" href="&#x2F;css&#x2F;main.css">');
    expect(html).toContain('<link rel="stylesheet" href="&#x2F;css&#x2F;theme.css">');
  });

  it('renders script tags with defer', () => {
    const html = renderHTMLShell({ scripts: ['/js/app.js'] });
    expect(html).toContain('<script src="&#x2F;js&#x2F;app.js" defer></script>');
  });

  it('escapes style URLs for XSS prevention', () => {
    const html = renderHTMLShell({ styles: ['"><script>xss</script>'] });
    expect(html).not.toContain('<script>xss</script>');
  });

  it('includes custom head content', () => {
    const html = renderHTMLShell({ headContent: '<meta name="robots" content="noindex">' });
    expect(html).toContain('<meta name="robots" content="noindex">');
  });

  it('includes body content', () => {
    const html = renderHTMLShell({ bodyContent: '<div id="root">App</div>' });
    expect(html).toContain('<div id="root">App</div>');
  });

  it('renders body attributes', () => {
    const html = renderHTMLShell({ bodyAttributes: { class: 'dark', 'data-theme': 'midnight' } });
    expect(html).toContain('class="dark"');
    expect(html).toContain('data-theme="midnight"');
  });

  it('escapes body attribute values', () => {
    const html = renderHTMLShell({ bodyAttributes: { class: '"><script>xss</script>' } });
    expect(html).not.toContain('<script>xss</script>');
  });

  it('sets custom lang attribute', () => {
    const html = renderHTMLShell({ lang: 'ja' });
    expect(html).toContain('<html lang="ja">');
  });
});

// ---------------------------------------------------------------------------
// Tests  -  renderPage
// ---------------------------------------------------------------------------
describe('renderPage', () => {
  const context = { url: '/test', locale: 'en' };

  it('renders page with title and content', () => {
    const html = renderPage({ title: 'Hello', content: '<p>World</p>' }, context);

    expect(html).toContain('<h1>Hello</h1>');
    expect(html).toContain('<p>World</p>');
  });

  it('uses default title when not provided', () => {
    const html = renderPage({}, context);
    expect(html).toContain('<title>Page</title>');
  });

  it('escapes title in heading', () => {
    const html = renderPage({ title: '<script>xss</script>' }, context);
    expect(html).toContain('<h1>&lt;script&gt;');
    expect(html).not.toContain('<h1><script>');
  });

  it('renders description in meta tag', () => {
    const html = renderPage({ title: 'Test', description: 'My description' }, context);
    expect(html).toContain('content="My description"');
  });

  it('handles null pageData gracefully', () => {
    const html = renderPage(null, context);
    expect(html).toContain('<title>Page</title>');
  });

  it('handles non-object pageData gracefully', () => {
    const html = renderPage('string data', context);
    expect(html).toContain('<title>Page</title>');
  });

  it('produces valid HTML structure', () => {
    const html = renderPage({ title: 'Test' }, context);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html');
    expect(html).toContain('</html>');
    expect(html).toContain('<head>');
    expect(html).toContain('</head>');
    expect(html).toContain('<body>');
    expect(html).toContain('</body>');
  });
});
