#!/usr/bin/env node
/**
 * CLI entrypoint for Gemini image generation.
 * Usage: node dist/image-gen/cli.js --prompt "..." --output "..." [--size 1K|2K|4K] [--reference path ...] [--aspect-ratio 16:9]
 */

import { generateImage } from './api.js';
import type { ImageGenOptions } from './types.js';

export interface CliArgs {
  prompt: string;
  output: string;
  size: '1K' | '2K' | '4K';
  references: string[];
  aspectRatio: string | null;
}

const VALID_SIZES = ['1K', '2K', '4K'] as const;

export function parseArgs(argv: string[]): CliArgs {
  let prompt: string | null = null;
  let output: string | null = null;
  let size: '1K' | '2K' | '4K' = '1K';
  const references: string[] = [];
  let aspectRatio: string | null = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--prompt' && i + 1 < argv.length) {
      prompt = argv[++i];
    } else if (arg === '--output' && i + 1 < argv.length) {
      output = argv[++i];
    } else if (arg === '--size' && i + 1 < argv.length) {
      const val = argv[++i] as '1K' | '2K' | '4K';
      if (VALID_SIZES.includes(val)) {
        size = val;
      } else {
        console.error(`Invalid size: ${val}`);
        console.error(`Valid sizes: ${VALID_SIZES.join(', ')}`);
        process.exit(1);
      }
    } else if (arg === '--reference' && i + 1 < argv.length) {
      references.push(argv[++i]);
    } else if (arg === '--aspect-ratio' && i + 1 < argv.length) {
      aspectRatio = argv[++i];
    }
  }

  if (!prompt) {
    console.error('--prompt is required');
    process.exit(1);
  }

  if (!output) {
    console.error('--output is required');
    process.exit(1);
  }

  return { prompt, output, size, references, aspectRatio };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const options: ImageGenOptions = {
    prompt: args.prompt,
    output: args.output,
    size: args.size,
    references: args.references.length > 0 ? args.references : undefined,
    aspectRatio: args.aspectRatio ?? undefined,
  };

  const result = await generateImage(options);

  // Output JSON to stdout for the skill to parse
  console.log(JSON.stringify(result, null, 2));

  if (!result.success) {
    process.exit(1);
  }
}

/* istanbul ignore next -- CLI entrypoint guard */
if (process.argv[1]?.endsWith('cli.js')) {
  main();
}
