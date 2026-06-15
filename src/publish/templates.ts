import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
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

const require = createRequire(import.meta.url);
const SIMPLE_CSS = readFileSync(
  require.resolve('simpledotcss/simple.min.css'),
  'utf-8',
);

const OVERRIDE_CSS = `
  h1 { font-size: 2rem; margin-bottom: 1.5rem; padding-bottom: 0.5rem; border-bottom: var(--border-width) solid var(--border); }
  h2 { font-size: 1.5rem; margin-top: 2rem; margin-bottom: 0.75rem; }
  h3 { font-size: 1.25rem; margin-top: 1.5rem; }
  h4 { font-size: 1.1rem; }

  section[role="tabpanel"] {
    border: none; margin: 0; padding: 0;
  }
  section[role="tabpanel"][hidden] { display: none; }

  .shiki {
    border-radius: var(--standard-border-radius);
    overflow-x: auto; margin-bottom: 1rem;
  }
  .shiki code { font-size: 0.85em; }
`;

const TAB_CSS = `
  .tab-bar {
    display: flex; gap: 0;
    border-bottom: var(--border-width) solid var(--border);
    margin-bottom: 1.5rem;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  .tab-bar button {
    background: none; border: none; border-radius: 0;
    padding: 0.625rem 1.25rem;
    font-size: 0.875rem; font-family: inherit; font-weight: 500;
    cursor: pointer; color: var(--text-light);
    border-bottom: 2px solid transparent;
    margin-bottom: calc(-1 * var(--border-width));
    white-space: nowrap;
    transition: color 0.15s, border-color 0.15s;
  }
  .tab-bar button[aria-selected="true"] {
    color: var(--accent); border-bottom-color: var(--accent); font-weight: 600;
  }
  .tab-bar button:hover,
  .tab-bar button:enabled:hover {
    color: var(--accent-hover);
    background: none; border-color: transparent;
    border-bottom-color: var(--accent-hover);
    cursor: pointer;
  }
`;

const TEMPLATE_CSS: Record<TemplateName, string> = {
  default: '',
  report: `
    blockquote:first-of-type {
      border-inline-start-color: var(--accent);
    }
  `,
  review: `
    .shiki .line::before { content: none; }
    .shiki .diff.add { background-color: #dafbe1; }
    .shiki .diff.remove { background-color: #ffebe9; }
  `,
  briefing: `
    body { font-size: 1.2rem; }
    h1 { font-size: 2.5rem; }
    h2 { font-size: 1.75rem; }
  `,
};

const PRINT_CSS = `
  @media print {
    .tab-bar { display: none !important; }
    [role="tabpanel"] { display: block !important; }
    [role="tabpanel"][hidden] { display: block !important; }
    .shiki span { color: #000 !important; }
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
        display: block; font-size: 1.5rem; font-weight: 600;
        margin-top: 2rem; margin-bottom: 0.75rem;
        padding-bottom: 0.5rem; border-bottom: var(--border-width) solid var(--border);
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

  const css = [
    SIMPLE_CSS,
    OVERRIDE_CSS,
    TEMPLATE_CSS[template],
    tabbed ? TAB_CSS : '',
    PRINT_CSS,
  ]
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
  <meta name="color-scheme" content="light dark">
  <title>${escapeHtml(title)}</title>
  <style>${css}
  </style>
</head>
<body>
  <main>
${bodyContent}
  </main>
${scriptBlock}
</body>
</html>
`;
}
