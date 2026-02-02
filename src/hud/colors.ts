/**
 * ANSI color helpers for statusline output.
 *
 * OMC Pattern: Each color is a simple wrapper function that adds ANSI escape codes.
 * The statusbar renders in a terminal, so ANSI codes work directly.
 */

const RESET = '\x1b[0m';

export const bold = (s: string): string => `\x1b[1m${s}${RESET}`;
export const dim = (s: string): string => `\x1b[2m${s}${RESET}`;
export const cyan = (s: string): string => `\x1b[36m${s}${RESET}`;
export const green = (s: string): string => `\x1b[32m${s}${RESET}`;
export const yellow = (s: string): string => `\x1b[33m${s}${RESET}`;
export const red = (s: string): string => `\x1b[31m${s}${RESET}`;
export const magenta = (s: string): string => `\x1b[35m${s}${RESET}`;
export const blue = (s: string): string => `\x1b[34m${s}${RESET}`;
