/**
 * Gemini image generation module.
 */

export { isApiKeySet, generateImage, classifyError } from './api.js';
export type {
  ImageModel,
  ImageGenOptions,
  ImageGenResult,
  ImageGenErrorReason,
} from './types.js';
