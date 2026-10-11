import { describe, expect, it } from 'vitest';
import { PRICING_AGENT_CTA_LINKS, PRICING_AGENT_MCP } from '../pricing';
import { SITE } from '../site';

describe('pricing docs links', () => {
  it('points API docs at the REST reference and MCP docs at the Pro MCP page', () => {
    expect(SITE.urls.apiDocs).toBe('https://docs.revealui.com/api/rest-api');
    expect(PRICING_AGENT_CTA_LINKS.apiDocs.href).toBe(SITE.urls.apiDocs);
    expect(SITE.urls.docsMcp).toBe('https://docs.revealui.com/pro/mcp');
    expect(PRICING_AGENT_MCP.docsLink.href).toBe(SITE.urls.docsMcp);
  });
});
