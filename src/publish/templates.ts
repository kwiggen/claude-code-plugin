import type { TemplateName, Section } from './types.js';

export interface DocumentParts {
  title: string;
  headerHtml: string;
  sections: Section[];
  tabbed: boolean;
  template: TemplateName;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const FONT_BODY =
  "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const FONT_MONO =
  "ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, 'DejaVu Sans Mono', monospace";

const BASE_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: ${FONT_BODY};
    font-size: 1rem;
    line-height: 1.6;
    color: #1a1a1a;
    background: #ffffff;
    padding: 2rem 1rem;
    -webkit-font-smoothing: antialiased;
  }
  article { max-width: 680px; margin: 0 auto; }
  h1 {
    font-size: 1.75rem; font-weight: 700;
    margin-bottom: 1.5rem; padding-bottom: 0.5rem;
    border-bottom: 2px solid #e5e7eb; line-height: 1.3;
  }
  h2 { font-size: 1.375rem; font-weight: 600; margin-top: 2rem; margin-bottom: 0.75rem; line-height: 1.3; }
  h3 { font-size: 1.125rem; font-weight: 600; margin-top: 1.5rem; margin-bottom: 0.5rem; }
  h4 { font-size: 1rem; font-weight: 600; margin-top: 1.25rem; margin-bottom: 0.25rem; }
  p { margin-bottom: 1rem; }
  a { color: #2563eb; text-decoration: none; }
  a:hover { text-decoration: underline; }
  strong { font-weight: 600; }
  code {
    background: #f3f4f6; padding: 0.15em 0.35em; border-radius: 3px;
    font-family: ${FONT_MONO}; font-size: 0.875em;
  }
  pre {
    background: #f8f9fa; padding: 1rem; border-radius: 6px;
    overflow-x: auto; margin-bottom: 1rem; border: 1px solid #e5e7eb;
  }
  pre code { background: none; padding: 0; font-size: 0.85em; border-radius: 0; }
  .shiki { padding: 1rem !important; border-radius: 6px; overflow-x: auto; margin-bottom: 1rem; border: 1px solid #e5e7eb; }
  .shiki code { font-family: ${FONT_MONO}; font-size: 0.85em; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; font-size: 0.925rem; }
  th, td { border: 1px solid #e5e7eb; padding: 0.5rem 0.75rem; text-align: left; }
  th { background: #f9fafb; font-weight: 600; }
  tr:nth-child(even) td { background: #f9fafb; }
  blockquote {
    border-left: 3px solid #d1d5db; padding: 0.5rem 1rem;
    color: #4b5563; margin-bottom: 1rem; background: #f9fafb;
    border-radius: 0 4px 4px 0;
  }
  blockquote p:last-child { margin-bottom: 0; }
  ul, ol { padding-left: 1.5rem; margin-bottom: 1rem; }
  li { margin-bottom: 0.25rem; }
  li > ul, li > ol { margin-bottom: 0; margin-top: 0.25rem; }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 2rem 0; }
  img { max-width: 100%; height: auto; border-radius: 4px; }
  input[type="checkbox"] { margin-right: 0.4em; }
`;

const TAB_CSS = `
  .tab-bar {
    display: flex; gap: 0;
    border-bottom: 2px solid #e5e7eb;
    margin-bottom: 1.5rem;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  .tab-bar button {
    background: none; border: none;
    padding: 0.625rem 1.25rem;
    font-size: 0.875rem; font-family: inherit; font-weight: 500;
    cursor: pointer; color: #6b7280;
    border-bottom: 2px solid transparent;
    margin-bottom: -2px; white-space: nowrap;
    transition: color 0.15s, border-color 0.15s;
  }
  .tab-bar button[aria-selected="true"] {
    color: #2563eb; border-bottom-color: #2563eb; font-weight: 600;
  }
  .tab-bar button:hover { color: #1d4ed8; }
`;

const TEMPLATE_CSS: Record<TemplateName, string> = {
  default: '',
  report: `
    blockquote:first-of-type {
      border-left-color: #3b82f6; background: #eff6ff;
    }
  `,
  review: `
    .shiki .line::before { content: none; }
    .shiki .diff.add { background-color: #dafbe1; }
    .shiki .diff.remove { background-color: #ffebe9; }
  `,
  briefing: `
    body { font-size: 1.0625rem; line-height: 1.7; }
    h1 { font-size: 1.875rem; }
    h2 { font-size: 1.5rem; }
  `,
};

const PRINT_CSS = `
  @media print {
    body { padding: 0; color: #000; background: #fff; }
    article { max-width: none; }
    .tab-bar { display: none !important; }
    [role="tabpanel"] { display: block !important; }
    [role="tabpanel"][hidden] { display: block !important; }
    pre, .shiki {
      border: 1px solid #ccc !important;
      background: #f5f5f5 !important;
    }
    a { color: #000; text-decoration: underline; }
    a[href^="http"]::after { content: " (" attr(href) ")"; font-size: 0.8em; color: #666; }
    h1, h2, h3 { page-break-after: avoid; }
    pre, table, blockquote { page-break-inside: avoid; }
  }
`;

const TAB_SCRIPT = `
  <script>
    document.querySelectorAll('[role="tab"]').forEach(function(tab) {
      tab.addEventListener('click', function() {
        document.querySelectorAll('[role="tab"]').forEach(function(t) {
          t.setAttribute('aria-selected', 'false');
        });
        document.querySelectorAll('[role="tabpanel"]').forEach(function(p) {
          p.hidden = true;
        });
        tab.setAttribute('aria-selected', 'true');
        var panel = document.querySelector('[data-panel="' + tab.dataset.tab + '"]');
        if (panel) panel.hidden = false;
      });
    });
  </script>
`;

const NOSCRIPT_FALLBACK = `
  <noscript>
    <style>
      .tab-bar { display: none !important; }
      [role="tabpanel"][hidden] { display: block !important; }
      [role="tabpanel"]::before {
        content: attr(aria-label);
        display: block; font-size: 1.375rem; font-weight: 600;
        margin-top: 2rem; margin-bottom: 0.75rem;
        padding-bottom: 0.5rem; border-bottom: 1px solid #e5e7eb;
      }
    </style>
  </noscript>
`;

function buildTabBar(sections: Section[]): string {
  const buttons = sections
    .map(
      (s, i) =>
        `<button role="tab" aria-selected="${i === 0 ? 'true' : 'false'}" data-tab="${i}">${escapeHtml(s.title)}</button>`,
    )
    .join('\n      ');
  return `\n    <nav class="tab-bar" role="tablist">\n      ${buttons}\n    </nav>\n`;
}

function buildPanels(sections: Section[]): string {
  return sections
    .map(
      (s, i) =>
        `<section role="tabpanel" data-panel="${i}" aria-label="${escapeHtml(s.title)}"${i > 0 ? ' hidden' : ''}>\n${s.content}\n</section>`,
    )
    .join('\n');
}

export function buildDocument(parts: DocumentParts): string {
  const { title, headerHtml, sections, tabbed, template } = parts;

  const css = [BASE_CSS, TEMPLATE_CSS[template], tabbed ? TAB_CSS : '', PRINT_CSS]
    .filter(Boolean)
    .join('\n');

  let bodyContent: string;

  if (tabbed && sections.length > 0) {
    bodyContent = `${headerHtml}${buildTabBar(sections)}${buildPanels(sections)}`;
  } else {
    const flat = sections.map((s) => `<h2>${escapeHtml(s.title)}</h2>\n${s.content}`).join('\n');
    bodyContent = headerHtml + flat;
  }

  const scriptBlock = tabbed ? `${TAB_SCRIPT}\n${NOSCRIPT_FALLBACK}` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>${css}
  </style>
</head>
<body>
  <article>
${bodyContent}
  </article>
${scriptBlock}
</body>
</html>
`;
}
