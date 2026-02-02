/**
 * Config Module
 *
 * Re-exports everything from the loader for clean imports:
 *   import { loadConfig, DEFAULT_CONFIG } from './config/index.js';
 */

export {
  loadConfig,
  loadJsoncFile,
  loadEnvConfig,
  getConfigPaths,
  deepMerge,
  DEFAULT_CONFIG,
} from './loader.js';
