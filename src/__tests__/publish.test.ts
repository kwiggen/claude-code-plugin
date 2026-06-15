import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import { convertMarkdown } from '../publish/converter.js';
import { buildDocument, type DocumentParts } from '../publish/templates.js';
import { parseArgs } from '../publish/cli.js';
import { VALID_TEMPLATES, TAB_THRESHOLD } from '../publish/types.js';

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    writeFileSync: vi.fn(),
  };
});

const mockWriteFileSync = vi.mocked(fs.writeFileSync);

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// parseArgs (CLI)
// ---------------------------------------------------------------------------

describe('parseArgs', () => {
  it('should parse --input and --output', () => {
    const args = parseArgs(['--input', 'doc.md', '--output', 'doc.html']);
    expect(args.input).toBe('doc.md');
    expect(args.output).toBe('doc.html');
    expect(args.template).toBe('default');
    expect(args.title).toBeNull();
    expect(args.tabs).toBeNull();
  });

  it('should parse --template', () => {
    const args = parseArgs(['--output', 'out.html', '--template', 'report']);
    expect(args.template).toBe('report');
  });

  it('should parse --title', () => {
    const args = parseArgs(['--output', 'out.html', '--title', 'My Report']);
    expect(args.title).toBe('My Report');
  });

  it('should parse --tabs flag', () => {
    const args = parseArgs(['--output', 'out.html', '--tabs']);
    expect(args.tabs).toBe(true);
  });

  it('should parse --no-tabs flag', () => {
    const args = parseArgs(['--output', 'out.html', '--no-tabs']);
    expect(args.tabs).toBe(false);
  });

  it('should exit with error when --output is missing', () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
    const mockError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => parseArgs(['--input', 'doc.md'])).toThrow('process.exit');
    expect(mockError).toHaveBeenCalledWith('--output is required');

    mockExit.mockRestore();
    mockError.mockRestore();
  });

  it('should exit with error for invalid --template', () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
    const mockError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => parseArgs(['--output', 'out.html', '--template', 'fancy'])).toThrow('process.exit');
    expect(mockError).toHaveBeenCalledWith('Invalid template: fancy');

    mockExit.mockRestore();
    mockError.mockRestore();
  });

  it('should accept all valid templates', () => {
    for (const t of VALID_TEMPLATES) {
      const args = parseArgs(['--output', 'out.html', '--template', t]);
      expect(args.template).toBe(t);
    }
  });
});

// ---------------------------------------------------------------------------
// buildDocument (templates)
// ---------------------------------------------------------------------------

describe('buildDocument', () => {
  const baseParts: DocumentParts = {
    title: 'Test',
    headerHtml: '<h1>Test</h1>\n<p>Intro</p>\n',
    sections: [
      { title: 'A', content: '<p>Section A</p>' },
      { title: 'B', content: '<p>Section B</p>' },
      { title: 'C', content: '<p>Section C</p>' },
    ],
    tabbed: false,
    template: 'default',
  };

  it('should produce valid HTML5 document', () => {
    const html = buildDocument(baseParts);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<meta charset="UTF-8">');
    expect(html).toContain('<meta name="viewport"');
    expect(html).toContain('<title>Test</title>');
    expect(html).toContain('</html>');
  });

  it('should include base CSS', () => {
    const html = buildDocument(baseParts);
    expect(html).toContain('max-width: 680px');
    expect(html).toContain('system-ui');
    expect(html).toContain('ui-monospace');
  });

  it('should include print styles', () => {
    const html = buildDocument(baseParts);
    expect(html).toContain('@media print');
    expect(html).toContain('page-break-inside: avoid');
  });

  it('should render flat sections when not tabbed', () => {
    const html = buildDocument(baseParts);
    expect(html).toContain('<h2>A</h2>');
    expect(html).toContain('<h2>B</h2>');
    expect(html).toContain('<h2>C</h2>');
    expect(html).not.toContain('role="tablist"');
    expect(html).not.toContain('role="tab"');
    expect(html).not.toContain('<script>');
  });

  it('should render tab bar and panels when tabbed', () => {
    const html = buildDocument({ ...baseParts, tabbed: true });
    expect(html).toContain('role="tablist"');
    expect(html).toContain('role="tab"');
    expect(html).toContain('role="tabpanel"');
    expect(html).toContain('data-tab="0"');
    expect(html).toContain('data-tab="2"');
    expect(html).toContain('data-panel="0"');
    expect(html).toContain('data-panel="2"');
  });

  it('should set first tab as selected', () => {
    const html = buildDocument({ ...baseParts, tabbed: true });
    expect(html).toContain('aria-selected="true" data-tab="0"');
    expect(html).toContain('aria-selected="false" data-tab="1"');
  });

  it('should hide non-first panels', () => {
    const html = buildDocument({ ...baseParts, tabbed: true });
    expect(html).toMatch(/data-panel="0"(?!.*hidden)/);
    expect(html).toContain('data-panel="1" aria-label="B" hidden');
  });

  it('should include tab switching script when tabbed', () => {
    const html = buildDocument({ ...baseParts, tabbed: true });
    expect(html).toContain('<script>');
    expect(html).toContain("addEventListener('click'");
  });

  it('should include noscript fallback when tabbed', () => {
    const html = buildDocument({ ...baseParts, tabbed: true });
    expect(html).toContain('<noscript>');
    expect(html).toContain('[role="tabpanel"][hidden] { display: block !important; }');
  });

  it('should include tab CSS only when tabbed', () => {
    const noTabs = buildDocument(baseParts);
    const withTabs = buildDocument({ ...baseParts, tabbed: true });
    expect(noTabs).not.toContain('.tab-bar button');
    expect(withTabs).toContain('.tab-bar button');
  });

  it('should escape HTML in title', () => {
    const html = buildDocument({ ...baseParts, title: 'A <script>alert(1)</script> B' });
    expect(html).toContain('<title>A &lt;script&gt;alert(1)&lt;/script&gt; B</title>');
    expect(html).not.toContain('<title>A <script>');
  });

  it('should escape HTML in tab labels', () => {
    const parts: DocumentParts = {
      ...baseParts,
      tabbed: true,
      sections: [{ title: '<img onerror=alert(1)>', content: '<p>x</p>' }],
    };
    const html = buildDocument(parts);
    expect(html).toContain('&lt;img onerror=alert(1)&gt;');
    expect(html).not.toContain('<img onerror');
  });

  it('should apply briefing template overrides', () => {
    const html = buildDocument({ ...baseParts, template: 'briefing' });
    expect(html).toContain('font-size: 1.0625rem');
    expect(html).toContain('font-size: 1.875rem');
  });

  it('should apply report template overrides', () => {
    const html = buildDocument({ ...baseParts, template: 'report' });
    expect(html).toContain('border-left-color: #3b82f6');
  });

  it('should apply review template diff styles', () => {
    const html = buildDocument({ ...baseParts, template: 'review' });
    expect(html).toContain('.shiki .diff.add');
    expect(html).toContain('.shiki .diff.remove');
  });

  it('should escape single quotes in title', () => {
    const html = buildDocument({ ...baseParts, title: "It's a test" });
    expect(html).toContain('<title>It&#39;s a test</title>');
  });

  it('should escape titles in flat (non-tabbed) path', () => {
    const parts: DocumentParts = {
      ...baseParts,
      tabbed: false,
      sections: [{ title: '<script>alert(1)</script>', content: '<p>x</p>' }],
    };
    const html = buildDocument(parts);
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<h2><script>');
  });

  it('should render header above tabs', () => {
    const html = buildDocument({ ...baseParts, tabbed: true });
    const headerPos = html.indexOf('<h1>Test</h1>');
    const tabBarPos = html.indexOf('role="tablist"');
    expect(headerPos).toBeLessThan(tabBarPos);
  });
});

// ---------------------------------------------------------------------------
// convertMarkdown (converter)
// ---------------------------------------------------------------------------

describe('convertMarkdown', () => {
  it('should convert simple markdown to HTML', async () => {
    const result = await convertMarkdown({
      markdown: '# Hello\n\nWorld',
      output: '/tmp/test.html',
    });

    expect(result.success).toBe(true);
    expect(result.title).toBe('Hello');
    expect(result.template).toBe('default');
    expect(result.tabbed).toBe(false);
    expect(result.sectionCount).toBe(0);
    expect(result.wordCount).toBeGreaterThan(0);
    expect(mockWriteFileSync).toHaveBeenCalledOnce();
  });

  it('should extract title from first H1', async () => {
    const result = await convertMarkdown({
      markdown: '# My Great Title\n\nContent',
      output: '/tmp/test.html',
    });
    expect(result.title).toBe('My Great Title');
  });

  it('should use title override when provided', async () => {
    const result = await convertMarkdown({
      markdown: '# Original Title\n\nContent',
      output: '/tmp/test.html',
      title: 'Override Title',
    });
    expect(result.title).toBe('Override Title');
  });

  it('should default to "Document" when no H1', async () => {
    const result = await convertMarkdown({
      markdown: 'Just some text',
      output: '/tmp/test.html',
    });
    expect(result.title).toBe('Document');
  });

  it('should count sections by H2 headings', async () => {
    const result = await convertMarkdown({
      markdown: '# Title\n\n## A\n\ntext\n\n## B\n\ntext\n\n## C\n\ntext',
      output: '/tmp/test.html',
    });
    expect(result.sectionCount).toBe(3);
  });

  it('should auto-tab report template with 3+ sections', async () => {
    const result = await convertMarkdown({
      markdown: '# Title\n\n## A\n\nx\n\n## B\n\nx\n\n## C\n\nx',
      output: '/tmp/test.html',
      template: 'report',
    });
    expect(result.tabbed).toBe(true);
    expect(result.sectionCount).toBe(TAB_THRESHOLD);
  });

  it('should not auto-tab report template with fewer sections', async () => {
    const result = await convertMarkdown({
      markdown: '# Title\n\n## A\n\nx\n\n## B\n\nx',
      output: '/tmp/test.html',
      template: 'report',
    });
    expect(result.tabbed).toBe(false);
  });

  it('should not auto-tab default template', async () => {
    const result = await convertMarkdown({
      markdown: '# Title\n\n## A\n\nx\n\n## B\n\nx\n\n## C\n\nx\n\n## D\n\nx',
      output: '/tmp/test.html',
      template: 'default',
    });
    expect(result.tabbed).toBe(false);
  });

  it('should not auto-tab briefing template', async () => {
    const result = await convertMarkdown({
      markdown: '# Title\n\n## A\n\nx\n\n## B\n\nx\n\n## C\n\nx',
      output: '/tmp/test.html',
      template: 'briefing',
    });
    expect(result.tabbed).toBe(false);
  });

  it('should force tabs with tabs=true', async () => {
    const result = await convertMarkdown({
      markdown: '# Title\n\n## A\n\nx\n\n## B\n\nx\n\n## C\n\nx',
      output: '/tmp/test.html',
      template: 'briefing',
      tabs: true,
    });
    expect(result.tabbed).toBe(true);
  });

  it('should force no tabs with tabs=false', async () => {
    const result = await convertMarkdown({
      markdown: '# Title\n\n## A\n\nx\n\n## B\n\nx\n\n## C\n\nx',
      output: '/tmp/test.html',
      template: 'report',
      tabs: false,
    });
    expect(result.tabbed).toBe(false);
  });

  it('should highlight code blocks with shiki', async () => {
    const result = await convertMarkdown({
      markdown: '# Test\n\n```typescript\nconst x = 1;\n```',
      output: '/tmp/test.html',
    });

    expect(result.success).toBe(true);
    const writtenHtml = mockWriteFileSync.mock.calls[0][1] as string;
    expect(writtenHtml).toContain('shiki');
    expect(writtenHtml).toContain('style="color:');
  });

  it('should handle unknown code languages gracefully', async () => {
    const result = await convertMarkdown({
      markdown: '# Test\n\n```brainfuck\n++++++\n```',
      output: '/tmp/test.html',
    });

    expect(result.success).toBe(true);
    const writtenHtml = mockWriteFileSync.mock.calls[0][1] as string;
    expect(writtenHtml).toContain('<pre>');
  });

  it('should render GFM tables', async () => {
    const result = await convertMarkdown({
      markdown: '# Test\n\n| A | B |\n|---|---|\n| 1 | 2 |',
      output: '/tmp/test.html',
    });

    expect(result.success).toBe(true);
    const writtenHtml = mockWriteFileSync.mock.calls[0][1] as string;
    expect(writtenHtml).toContain('<table>');
    expect(writtenHtml).toContain('<th>A</th>');
    expect(writtenHtml).toContain('<td>1</td>');
  });

  it('should count words excluding code blocks', async () => {
    const result = await convertMarkdown({
      markdown: '# Title\n\nOne two three\n\n```\nskipped code words\n```\n\nFour five',
      output: '/tmp/test.html',
    });

    expect(result.wordCount).toBe(7);
  });

  it('should write to the specified output path', async () => {
    await convertMarkdown({
      markdown: '# Test',
      output: '/some/path/doc.html',
    });

    expect(mockWriteFileSync).toHaveBeenCalledWith(
      expect.stringContaining('doc.html'),
      expect.any(String),
      'utf-8',
    );
  });

  it('should return error result on write failure', async () => {
    mockWriteFileSync.mockImplementation(() => {
      throw new Error('EACCES: permission denied');
    });

    const result = await convertMarkdown({
      markdown: '# Test',
      output: '/readonly/test.html',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('conversion_failed');
    expect(result.errorMessage).toContain('EACCES');
  });

  it('should produce self-contained HTML with no external links', async () => {
    mockWriteFileSync.mockImplementation(() => undefined);

    const result = await convertMarkdown({
      markdown: '# Test\n\nSome content',
      output: '/tmp/test.html',
    });

    expect(result.success).toBe(true);
    const writtenHtml = mockWriteFileSync.mock.calls[0][1] as string;
    expect(writtenHtml).not.toContain('<link');
    expect(writtenHtml).toContain('<style>');
  });
});
