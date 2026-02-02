import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import {
  sanitizePrompt,
  detectKeywords,
  applyKeywordOverrides,
  buildKeywordOutput,
  processKeywords,
  loadKeywordsFromFile,
  loadKeywords,
} from '../features/magic-keywords.js';
import type { MagicKeyword } from '../shared/types.js';

// ---------------------------------------------------------------------------
// Test fixtures — keywords used across tests
// ---------------------------------------------------------------------------

const TEST_KEYWORDS: MagicKeyword[] = [
  {
    name: 'review',
    triggers: ['review', 'code review', 'cr'],
    priority: 1,
    skill: 'kw-plugin:review-code',
    skillArgs: '1',
    instruction: 'Do a code review.',
  },
  {
    name: 'pr',
    triggers: ['create pr', 'open pr'],
    priority: 2,
    skill: 'kw-plugin:create-pr',
    instruction: 'Create a PR.',
  },
  {
    name: 'thorough',
    triggers: ['thorough', 'deep review'],
    priority: 10,
    instruction: 'Be thorough.',
  },
  {
    name: 'ship',
    triggers: ['ship it', 'ship', 'lgtm'],
    priority: 10,
    instruction: 'Move fast.',
  },
];

// ---------------------------------------------------------------------------
// loadKeywordsFromFile / loadKeywords
// ---------------------------------------------------------------------------

describe('loadKeywordsFromFile', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'kw-keywords-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should load keywords from a JSON file', () => {
    const filePath = join(tempDir, 'keywords.json');
    writeFileSync(filePath, JSON.stringify(TEST_KEYWORDS));

    const keywords = loadKeywordsFromFile(filePath);
    expect(keywords).toHaveLength(4);
    expect(keywords[0].name).toBe('review');
  });

  it('should return empty array for nonexistent file', () => {
    const keywords = loadKeywordsFromFile(join(tempDir, 'nope.json'));
    expect(keywords).toHaveLength(0);
  });

  it('should return empty array for invalid JSON', () => {
    const filePath = join(tempDir, 'bad.json');
    writeFileSync(filePath, 'not json{{{');

    const keywords = loadKeywordsFromFile(filePath);
    expect(keywords).toHaveLength(0);
  });

  it('should return empty array if JSON is not an array', () => {
    const filePath = join(tempDir, 'object.json');
    writeFileSync(filePath, '{ "not": "an array" }');

    const keywords = loadKeywordsFromFile(filePath);
    expect(keywords).toHaveLength(0);
  });
});

describe('loadKeywords', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'kw-keywords-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should load keywords.json from plugin root', () => {
    writeFileSync(join(tempDir, 'keywords.json'), JSON.stringify(TEST_KEYWORDS));

    const keywords = loadKeywords(tempDir);
    expect(keywords).toHaveLength(4);
  });

  it('should return empty array when no keywords.json exists', () => {
    const keywords = loadKeywords(tempDir);
    expect(keywords).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// sanitizePrompt
// ---------------------------------------------------------------------------

describe('sanitizePrompt', () => {
  it('should remove fenced code blocks', () => {
    const prompt = 'Please review this:\n```\nconst review = true;\n```';
    const result = sanitizePrompt(prompt);
    expect(result).not.toContain('const review');
    expect(result).toContain('Please review this');
  });

  it('should remove inline code', () => {
    const prompt = 'Check the `review` function';
    const result = sanitizePrompt(prompt);
    expect(result).not.toContain('`review`');
  });

  it('should remove URLs', () => {
    const prompt = 'Check https://github.com/review/code please';
    const result = sanitizePrompt(prompt);
    expect(result).not.toContain('https://');
    expect(result).toContain('please');
  });

  it('should remove file paths', () => {
    const prompt = 'Look at ./src/review/handler.ts for issues';
    const result = sanitizePrompt(prompt);
    expect(result).not.toContain('./src/review');
  });

  it('should remove XML tags', () => {
    const prompt = '<system>review this</system> Do something';
    const result = sanitizePrompt(prompt);
    expect(result).not.toContain('<system>');
    expect(result).toContain('Do something');
  });

  it('should preserve normal text', () => {
    const prompt = 'Please review my code for issues';
    const result = sanitizePrompt(prompt);
    expect(result).toBe('Please review my code for issues');
  });
});

// ---------------------------------------------------------------------------
// detectKeywords
// ---------------------------------------------------------------------------

describe('detectKeywords', () => {
  it('should detect a single keyword', () => {
    const matches = detectKeywords('review my code please', TEST_KEYWORDS);
    expect(matches).toHaveLength(1);
    expect(matches[0].name).toBe('review');
  });

  it('should detect multi-word triggers', () => {
    const matches = detectKeywords('can you create pr for this?', TEST_KEYWORDS);
    expect(matches).toHaveLength(1);
    expect(matches[0].name).toBe('pr');
  });

  it('should not match keywords inside code blocks', () => {
    const matches = detectKeywords(
      '```\nconst review = true;\n```\nFix this bug',
      TEST_KEYWORDS
    );
    expect(matches).toHaveLength(0);
  });

  it('should not match partial words (word boundary)', () => {
    const matches = detectKeywords('preview the changes', TEST_KEYWORDS);
    expect(matches.find((m) => m.name === 'review')).toBeUndefined();
  });

  it('should be case insensitive', () => {
    const matches = detectKeywords('REVIEW my code', TEST_KEYWORDS);
    expect(matches).toHaveLength(1);
    expect(matches[0].name).toBe('review');
  });

  it('should detect multiple keywords', () => {
    const matches = detectKeywords(
      'do a thorough review of my code',
      TEST_KEYWORDS
    );
    expect(matches.length).toBeGreaterThanOrEqual(2);
    const names = matches.map((m) => m.name);
    expect(names).toContain('review');
    expect(names).toContain('thorough');
  });

  it('should sort by priority (lower number first)', () => {
    const matches = detectKeywords(
      'do a thorough review of my code',
      TEST_KEYWORDS
    );
    const reviewIdx = matches.findIndex((m) => m.name === 'review');
    const thoroughIdx = matches.findIndex((m) => m.name === 'thorough');
    expect(reviewIdx).toBeLessThan(thoroughIdx);
  });

  it('should return empty array when no keywords match', () => {
    const matches = detectKeywords(
      'fix the bug in the login page',
      TEST_KEYWORDS
    );
    expect(matches).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// applyKeywordOverrides
// ---------------------------------------------------------------------------

describe('applyKeywordOverrides', () => {
  it('should replace triggers for matching keyword', () => {
    const overridden = applyKeywordOverrides(TEST_KEYWORDS, {
      review: ['rv', 'check'],
    });
    expect(overridden[0].triggers).toEqual(['rv', 'check']);
  });

  it('should not modify keywords without overrides', () => {
    const overridden = applyKeywordOverrides(TEST_KEYWORDS, {
      review: ['rv'],
    });
    expect(overridden[1].triggers).toEqual(['create pr', 'open pr']);
  });

  it('should return keywords unchanged when no overrides', () => {
    const overridden = applyKeywordOverrides(TEST_KEYWORDS, undefined);
    expect(overridden).toBe(TEST_KEYWORDS);
  });

  it('should preserve non-trigger properties', () => {
    const overridden = applyKeywordOverrides(TEST_KEYWORDS, {
      review: ['rv'],
    });
    expect(overridden[0].instruction).toBe('Do a code review.');
    expect(overridden[0].priority).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// buildKeywordOutput
// ---------------------------------------------------------------------------

describe('buildKeywordOutput', () => {
  it('should return bare continue for no matches', () => {
    const output = buildKeywordOutput([]);
    expect(output.continue).toBe(true);
    expect(output.hookSpecificOutput).toBeUndefined();
  });

  it('should build output for single keyword with skill', () => {
    const output = buildKeywordOutput([TEST_KEYWORDS[0]]);
    expect(output.continue).toBe(true);
    expect(output.hookSpecificOutput).toBeDefined();
    expect(output.hookSpecificOutput?.hookEventName).toBe('UserPromptSubmit');

    const context = output.hookSpecificOutput?.additionalContext ?? '';
    expect(context).toContain('[MAGIC KEYWORD: REVIEW]');
    expect(context).toContain('kw-plugin:review-code');
    expect(context).toContain('IMMEDIATELY');
  });

  it('should build output for multiple keywords', () => {
    const matches = [TEST_KEYWORDS[0], TEST_KEYWORDS[2]]; // review + thorough
    const output = buildKeywordOutput(matches);

    const context = output.hookSpecificOutput?.additionalContext ?? '';
    expect(context).toContain('[MAGIC KEYWORDS: REVIEW, THOROUGH]');
    expect(context).toContain('### REVIEW');
    expect(context).toContain('### THOROUGH');
  });

  it('should not include skill section for non-skill keywords', () => {
    const output = buildKeywordOutput([TEST_KEYWORDS[2]]); // thorough has no skill
    const context = output.hookSpecificOutput?.additionalContext ?? '';
    expect(context).not.toContain('Skill:');
  });
});

// ---------------------------------------------------------------------------
// processKeywords (full pipeline with file loading)
// ---------------------------------------------------------------------------

describe('processKeywords', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'kw-keywords-test-'));
    writeFileSync(join(tempDir, 'keywords.json'), JSON.stringify(TEST_KEYWORDS));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should detect and build output end-to-end', () => {
    const output = processKeywords('please review my code', undefined, tempDir);
    expect(output.continue).toBe(true);
    expect(output.hookSpecificOutput?.additionalContext).toContain('REVIEW');
  });

  it('should return bare continue when no keywords found', () => {
    const output = processKeywords('fix the login bug', undefined, tempDir);
    expect(output.continue).toBe(true);
    expect(output.hookSpecificOutput).toBeUndefined();
  });

  it('should respect feature toggle', () => {
    const output = processKeywords(
      'review my code',
      { features: { magicKeywords: false } },
      tempDir
    );
    expect(output.hookSpecificOutput).toBeUndefined();
  });

  it('should apply config keyword overrides', () => {
    const output = processKeywords(
      'rv my changes',
      { magicKeywords: { review: ['rv'] } },
      tempDir
    );
    expect(output.hookSpecificOutput?.additionalContext).toContain('REVIEW');
  });

  it('should return bare continue when keywords.json missing', () => {
    const emptyDir = mkdtempSync(join(tmpdir(), 'kw-empty-'));
    const output = processKeywords('review my code', undefined, emptyDir);
    expect(output.hookSpecificOutput).toBeUndefined();
    rmSync(emptyDir, { recursive: true, force: true });
  });
});
