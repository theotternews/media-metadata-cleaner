import { invoke } from '@tauri-apps/api/core';
import { ChildProcess, Command } from '@tauri-apps/plugin-shell';
import { basename, copyThenRemove, joinPath, parseFilename, readFileForDisplay } from './fs_utils';
import { CleanRaw, CleanedResult, ImageInfo, MimeTypes, type ProcessOptions } from './types';

const keepTags: readonly string[] = [
  '-ColorSpaceTags',
  '-Orientation',
  '-ResolutionUnit',
  '-XResolution',
  '-YResolution',
] as const;

const displayMimeTypes: readonly string[] = [
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

const warningsToIgnore: readonly string[] = [
  'Warning: ICC_Profile deleted. Image colors may be affected',
  'Warning: No writable tags set from',
];

function shouldIgnoreWarning(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed === '') return true;
  return warningsToIgnore.some((prefix) => line.startsWith(prefix));
}

function formatError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function errorResult(filename: string, err: unknown): CleanedResult {
  return new CleanedResult(
    new ImageInfo(basename(filename)),
    new ImageInfo(),
    [formatError(err)],
    [],
    []
  );
}

const INVALID_MIME_MESSAGE = 'Only media files that exiftool can read and write are supported.';

function assertValidMimeType(filename: string): void {
  const mimeType = MimeTypes.lookup(filename);
  if (!mimeType) {
    throw new Error(`Invalid mime type for ${basename(filename)}. ${INVALID_MIME_MESSAGE}`);
  }
}

async function readTagsWithSidecar(filename: string): Promise<{ tags: string; errors: string[] }> {
  const errors: string[] = [];
  const cmd = Command.sidecar('bin/media-metadata-cleaner_exiftool', ['--system:all', '-ee', filename]);
  const process = (await cmd.execute()) as ChildProcess<string>;
  if (process.code !== 0 && process.stderr) {
    errors.push(process.stderr.toString());
  }
  return { tags: process.stdout, errors };
}

/** Runs exiftool sidecar; optionally collects non-ignored stderr lines as warnings. */
async function runExiftoolSidecar(
  args: string[],
  dest: { errors: string[]; warnings?: string[] }
): Promise<{ stdout: string; code: number }> {
  const cmd = Command.sidecar('bin/media-metadata-cleaner_exiftool', args);
  const proc = (await cmd.execute()) as ChildProcess<string>;
  if (proc.code !== 0 && proc.stderr) {
    dest.errors.push(proc.stderr.toString());
  } else if (dest.warnings && proc.stderr) {
    for (const line of proc.stderr.toString().split('\n')) {
      if (!shouldIgnoreWarning(line)) dest.warnings.push(line);
    }
  }
  return { stdout: proc.stdout, code: proc.code ?? -1 };
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
  const cleanedFilename = outputDir ? joinPath(outputDir, `${stem}-cleaned.${ext}`) : joinPath(parent, `${stem}-cleaned.${ext}`);

  const [copyCode, copyMessage] = await invoke<[number, string]>('copy_file', {
    src: filename,
    dst: cleanedFilename,
  });
  if (copyCode !== 0) {
    errors.push(copyMessage);
  }

  const keepTagsArgs = ["-TagsFromFile", "@", ...keepTags];
  const cleanArgs = ['-all:all=', '-CommonIFD0=', '-overwrite_original', ...keepTagsArgs, cleanedFilename];
  const dest = { errors, warnings };

  await runExiftoolSidecar(cleanArgs, dest);
  await runExiftoolSidecar(['-time:all=', '-overwrite_original', cleanedFilename], dest);

  const { tags: cleanedTags } = await readTagsWithSidecar(cleanedFilename);

  return new CleanRaw(origTags, cleanedFilename, cleanedTags, errors, warnings);
}

export async function processFiles(
  filenames: string[],
  options: ProcessOptions,
  onProgress?: (current: number, total: number) => void,
  signal?: AbortSignal
): Promise<CleanedResult[]> {
  const { loadImageData, saveMode = 'cleaned-suffix', skipCleaning = false, outputDir = null } = options;
  const total = filenames.length;
  const results: CleanedResult[] = [];

  for (let i = 0; i < filenames.length; i++) {
    if (signal?.aborted) break;
    const filename = filenames[i];
    let info: string[] = [];

    if (skipCleaning) {
      try {
        const { origTags, errors } = await readTagsOnly(filename);
        let origImageData = '';
        const origMimeType = MimeTypes.lookup(filename) as string;
        if (loadImageData && displayMimeTypes.includes(origMimeType)) {
          const res = await readFileForDisplay(filename);
          origImageData = res.data;
        } else if (loadImageData && origMimeType) {
          info.push(`Not displaying ${basename(filename)} because media type ${origMimeType} can not be displayed.`);
        }
        results.push(
          new CleanedResult(
            new ImageInfo(basename(filename), origImageData, origMimeType, origTags),
            new ImageInfo(),
            errors,
            [],
            info
          )
        );
      } catch (err) {
        results.push(errorResult(filename, err));
      }
      onProgress?.(i + 1, total);
      continue;
    }

    let cleanRaw: CleanRaw;
    try {
      cleanRaw = await cleanMetadata(filename, outputDir);
    } catch (err) {
      results.push(errorResult(filename, err));
      onProgress?.(i + 1, total);
      continue;
    }

    let origImageData = '';
    let cleanedImageData = '';
    const origMimeType = MimeTypes.lookup(filename) as string;
    const cleanedMimeType = MimeTypes.lookup(cleanRaw.cleanedFilename) as string;

    if (loadImageData) {
      if (displayMimeTypes.includes(origMimeType)) {
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

    results.push(
      new CleanedResult(
        new ImageInfo(basename(filename), origImageData, origMimeType, cleanRaw.origTags),
        new ImageInfo(basename(outputPath), cleanedImageData, cleanedMimeType, cleanRaw.cleanedTags),
        cleanRaw.errors,
        cleanRaw.warnings,
        info
      )
    );
    onProgress?.(i + 1, total);
  }
  return results;
}
