export type TemplateName = 'default' | 'report' | 'review' | 'briefing';

export const VALID_TEMPLATES = ['default', 'report', 'review', 'briefing'] as const;

export const TAB_DEFAULT_TEMPLATES: readonly TemplateName[] = ['report', 'review'];

export const TAB_THRESHOLD = 3;

export interface PublishOptions {
  markdown: string;
  template?: TemplateName;
  title?: string;
  tabs?: boolean;
  output: string;
}

export interface PublishResult {
  success: boolean;
  outputPath?: string;
  title: string;
  template: TemplateName;
  tabbed: boolean;
  sectionCount: number;
  wordCount: number;
  error?: string;
  errorMessage?: string;
}

export interface Section {
  title: string;
  content: string;
}
