import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import { generateImage, isApiKeySet, classifyError } from '../image-gen/api.js';
import { DEFAULT_IMAGE_MODEL } from '../image-gen/types.js';
import { parseArgs } from '../image-gen/cli.js';

// ---------------------------------------------------------------------------
// Mock @google/genai — vi.hoisted ensures availability before vi.mock hoist
// ---------------------------------------------------------------------------

const { mockGenerateContent } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn(),
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent: mockGenerateContent };
  },
}));

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
  };
});

const mockReadFileSync = vi.mocked(fs.readFileSync);
const mockWriteFileSync = vi.mocked(fs.writeFileSync);
const mockExistsSync = vi.mocked(fs.existsSync);

const SAVED_ENV = process.env;

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...SAVED_ENV, GEMINI_API_KEY: 'test-key-123' };
});

afterEach(() => {
  process.env = SAVED_ENV;
});

// ---------------------------------------------------------------------------
// isApiKeySet
// ---------------------------------------------------------------------------

describe('isApiKeySet', () => {
  it('should return true when GEMINI_API_KEY is set', () => {
    process.env['GEMINI_API_KEY'] = 'test-key';
    expect(isApiKeySet()).toBe(true);
  });

  it('should return false when GEMINI_API_KEY is not set', () => {
    delete process.env['GEMINI_API_KEY'];
    expect(isApiKeySet()).toBe(false);
  });

  it('should return false when GEMINI_API_KEY is empty', () => {
    process.env['GEMINI_API_KEY'] = '';
    expect(isApiKeySet()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// classifyError
// ---------------------------------------------------------------------------

describe('classifyError', () => {
  it('should classify rate limit errors', () => {
    const result = classifyError(new Error('429 Too Many Requests'));
    expect(result.error).toBe('rate_limit');
  });

  it('should classify quota errors as rate limit', () => {
    const result = classifyError(new Error('Quota exceeded'));
    expect(result.error).toBe('rate_limit');
  });

  it('should classify resource exhausted as rate limit', () => {
    const result = classifyError(new Error('RESOURCE_EXHAUSTED'));
    expect(result.error).toBe('rate_limit');
  });

  it('should classify auth errors from API key issues', () => {
    const result = classifyError(new Error('Invalid API_KEY'));
    expect(result.error).toBe('auth_error');
  });

  it('should classify 401 as auth error', () => {
    const result = classifyError(new Error('HTTP 401 Unauthorized'));
    expect(result.error).toBe('auth_error');
  });

  it('should classify 403 as auth error', () => {
    const result = classifyError(new Error('HTTP 403 Forbidden'));
    expect(result.error).toBe('auth_error');
  });

  it('should classify safety filter errors', () => {
    const result = classifyError(new Error('Content blocked by safety filter'));
    expect(result.error).toBe('safety_filter');
  });

  it('should classify harmful content errors', () => {
    const result = classifyError(new Error('Response flagged as harmful'));
    expect(result.error).toBe('safety_filter');
  });

  it('should classify unknown errors as generation_error', () => {
    const result = classifyError(new Error('Something unexpected'));
    expect(result.error).toBe('generation_error');
    expect(result.errorMessage).toContain('Something unexpected');
  });

  it('should handle non-Error throws', () => {
    const result = classifyError('string error');
    expect(result.error).toBe('generation_error');
    expect(result.errorMessage).toBe('string error');
  });
});

// ---------------------------------------------------------------------------
// generateImage
// ---------------------------------------------------------------------------

describe('generateImage', () => {
  it('should return api_key_missing when no key is set', async () => {
    delete process.env['GEMINI_API_KEY'];

    const result = await generateImage({
      prompt: 'a mountain',
      output: '/tmp/test.png',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('api_key_missing');
  });

  it('should return reference_not_found when reference does not exist', async () => {
    mockExistsSync.mockReturnValue(false);

    const result = await generateImage({
      prompt: 'transform this',
      output: '/tmp/test.png',
      references: ['/path/to/missing.png'],
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('reference_not_found');
    expect(result.errorMessage).toContain('missing.png');
  });

  it('should generate image successfully with text and image parts', async () => {
    mockExistsSync.mockReturnValue(true);
    mockGenerateContent.mockResolvedValue({
      candidates: [{
        content: {
          parts: [
            { text: 'Here is your mountain scene' },
            { inlineData: { data: 'aW1hZ2VkYXRh', mimeType: 'image/png' } },
          ],
        },
      }],
    });

    const result = await generateImage({
      prompt: 'a mountain at sunset',
      output: '/tmp/test.png',
    });

    expect(result.success).toBe(true);
    expect(result.output).toBe('/tmp/test.png');
    expect(result.modelText).toBe('Here is your mountain scene');
    expect(result.model).toBe(DEFAULT_IMAGE_MODEL);
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      '/tmp/test.png',
      expect.any(Buffer)
    );
  });

  it('should return no_image when model returns only text', async () => {
    mockExistsSync.mockReturnValue(true);
    mockGenerateContent.mockResolvedValue({
      candidates: [{
        content: {
          parts: [
            { text: 'I cannot generate that image' },
          ],
        },
      }],
    });

    const result = await generateImage({
      prompt: 'something',
      output: '/tmp/test.png',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('no_image');
    expect(result.modelText).toBe('I cannot generate that image');
  });

  it('should return no_image when response has no candidates', async () => {
    mockGenerateContent.mockResolvedValue({
      candidates: [],
    });

    const result = await generateImage({
      prompt: 'something',
      output: '/tmp/test.png',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('no_image');
  });

  it('should load reference images as inline data', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(Buffer.from('fake-image-data'));
    mockGenerateContent.mockResolvedValue({
      candidates: [{
        content: {
          parts: [
            { inlineData: { data: 'aW1hZ2VkYXRh', mimeType: 'image/png' } },
          ],
        },
      }],
    });

    const result = await generateImage({
      prompt: 'transform this image',
      output: '/tmp/out.png',
      references: ['/tmp/ref.jpg'],
    });

    expect(result.success).toBe(true);
    expect(mockReadFileSync).toHaveBeenCalledWith('/tmp/ref.jpg');
    // Verify the generateContent call includes inline data
    const callArgs = mockGenerateContent.mock.calls[0][0];
    const parts = callArgs.contents[0].parts;
    expect(parts).toHaveLength(2);
    expect(parts[0]).toHaveProperty('inlineData');
    expect(parts[0].inlineData.mimeType).toBe('image/jpeg');
    expect(parts[1]).toHaveProperty('text', 'transform this image');
  });

  it('should create output directory if it does not exist', async () => {
    mockExistsSync.mockImplementation((p: fs.PathLike) => {
      if (String(p) === '/tmp/images') return false;
      return true;
    });
    mockGenerateContent.mockResolvedValue({
      candidates: [{
        content: {
          parts: [
            { inlineData: { data: 'aW1hZ2VkYXRh', mimeType: 'image/png' } },
          ],
        },
      }],
    });

    const result = await generateImage({
      prompt: 'test',
      output: '/tmp/images/out.png',
    });

    expect(result.success).toBe(true);
    expect(vi.mocked(fs.mkdirSync)).toHaveBeenCalledWith('/tmp/images', { recursive: true });
  });

  it('should append extension when output has no extension', async () => {
    mockExistsSync.mockReturnValue(true);
    mockGenerateContent.mockResolvedValue({
      candidates: [{
        content: {
          parts: [
            { inlineData: { data: 'aW1hZ2VkYXRh', mimeType: 'image/jpeg' } },
          ],
        },
      }],
    });

    const result = await generateImage({
      prompt: 'test',
      output: '/tmp/output',
    });

    expect(result.success).toBe(true);
    expect(result.output).toBe('/tmp/output.jpg');
  });

  it('should classify rate limit errors from the SDK', async () => {
    mockGenerateContent.mockRejectedValue(new Error('429 Resource Exhausted'));

    const result = await generateImage({
      prompt: 'test',
      output: '/tmp/test.png',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('rate_limit');
  });

  it('should classify safety filter errors from the SDK', async () => {
    mockGenerateContent.mockRejectedValue(new Error('Content was blocked by safety filters'));

    const result = await generateImage({
      prompt: 'test',
      output: '/tmp/test.png',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('safety_filter');
  });

  it('should use custom model when specified', async () => {
    mockGenerateContent.mockResolvedValue({
      candidates: [{
        content: {
          parts: [
            { inlineData: { data: 'aW1hZ2VkYXRh', mimeType: 'image/png' } },
          ],
        },
      }],
    });
    mockExistsSync.mockReturnValue(true);

    const result = await generateImage({
      prompt: 'test',
      output: '/tmp/test.png',
      model: 'gemini-2.0-flash-preview-image-generation',
    });

    expect(result.success).toBe(true);
    expect(result.model).toBe('gemini-2.0-flash-preview-image-generation');
    const callArgs = mockGenerateContent.mock.calls[0][0];
    expect(callArgs.model).toBe('gemini-2.0-flash-preview-image-generation');
  });

  it('should concatenate multiple text parts', async () => {
    mockExistsSync.mockReturnValue(true);
    mockGenerateContent.mockResolvedValue({
      candidates: [{
        content: {
          parts: [
            { text: 'First part' },
            { text: 'Second part' },
            { inlineData: { data: 'aW1hZ2VkYXRh', mimeType: 'image/png' } },
          ],
        },
      }],
    });

    const result = await generateImage({
      prompt: 'test',
      output: '/tmp/test.png',
    });

    expect(result.success).toBe(true);
    expect(result.modelText).toBe('First part\nSecond part');
  });

  it('should handle empty references array without error', async () => {
    mockExistsSync.mockReturnValue(true);
    mockGenerateContent.mockResolvedValue({
      candidates: [{
        content: {
          parts: [
            { inlineData: { data: 'aW1hZ2VkYXRh', mimeType: 'image/png' } },
          ],
        },
      }],
    });

    const result = await generateImage({
      prompt: 'test',
      output: '/tmp/test.png',
      references: [],
    });

    expect(result.success).toBe(true);
    // No reference images should be in the content parts
    const callArgs = mockGenerateContent.mock.calls[0][0];
    const parts = callArgs.contents[0].parts;
    expect(parts).toHaveLength(1);
    expect(parts[0]).toHaveProperty('text', 'test');
  });

  it('should pass size as imageConfig.imageSize to the SDK', async () => {
    mockExistsSync.mockReturnValue(true);
    mockGenerateContent.mockResolvedValue({
      candidates: [{
        content: {
          parts: [
            { inlineData: { data: 'aW1hZ2VkYXRh', mimeType: 'image/png' } },
          ],
        },
      }],
    });

    await generateImage({
      prompt: 'test',
      output: '/tmp/test.png',
      size: '4K',
    });

    const callArgs = mockGenerateContent.mock.calls[0][0];
    expect(callArgs.config.imageConfig).toEqual({ imageSize: '4K' });
  });

  it('should pass aspectRatio as imageConfig.aspectRatio to the SDK', async () => {
    mockExistsSync.mockReturnValue(true);
    mockGenerateContent.mockResolvedValue({
      candidates: [{
        content: {
          parts: [
            { inlineData: { data: 'aW1hZ2VkYXRh', mimeType: 'image/png' } },
          ],
        },
      }],
    });

    await generateImage({
      prompt: 'test',
      output: '/tmp/test.png',
      aspectRatio: '16:9',
    });

    const callArgs = mockGenerateContent.mock.calls[0][0];
    expect(callArgs.config.imageConfig).toEqual({ aspectRatio: '16:9' });
  });

  it('should pass both size and aspectRatio together', async () => {
    mockExistsSync.mockReturnValue(true);
    mockGenerateContent.mockResolvedValue({
      candidates: [{
        content: {
          parts: [
            { inlineData: { data: 'aW1hZ2VkYXRh', mimeType: 'image/png' } },
          ],
        },
      }],
    });

    await generateImage({
      prompt: 'test',
      output: '/tmp/test.png',
      size: '2K',
      aspectRatio: '1:1',
    });

    const callArgs = mockGenerateContent.mock.calls[0][0];
    expect(callArgs.config.imageConfig).toEqual({ imageSize: '2K', aspectRatio: '1:1' });
  });

  it('should not include imageConfig when size and aspectRatio are absent', async () => {
    mockExistsSync.mockReturnValue(true);
    mockGenerateContent.mockResolvedValue({
      candidates: [{
        content: {
          parts: [
            { inlineData: { data: 'aW1hZ2VkYXRh', mimeType: 'image/png' } },
          ],
        },
      }],
    });

    await generateImage({
      prompt: 'test',
      output: '/tmp/test.png',
    });

    const callArgs = mockGenerateContent.mock.calls[0][0];
    expect(callArgs.config.imageConfig).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// parseArgs (CLI)
// ---------------------------------------------------------------------------

describe('parseArgs', () => {
  it('should parse --prompt and --output', () => {
    const args = parseArgs(['--prompt', 'a mountain', '--output', '/tmp/test.png']);
    expect(args.prompt).toBe('a mountain');
    expect(args.output).toBe('/tmp/test.png');
    expect(args.size).toBe('1K');
    expect(args.references).toEqual([]);
    expect(args.aspectRatio).toBeNull();
  });

  it('should parse --size', () => {
    const args = parseArgs(['--prompt', 'test', '--output', 'out.png', '--size', '4K']);
    expect(args.size).toBe('4K');
  });

  it('should parse multiple --reference flags', () => {
    const args = parseArgs([
      '--prompt', 'test',
      '--output', 'out.png',
      '--reference', '/tmp/a.png',
      '--reference', '/tmp/b.jpg',
    ]);
    expect(args.references).toEqual(['/tmp/a.png', '/tmp/b.jpg']);
  });

  it('should parse --aspect-ratio', () => {
    const args = parseArgs([
      '--prompt', 'test',
      '--output', 'out.png',
      '--aspect-ratio', '16:9',
    ]);
    expect(args.aspectRatio).toBe('16:9');
  });

  it('should exit with error when --prompt is missing', () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
    const mockError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => parseArgs(['--output', 'out.png'])).toThrow('process.exit');
    expect(mockError).toHaveBeenCalledWith('--prompt is required');

    mockExit.mockRestore();
    mockError.mockRestore();
  });

  it('should exit with error when --output is missing', () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
    const mockError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => parseArgs(['--prompt', 'test'])).toThrow('process.exit');
    expect(mockError).toHaveBeenCalledWith('--output is required');

    mockExit.mockRestore();
    mockError.mockRestore();
  });

  it('should exit with error for invalid --size', () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
    const mockError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => parseArgs(['--prompt', 'test', '--output', 'out.png', '--size', '8K'])).toThrow('process.exit');
    expect(mockError).toHaveBeenCalledWith('Invalid size: 8K');

    mockExit.mockRestore();
    mockError.mockRestore();
  });
});
