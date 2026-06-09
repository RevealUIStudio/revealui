import { describe, expect, it } from 'vitest';
import { parseFrontmatter } from '../frontmatter';

describe('parseFrontmatter', () => {
  describe('no frontmatter', () => {
    it('returns the original body and empty data when there is no block', () => {
      const input = '# Title\n\nJust prose.';
      const result = parseFrontmatter(input);
      expect(result.data).toEqual({});
      expect(result.body).toBe(input);
    });

    it('treats a leading `---` horizontal rule as body, not frontmatter', () => {
      // Opens with --- but the lines are prose, not key: value pairs.
      const input = '---\nThis is an intro rule, not metadata.\nMore prose.\n---\n\nBody.';
      const result = parseFrontmatter(input);
      expect(result.data).toEqual({});
      expect(result.body).toBe(input);
    });

    it('treats an unterminated fence as body', () => {
      const input = '---\ntitle: Lonely\n\nNo closing fence, so this is all body.';
      const result = parseFrontmatter(input);
      expect(result.data).toEqual({});
      expect(result.body).toBe(input);
    });

    it('passes short inline strings straight through', () => {
      const input = 'Use this when you need a button.';
      expect(parseFrontmatter(input)).toEqual({ data: {}, body: input });
    });
  });

  describe('fenced --- block', () => {
    it('parses string values and strips the block from the body', () => {
      const input = '---\ntitle: Hello World\nauthor: Joshua\n---\n\n# Heading\n\nBody.';
      const { data, body } = parseFrontmatter(input);
      expect(data).toEqual({ title: 'Hello World', author: 'Joshua' });
      expect(body).toBe('# Heading\n\nBody.');
    });

    it('types numbers, booleans, and null', () => {
      const input = '---\norder: 3\ndraft: false\npinned: true\nreviewer:\nweight: -2.5\n---\nBody';
      const { data } = parseFrontmatter(input);
      expect(data).toEqual({ order: 3, draft: false, pinned: true, reviewer: null, weight: -2.5 });
    });

    it('keeps colons inside values (URLs, times)', () => {
      const input = '---\nurl: https://revealui.com/docs\ntime: 12:30\n---\nBody';
      const { data } = parseFrontmatter(input);
      expect(data.url).toBe('https://revealui.com/docs');
      expect(data.time).toBe('12:30');
    });

    it('parses quote-aware inline arrays', () => {
      const input = '---\ntags: [docs, "a, b", 3]\n---\nBody';
      const { data } = parseFrontmatter(input);
      expect(data.tags).toEqual(['docs', 'a, b', 3]);
    });

    it('honors quoted strings and ignores # comment lines', () => {
      const input = '---\n# this is a comment\ntitle: "Quoted: with colon"\n---\nBody';
      const { data } = parseFrontmatter(input);
      expect(data).toEqual({ title: 'Quoted: with colon' });
    });

    it('keeps a later `---` divider in the body', () => {
      const input = '---\ntitle: X\n---\n\nIntro\n\n---\n\nMore';
      const { data, body } = parseFrontmatter(input);
      expect(data).toEqual({ title: 'X' });
      expect(body).toBe('Intro\n\n---\n\nMore');
    });

    it('tolerates CRLF line endings and a leading BOM', () => {
      const input = '﻿---\r\ntitle: Win\r\n---\r\nBody line';
      const { data, body } = parseFrontmatter(input);
      expect(data).toEqual({ title: 'Win' });
      expect(body).toBe('Body line');
    });
  });

  describe('HTML-comment block', () => {
    it('parses a multi-line comment block and strips it', () => {
      const input = '<!--\ntitle: Readme Meta\naudience: agents\n-->\n\n# Readme\n\nBody.';
      const { data, body } = parseFrontmatter(input);
      expect(data).toEqual({ title: 'Readme Meta', audience: 'agents' });
      expect(body).toBe('# Readme\n\nBody.');
    });

    it('parses a single-line comment block', () => {
      const input = '<!-- status: canonical -->\n# Title';
      const { data, body } = parseFrontmatter(input);
      expect(data).toEqual({ status: 'canonical' });
      expect(body).toBe('# Title');
    });

    it('leaves a non-key-shaped leading comment as body', () => {
      const input = '<!-- just a note, nothing structured -->\n# Title';
      const result = parseFrontmatter(input);
      expect(result.data).toEqual({});
      expect(result.body).toBe(input);
    });
  });
});
