import { invoke } from '@tauri-apps/api/core';

import { assertValidMimeType, KEEP_TAGS, readTagsWithSidecar, runExiftoolSidecar } from './exiftool';
import { basename, copyThenRemove, joinPath, parseFilename, readFileForDisplay } from './fs_utils';
import { type CleanRaw, type CleanedResult, emptyImageInfo, lookupMimeType, type ProcessOptions } from './types';

const DISPLAY_MIME_TYPES = [
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

function formatError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function errorResult(filename: string, err: unknown): CleanedResult {
  return {
    origImage: { ...emptyImageInfo, filename: basename(filename) },
    cleanedImage: emptyImageInfo,
    errors: [formatError(err)],
    warnings: [],
    info: [],
  };
}

async function readTagsOnly(filename: string): Promise<{ origTags: string; errors: string[] }> {
  assertValidMimeType(filename);
  const { tags, errors } = await readTagsWithSidecar(filename);
  return { origTags: tags, errors };
}

async function cleanMetadata(filename: string, outputDir?: string | null): Promise<CleanRaw> {
  const errors: string[] = [];
  const warnings: string[] = [];

  assertValidMimeType(filename);

  const { tags: origTags, errors: readErrors } = await readTagsWithSidecar(filename);
  errors.push(...readErrors);

  const { parent, stem, ext } = parseFilename(filename);
  const cleanedFilename = joinPath(outputDir ?? parent, `${stem}-cleaned.${ext}`);

  const [copyCode, copyMessage] = await invoke<[number, string]>('copy_file', {
    src: filename,
    dst: cleanedFilename,
  });
  if (copyCode !== 0) {
    errors.push(copyMessage);
  }

  const keepTagsArgs = ['-TagsFromFile', '@', ...KEEP_TAGS];
  const cleanArgs = ['-all:all=', '-CommonIFD0=', '-overwrite_original', ...keepTagsArgs, cleanedFilename];

  const cleanAll = await runExiftoolSidecar(cleanArgs);
  errors.push(...cleanAll.errors);
  warnings.push(...cleanAll.warnings);

  const cleanTime = await runExiftoolSidecar(['-time:all=', '-overwrite_original', cleanedFilename]);
  errors.push(...cleanTime.errors);
  warnings.push(...cleanTime.warnings);

  const { tags: cleanedTags } = await readTagsWithSidecar(cleanedFilename);

  return { origTags, cleanedFilename, cleanedTags, errors, warnings };
}

function canDisplay(mimeType: string): boolean {
  return (DISPLAY_MIME_TYPES as readonly string[]).includes(mimeType);
}

async function processReadOnly(
  filename: string,
  loadImageData: boolean,
): Promise<CleanedResult> {
  const { origTags, errors } = await readTagsOnly(filename);
  const info: string[] = [];
  let origImageData = '';
  const origMimeType = lookupMimeType(filename);

  if (loadImageData && canDisplay(origMimeType)) {
    const res = await readFileForDisplay(filename);
    origImageData = res.data;
  } else if (loadImageData && origMimeType) {
    info.push(`Not displaying ${basename(filename)} because media type ${origMimeType} can not be displayed.`);
  }

  return {
    origImage: { filename: basename(filename), imageData: origImageData, mimeType: origMimeType, tags: origTags },
    cleanedImage: emptyImageInfo,
    errors,
    warnings: [],
    info,
  };
}

async function processAndClean(
  filename: string,
  loadImageData: boolean,
  saveMode: string,
  outputDir: string | null,
): Promise<CleanedResult> {
  const cleanRaw = await cleanMetadata(filename, outputDir);
  const info: string[] = [];

  let origImageData = '';
  let cleanedImageData = '';
  const origMimeType = lookupMimeType(filename);
  const cleanedMimeType = lookupMimeType(cleanRaw.cleanedFilename);

  if (loadImageData) {
    if (canDisplay(origMimeType)) {
      const origRes = await readFileForDisplay(filename);
      origImageData = origRes.error ? '' : origRes.data;

      const cleanedRes = await readFileForDisplay(cleanRaw.cleanedFilename);
      cleanedImageData = cleanedRes.error ? '' : cleanedRes.data;
    } else {
      info.push(`Not displaying ${basename(filename)} because media type ${origMimeType} can not be displayed.`);
    }
  }

  let outputPath = cleanRaw.cleanedFilename;
  if (cleanRaw.errors.length === 0) {
    if (saveMode === 'original-filename') {
      const dst = outputDir ? joinPath(outputDir, basename(filename)) : filename;
      if (await copyThenRemove(cleanRaw.cleanedFilename, dst, cleanRaw.errors)) {
        outputPath = dst;
      }
    } else if (saveMode === 'random-filename') {
      const { parent, ext } = parseFilename(filename);
      const outDir = outputDir ?? parent;
      const randomPath = joinPath(outDir, `${crypto.randomUUID().replace(/-/g, '')}.${ext}`);
      if (await copyThenRemove(cleanRaw.cleanedFilename, randomPath, cleanRaw.errors)) {
        outputPath = randomPath;
      }
    }
  } else {
    await invoke<[number, string]>('remove_file', { path: cleanRaw.cleanedFilename });
  }

  return {
    origImage: { filename: basename(filename), imageData: origImageData, mimeType: origMimeType, tags: cleanRaw.origTags },
    cleanedImage: { filename: basename(outputPath), imageData: cleanedImageData, mimeType: cleanedMimeType, tags: cleanRaw.cleanedTags },
    errors: cleanRaw.errors,
    warnings: cleanRaw.warnings,
    info,
  };
}

async function processOneFile(filename: string, options: ProcessOptions): Promise<CleanedResult> {
  const { loadImageData, saveMode = 'cleaned-suffix', skipCleaning = false, outputDir = null } = options;
  try {
    return skipCleaning
      ? await processReadOnly(filename, loadImageData)
      : await processAndClean(filename, loadImageData, saveMode, outputDir);
  } catch (err) {
    return errorResult(filename, err);
  }
}

export async function processFiles(
  filenames: string[],
  options: ProcessOptions,
  onProgress?: (current: number, total: number) => void,
  signal?: AbortSignal,
): Promise<CleanedResult[]> {
  const total = filenames.length;
  const results: CleanedResult[] = [];

  for (let i = 0; i < filenames.length; i++) {
    if (signal?.aborted) break;
    results.push(await processOneFile(filenames[i], options));
    onProgress?.(i + 1, total);
  }

  return results;
}
