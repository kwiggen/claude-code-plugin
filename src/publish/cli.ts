#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { convertMarkdown } from './converter.js';
import type { TemplateName } from './types.js';
import { VALID_TEMPLATES } from './types.js';

export interface CliArgs {
  input: string | null;
  output: string;
  template: TemplateName;
  title: string | null;
  tabs: boolean | null;
}

export function parseArgs(argv: string[]): CliArgs {
  let input: string | null = null;
  let output: string | null = null;
  let template: TemplateName = 'default';
  let title: string | null = null;
  let tabs: boolean | null = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--input' && i + 1 < argv.length) {
      input = argv[++i];
    } else if (arg === '--output' && i + 1 < argv.length) {
      output = argv[++i];
    } else if (arg === '--template' && i + 1 < argv.length) {
      const val = argv[++i];
      if (VALID_TEMPLATES.includes(val as TemplateName)) {
        template = val as TemplateName;
      } else {
        console.error(`Invalid template: ${val}`);
        console.error(`Valid templates: ${VALID_TEMPLATES.join(', ')}`);
        process.exit(1);
      }
    } else if (arg === '--title' && i + 1 < argv.length) {
      title = argv[++i];
    } else if (arg === '--tabs') {
      tabs = true;
    } else if (arg === '--no-tabs') {
      tabs = false;
    }
  }

  if (!output) {
    console.error('--output is required');
    process.exit(1);
  }

  return { input, output, template, title, tabs };
}

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve('');
      return;
    }
    const chunks: Buffer[] = [];
    process.stdin.on('data', (chunk: Buffer) => chunks.push(chunk));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    process.stdin.on('error', () => resolve(''));
  });
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  let markdown: string;

  if (args.input) {
    try {
      markdown = readFileSync(args.input, 'utf-8');
    } catch {
      console.error(`Cannot read input file: ${args.input}`);
      process.exit(1);
    }
  } else {
    markdown = await readStdin();
    if (!markdown) {
      console.error('No input: provide --input file or pipe markdown via stdin');
      process.exit(1);
    }
  }

  const result = await convertMarkdown({
    markdown,
    output: args.output,
    template: args.template,
    title: args.title ?? undefined,
    tabs: args.tabs ?? undefined,
  });

  console.log(JSON.stringify(result, null, 2));

  if (!result.success) {
    process.exit(1);
  }
}

/* istanbul ignore next -- CLI entrypoint guard */
if (process.argv[1]?.endsWith('cli.js')) {
  main();
}
