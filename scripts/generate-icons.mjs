#!/usr/bin/env node

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * IconCraft — Ultra-lightweight Zero-Dependency SVG Sprite Compiler
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { watch } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

// Parse CLI flags
const args = process.argv.slice(2);
const isWatch = args.includes('--watch') || args.includes('-w');

function getArgValue(flag, defaultValue) {
  const index = args.indexOf(flag);
  if (index !== -1 && index + 1 < args.length) {
    return args[index + 1];
  }
  return defaultValue;
}

const inputDir = resolve(projectRoot, getArgValue('--input', 'src/icons'));
const outputSprite = resolve(projectRoot, getArgValue('--output-sprite', 'public/sprite.svg'));
const outputTypes = resolve(projectRoot, getArgValue('--output-types', 'src/components/icon.types.ts'));
const symbolPrefix = getArgValue('--prefix', 'icon-');

/**
 * Ensures a directory exists synchronously.
 */
function ensureDir(dirPath) {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Normalizes an icon filename to a clean kebab-case identifier.
 * e.g., "arrow-left.svg" -> "arrow-left"
 *       "Google.color.svg" -> "google"
 *       "user_profile.svg" -> "user-profile"
 */
export function sanitizeIconName(fileName) {
  let name = fileName;
  if (name.endsWith('.color.svg')) {
    name = name.slice(0, -'.color.svg'.length);
  } else if (name.endsWith('.svg')) {
    name = name.slice(0, -'.svg'.length);
  }

  return name
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+|-+$/g, '');
}

/**
 * Checks whether an SVG file should preserve multi-color fills.
 */
export function isMultiColorFile(fileName) {
  return (
    fileName.endsWith('.color.svg') ||
    fileName.includes('.color.') ||
    fileName.includes('-color.') ||
    fileName.includes('_color.')
  );
}

/**
 * Sanitizes and normalizes raw SVG markup into an optimized <symbol> element.
 */
export function compileSvgToSymbol(rawSvg, iconName, isMultiColor, prefix = 'icon-') {
  // 1. Strip XML declarations, DOCTYPE, and comments
  let clean = rawSvg
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/<!--[\s\S]*?-->/gi, '')
    .trim();

  // 2. Extract opening <svg ...> tag and its attributes
  const svgOpenMatch = clean.match(/<svg([^>]*)>/i);
  if (!svgOpenMatch) {
    throw new Error(`Invalid SVG file: missing <svg> opening tag in icon "${iconName}"`);
  }

  const svgAttrs = svgOpenMatch[1];

  // 3. Resolve viewBox coordinates
  let viewBox = '';
  const viewBoxMatch = svgAttrs.match(/viewBox=["']([^"']+)["']/i);
  if (viewBoxMatch) {
    viewBox = viewBoxMatch[1].trim();
  } else {
    // Attempt fallback from width and height
    const widthMatch = svgAttrs.match(/width=["'](\d+(?:\.\d+)?)(?:px)?["']/i);
    const heightMatch = svgAttrs.match(/height=["'](\d+(?:\.\d+)?)(?:px)?["']/i);
    if (widthMatch && heightMatch) {
      viewBox = `0 0 ${widthMatch[1]} ${heightMatch[1]}`;
    } else {
      viewBox = '0 0 24 24'; // Standard fallback
    }
  }

  // 4. Extract inner markup between <svg...> and </svg>
  const innerMarkupMatch = clean.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
  let innerMarkup = innerMarkupMatch ? innerMarkupMatch[1].trim() : '';

  // 5. Clean non-essential tags (e.g. metadata, foreignObject) if needed
  innerMarkup = innerMarkup
    .replace(/<metadata[\s\S]*?<\/metadata>/gi, '')
    .replace(/<title[\s\S]*?<\/title>/gi, '')
    .replace(/<desc[\s\S]*?<\/desc>/gi, '');

  // 6. Color normalization (monochrome vs multi-color)
  if (!isMultiColor) {
    // Replace non-none fill with currentColor
    innerMarkup = innerMarkup.replace(
      /\sfill=["'](?!(?:none|currentColor|inherit|url\([^)]+\)))[^"']+["']/gi,
      ' fill="currentColor"'
    );

    // Replace non-none stroke with currentColor
    innerMarkup = innerMarkup.replace(
      /\sstroke=["'](?!(?:none|currentColor|inherit|url\([^)]+\)))[^"']+["']/gi,
      ' stroke="currentColor"'
    );
  }

  // 7. Strip inline ids or scope them if necessary to prevent collisions
  // For standard symbols, we remove redundant root id attributes from inner shapes unless referenced
  const symbolId = `${prefix}${iconName}`;

  return {
    id: symbolId,
    name: iconName,
    viewBox,
    isMultiColor,
    symbolMarkup: `<symbol id="${symbolId}" viewBox="${viewBox}">${innerMarkup}</symbol>`,
  };
}

/**
 * Compiles all SVG files in inputDir into sprite.svg and icon.types.ts
 */
export function compileIcons(options = {}) {
  const startTime = performance.now();
  const dir = options.inputDir || inputDir;
  const spritePath = options.outputSprite || outputSprite;
  const typesPath = options.outputTypes || outputTypes;
  const prefix = options.prefix || symbolPrefix;

  ensureDir(dir);
  ensureDir(dirname(spritePath));
  ensureDir(dirname(typesPath));

  const entries = readdirSync(dir);
  const svgFiles = entries
    .filter((file) => extname(file).toLowerCase() === '.svg')
    .sort((a, b) => a.localeCompare(b));

  const symbols = [];
  const iconNames = [];
  const processedNames = new Set();

  for (const file of svgFiles) {
    const fullPath = join(dir, file);
    try {
      const stats = statSync(fullPath);
      if (!stats.isFile()) continue;

      const rawSvg = readFileSync(fullPath, 'utf8');
      const iconName = sanitizeIconName(file);
      if (!iconName) continue;

      // Handle duplicate names gracefully
      if (processedNames.has(iconName)) {
        console.warn(`[IconCraft] Warning: Duplicate icon name encountered: "${iconName}" in ${file}`);
        continue;
      }
      processedNames.add(iconName);

      const isMultiColor = isMultiColorFile(file);
      const symbol = compileSvgToSymbol(rawSvg, iconName, isMultiColor, prefix);
      symbols.push(symbol);
      iconNames.push(iconName);
    } catch (err) {
      console.error(`[IconCraft] Error processing ${file}:`, err.message);
    }
  }

  // Generate sprite.svg
  const spriteContent = [
    '<svg xmlns="http://www.w3.org/2000/svg" style="display: none;">',
    ...symbols.map((s) => `  ${s.symbolMarkup}`),
    '</svg>',
    '',
  ].join('\n');

  writeFileSync(spritePath, spriteContent, 'utf8');

  // Generate icon.types.ts
  const typesContent = [
    '// Auto-generated by IconCraft — do not edit manually',
    `// Compiled ${symbols.length} icons at ${new Date().toISOString()}`,
    '',
    'export const ICON_NAMES = [',
    ...iconNames.map((name) => `  "${name}",`),
    '] as const;',
    '',
    'export type IconName = (typeof ICON_NAMES)[number];',
    '',
    'export interface IconMetadata {',
    '  name: IconName;',
    '  viewBox: string;',
    '  isMultiColor: boolean;',
    '}',
    '',
    'export const ICON_METADATA: Record<IconName, { viewBox: string; isMultiColor: boolean }> = {',
    ...symbols.map(
      (s) => `  "${s.name}": { viewBox: "${s.viewBox}", isMultiColor: ${s.isMultiColor} },`
    ),
    '};',
    '',
  ].join('\n');

  writeFileSync(typesPath, typesContent, 'utf8');

  const duration = (performance.now() - startTime).toFixed(2);
  const spriteSize = (Buffer.byteLength(spriteContent, 'utf8') / 1024).toFixed(2);

  return {
    count: symbols.length,
    duration,
    spriteSize,
    symbols,
    iconNames,
  };
}

export function runCli(customArgs = process.argv.slice(2)) {
  try {
    const result = compileIcons();
    console.log(
      `\x1b[32m✔\x1b[0m [IconCraft] Compiled ${result.count} icons into public/sprite.svg (${result.spriteSize} KB) in ${result.duration}ms`
    );

    if (isWatch) {
      console.log(`\x1b[36mℹ\x1b[0m [IconCraft] Watching for SVG changes in ${inputDir}...`);

      let debounceTimer = null;
      watch(inputDir, (eventType, filename) => {
        if (!filename || !filename.toLowerCase().endsWith('.svg')) return;

        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          try {
            const recompiled = compileIcons();
            console.log(
              `\x1b[32m✔\x1b[0m [IconCraft] Recompiled ${recompiled.count} icons in ${recompiled.duration}ms`
            );
          } catch (err) {
            console.error(`\x1b[31m✖\x1b[0m [IconCraft] Recompilation error:`, err.message);
          }
        }, 50);
      });
    }
    return result;
  } catch (err) {
    console.error(`\x1b[31m✖\x1b[0m [IconCraft] Fatal error:`, err);
    process.exit(1);
  }
}

// Main execution when called directly from CLI
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runCli();
}
