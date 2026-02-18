/**
 * TypeScript types for Gemini image generation.
 */

/**
 * Supported Gemini image generation models.
 * Currently only gemini-2.0-flash-preview-image-generation is available.
 */
export type ImageModel = 'gemini-2.0-flash-preview-image-generation';

/**
 * Options for generating an image.
 */
export interface ImageGenOptions {
  /** Enhanced prompt text for image generation */
  prompt: string;
  /** Output file path for the generated image */
  output: string;
  /** Optional reference image file paths for image-to-image generation */
  references?: string[];
  /** Output resolution */
  size?: '1K' | '2K' | '4K';
  /** Aspect ratio (e.g. '16:9', '1:1') */
  aspectRatio?: string;
  /** Model to use (defaults to gemini-2.0-flash-preview-image-generation) */
  model?: ImageModel;
}

/**
 * Result from an image generation request.
 */
export interface ImageGenResult {
  /** Whether the generation succeeded */
  success: boolean;
  /** Saved file path on success */
  output?: string;
  /** Any text the model returned alongside the image */
  modelText?: string;
  /** Which model was used */
  model: string;
  /** Error reason if failed */
  error?: ImageGenErrorReason;
  /** Raw error message */
  errorMessage?: string;
}

/**
 * Classified error reasons for image generation failures.
 */
export type ImageGenErrorReason =
  | 'api_key_missing'
  | 'rate_limit'
  | 'auth_error'
  | 'safety_filter'
  | 'no_image'
  | 'reference_not_found'
  | 'generation_error';
