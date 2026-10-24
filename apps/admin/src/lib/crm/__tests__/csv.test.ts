import { describe, expect, it } from 'vitest';
import { parseCrmCsv } from '../csv';
import { crmLocalModelConfig } from '../local-draft';

describe('CRM intake', () => {
  it('parses quoted commas, line breaks, escaped quotes and Windows line endings', () => {
    expect(
      parseCrmCsv(
        'name,sourceUrl,location\r\n"Example, Inc",https://example.test,"New\nYork"\r\n"A ""quoted"" name",https://other.test,Atlanta',
      ),
    ).toEqual([
      { name: 'Example, Inc', sourceUrl: 'https://example.test', location: 'New\nYork' },
      { name: 'A "quoted" name', sourceUrl: 'https://other.test', location: 'Atlanta' },
    ]);
  });
  it.each([
    'name,sourceUrl\n"unclosed,https://example.test',
    'name,sourceUrl\n"closed"extra,https://example.test',
    'name,name,sourceUrl\na,b,c',
    'name,unknown\na,b',
    'name,sourceUrl\na,b,c',
  ])('rejects malformed input: %s', (csv) => expect(() => parseCrmCsv(csv)).toThrow());
});
describe('CRM local AI boundary', () => {
  const env = {
    REVEALUI_DEPLOYMENT_MODE: 'forge',
    REVEALUI_CRM_LOCAL_AI: 'true',
    REVEALUI_CRM_LOCAL_MODEL: 'installed-model',
  };
  it('requires explicit opt-in and an installed-model selection', () => {
    expect(() => crmLocalModelConfig({})).toThrow();
    expect(() => crmLocalModelConfig({ REVEALUI_CRM_LOCAL_AI: 'true' })).toThrow();
    expect(crmLocalModelConfig(env)).toMatchObject({
      model: 'installed-model',
      baseURL: 'http://127.0.0.1:11434/v1',
    });
  });
  it.each([
    'https://api.openai.com/v1',
    'http://example.test/v1',
    'http://user:pass@localhost/v1',
    'http://localhost/v1?redirect=1',
  ])('refuses nonlocal or ambiguous endpoints %s', (url) =>
    expect(() => crmLocalModelConfig({ ...env, REVEALUI_CRM_OLLAMA_URL: url })).toThrow(),
  );
  it('refuses hosted inference even when opted in', () =>
    expect(() => crmLocalModelConfig({ ...env, REVEALUI_DEPLOYMENT_MODE: 'hosted' })).toThrow());
});
