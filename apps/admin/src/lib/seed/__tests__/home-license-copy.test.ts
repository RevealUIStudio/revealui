import { describe, expect, it } from 'vitest';
import {
  homeLicenseBlocksPatch,
  STALE_ABOUT_LICENSE_SENTENCE,
  STALE_HOME_LICENSE_SENTENCE,
} from '../home-license-copy';

const CURRENT =
  '26 of the 33 packages are MIT, forever. The 5 Pro packages are Fair Source (FSL-1.1-MIT) and convert to MIT two years after each release. The remaining 2 workspace packages are internal tooling with no public license.';

const ABOUT =
  'The 5 Pro packages (ai, engines, harnesses, mcp, and services) are Fair Source (FSL-1.1-MIT): source-visible, commercially usable except as a competing developer platform, and each release converts to MIT two years after it ships.';

describe('homeLicenseBlocksPatch', () => {
  it('replaces the stale license sentence and the spaced hyphen inside existing blocks', () => {
    const blocks = [
      {
        blockType: 'content',
        columns: [
          {
            richText: {
              root: {
                children: [
                  {
                    type: 'paragraph',
                    children: [
                      {
                        type: 'text',
                        text: 'Auth, billing, content, and agents - wired, audited, yours.',
                      },
                    ],
                  },
                  {
                    type: 'paragraph',
                    children: [
                      {
                        type: 'text',
                        text: `Visit /admin. ${STALE_HOME_LICENSE_SENTENCE}`,
                      },
                    ],
                  },
                ],
              },
            },
          },
        ],
      },
    ];

    const patched = homeLicenseBlocksPatch(blocks, CURRENT, ABOUT);

    expect(patched).not.toBeNull();
    const text = JSON.stringify(patched);
    expect(text).toContain(CURRENT);
    expect(text).toContain('agents: wired, audited, yours.');
    expect(text).not.toContain(STALE_HOME_LICENSE_SENTENCE);
    expect(text).not.toContain('agents - wired');
    expect(JSON.stringify(blocks)).toContain(STALE_HOME_LICENSE_SENTENCE);
  });

  it('leaves a home page that does not carry the stale sentence', () => {
    const blocks = [{ blockType: 'content', columns: [{ richText: { text: 'Custom home.' } }] }];
    expect(homeLicenseBlocksPatch(blocks, CURRENT, ABOUT)).toBeNull();
  });

  it('replaces the stale About license sentence without touching custom prose', () => {
    const blocks = [
      {
        blockType: 'content',
        columns: [
          {
            richText: {
              root: {
                children: [
                  { type: 'text', text: 'Custom intro stays.' },
                  { type: 'text', text: STALE_ABOUT_LICENSE_SENTENCE },
                ],
              },
            },
          },
        ],
      },
    ];

    const patched = homeLicenseBlocksPatch(blocks, CURRENT, ABOUT);
    const text = JSON.stringify(patched);
    expect(text).toContain(ABOUT);
    expect(text).toContain('Custom intro stays.');
    expect(text).not.toContain('commercially licensed for platforms');
    expect(JSON.stringify(blocks)).toContain(STALE_ABOUT_LICENSE_SENTENCE);
  });

  it('leaves non-array content alone', () => {
    expect(
      homeLicenseBlocksPatch({ text: STALE_HOME_LICENSE_SENTENCE }, CURRENT, ABOUT),
    ).toBeNull();
  });
});
