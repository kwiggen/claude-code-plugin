import { Marked } from 'marked';
import { createHighlighter, type Highlighter } from 'shiki';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildDocument } from './templates.js';
import type { PublishOptions, PublishResult, Section, TemplateName } from './types.js';
import { TAB_DEFAULT_TEMPLATES, TAB_THRESHOLD } from './types.js';

const SUPPORTED_LANGS = [
  'typescript',
  'javascript',
  'python',
  'bash',
  'shell',
  'json',
  'yaml',
  'html',
  'css',
  'sql',
  'go',
  'rust',
  'java',
  'kotlin',
  'swift',
  'ruby',
  'diff',
  'markdown',
  'xml',
  'toml',
  'dockerfile',
  'graphql',
  'c',
  'cpp',
  'csharp',
  'php',
];

let highlighterCache: Promise<Highlighter> | null = null;

function getHighlighter(): Promise<Highlighter> {
  if (!highlighterCache) {
    highlighterCache = createHighlighter({
      themes: ['github-light'],
      langs: SUPPORTED_LANGS,
    }).catch((err) => {
      highlighterCache = null;
      throw err;
    });
  }
  return highlighterCache;
}

function splitHtml(
  html: string,
  titleOverride?: string,
): { title: string; headerHtml: string; sections: Section[] } {
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  const title = titleOverride ?? (h1Match ? h1Match[1].replace(/<[^>]+>/g, '').trim() : 'Document');

  const parts = html.split(/(?=<h2[^>]*>)/);
  const headerHtml = parts[0] ?? '';

  const sections = parts.slice(1).map((part) => {
    const h2Match = part.match(/<h2[^>]*>([\s\S]*?)<\/h2>/);
    const sectionTitle = h2Match ? h2Match[1].replace(/<[^>]+>/g, '').trim() : 'Section';
    const content = h2Match ? part.replace(/<h2[^>]*>[\s\S]*?<\/h2>/, '') : part;
    return { title: sectionTitle, content };
  });

  return { title, headerHtml, sections };
}

function shouldTab(
  sectionCount: number,
  template: TemplateName,
  override?: boolean,
): boolean {
  if (override !== undefined) return override;
  if (!TAB_DEFAULT_TEMPLATES.includes(template)) return false;
  return sectionCount >= TAB_THRESHOLD;
}

export async function convertMarkdown(options: PublishOptions): Promise<PublishResult> {
  const template = options.template ?? 'default';

  try {
    const highlighter = await getHighlighter();
    const loadedLangs = highlighter.getLoadedLanguages();

    const marked = new Marked();
    marked.use({
      gfm: true,
      renderer: {
        code({ text, lang }: { text: string; lang?: string }) {
          if (lang) {
            const langId = lang.toLowerCase();
            if (loadedLangs.includes(langId)) {
              return highlighter.codeToHtml(text, { lang: langId, theme: 'github-light' });
            }
          }
          return false;
        },
      },
    });

    const rawHtml = marked.parse(options.markdown) as string;
    const { title, headerHtml, sections } = splitHtml(rawHtml, options.title);
    const tabbed = shouldTab(sections.length, template, options.tabs);

    const document = buildDocument({ title, headerHtml, sections, tabbed, template });

    const outputPath = resolve(options.output);
    writeFileSync(outputPath, document, 'utf-8');

    const wordCount = options.markdown
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`[^`]+`/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 0).length;

    return { success: true, outputPath, title, template, tabbed, sectionCount: sections.length, wordCount };
  } catch (err) {
    return {
      success: false,
      title: options.title ?? 'Document',
      template,
      tabbed: false,
      sectionCount: 0,
      wordCount: 0,
      error: 'conversion_failed',
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }
}
