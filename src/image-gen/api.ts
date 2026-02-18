/**
 * Gemini image generation API wrapper using @google/genai SDK.
 */

import { GoogleGenAI } from '@google/genai';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DEFAULT_IMAGE_MODEL } from './types.js';
import type { ImageGenOptions, ImageGenResult, ImageGenErrorReason } from './types.js';

/**
 * Check whether the GEMINI_API_KEY environment variable is set.
 */
export function isApiKeySet(): boolean {
  return !!process.env['GEMINI_API_KEY'];
}

/**
 * Infer MIME type from a file extension.
 */
function mimeTypeFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
  };
  return mimeMap[ext] ?? 'image/png';
}

/**
 * Load a reference image file as a base64-encoded inline data part.
 */
function loadReferenceImage(filePath: string): { inlineData: { data: string; mimeType: string } } {
  const data = fs.readFileSync(filePath);
  return {
    inlineData: {
      data: data.toString('base64'),
      mimeType: mimeTypeFromPath(filePath),
    },
  };
}

/**
 * Classify a caught error into an ImageGenErrorReason.
 */
export function classifyError(err: unknown): { error: ImageGenErrorReason; errorMessage: string } {
  if (!(err instanceof Error)) {
    return { error: 'generation_error', errorMessage: String(err) };
  }

  const msg = err.message.toLowerCase();

  if (msg.includes('api_key') || msg.includes('api key') || msg.includes('apikey')) {
    return { error: 'auth_error', errorMessage: err.message };
  }
  if (msg.includes('429') || msg.includes('rate limit') || msg.includes('resource_exhausted') || msg.includes('resource exhausted') || msg.includes('quota')) {
    return { error: 'rate_limit', errorMessage: err.message };
  }
  if (msg.includes('401') || msg.includes('403') || msg.includes('authentication') || msg.includes('permission')) {
    return { error: 'auth_error', errorMessage: err.message };
  }
  if (msg.includes('safety') || msg.includes('blocked') || msg.includes('harmful')) {
    return { error: 'safety_filter', errorMessage: err.message };
  }

  return { error: 'generation_error', errorMessage: err.message };
}

/**
 * Generate an image using the Gemini API.
 *
 * Builds a multimodal request with optional reference images,
 * sends to the specified model, and saves the resulting image to disk.
 */
export async function generateImage(options: ImageGenOptions): Promise<ImageGenResult> {
  const { prompt, output, references, size, aspectRatio, model: requestedModel } = options;
  const model = requestedModel ?? DEFAULT_IMAGE_MODEL;

  // Check API key
  const apiKey = process.env['GEMINI_API_KEY'];
  if (!apiKey) {
    return {
      success: false,
      model,
      error: 'api_key_missing',
      errorMessage: 'GEMINI_API_KEY environment variable is not set. Get a free key at https://aistudio.google.com/apikey',
    };
  }

  // Validate reference images exist
  if (references && references.length > 0) {
    for (const ref of references) {
      if (!fs.existsSync(ref)) {
        return {
          success: false,
          model,
          error: 'reference_not_found',
          errorMessage: `Reference image not found: ${ref}`,
        };
      }
    }
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    // Build content parts: reference images first, then text prompt
    const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [];

    if (references && references.length > 0) {
      for (const ref of references) {
        parts.push(loadReferenceImage(ref));
      }
    }

    parts.push({ text: prompt });

    // Build image config from size/aspectRatio options
    const imageConfig: Record<string, string> = {};
    if (size) {
      imageConfig['imageSize'] = size;
    }
    if (aspectRatio) {
      imageConfig['aspectRatio'] = aspectRatio;
    }

    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts }],
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
        ...(Object.keys(imageConfig).length > 0 ? { imageConfig } : {}),
      },
    });

    // Extract text and image from response
    let modelText: string | undefined;
    let imageData: string | undefined;
    let imageMimeType: string | undefined;

    const candidate = response.candidates?.[0];
    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.text) {
          modelText = modelText ? `${modelText}\n${part.text}` : part.text;
        }
        if (part.inlineData?.data) {
          imageData = part.inlineData.data;
          imageMimeType = part.inlineData.mimeType ?? 'image/png';
        }
      }
    }

    if (!imageData) {
      return {
        success: false,
        model,
        modelText,
        error: 'no_image',
        errorMessage: 'Model did not return an image in the response',
      };
    }

    // Determine output file extension based on MIME type
    let outputPath = output;
    if (imageMimeType && !path.extname(output)) {
      const extMap: Record<string, string> = {
        'image/png': '.png',
        'image/jpeg': '.jpg',
        'image/webp': '.webp',
        'image/gif': '.gif',
      };
      outputPath = output + (extMap[imageMimeType] ?? '.png');
    }

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (outputDir && !fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Save image to disk
    fs.writeFileSync(outputPath, Buffer.from(imageData, 'base64'));

    return {
      success: true,
      output: outputPath,
      modelText,
      model,
    };
  } catch (err: unknown) {
    const classified = classifyError(err);
    return {
      success: false,
      model,
      ...classified,
    };
  }
}
