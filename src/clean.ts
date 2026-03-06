import { invoke } from '@tauri-apps/api/core';
import { platform } from '@tauri-apps/plugin-os';
import { ChildProcess, Command } from '@tauri-apps/plugin-shell';
import { CleanRaw, CleanedResult, ImageInfo, MimeTypes, type SaveMode } from './types';

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

/** Warning lines starting with any of these are not added to the warnings list. */
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

function basename(path: string): string {
  if (platform() === 'windows') {
    return path.slice(path.lastIndexOf('\\') + 1);
  } else {
    return path.slice(path.lastIndexOf('/') + 1);
  }
}

function dirname(pathStr: string): string {
  const sep = platform() === 'windows' ? '\\' : '/';
  const idx = pathStr.lastIndexOf(sep);
  return idx === -1 ? '' : pathStr.slice(0, idx);
}

function joinPath(dir: string, ...parts: string[]): string {
  const sep = platform() === 'windows' ? '\\' : '/';
  const trimmedDir = dir.replace(/[/\\]+$/, '');
  return [trimmedDir, ...parts].join(sep);
}

export type ProcessOptions = {
  loadImageData: boolean;
  saveMode?: SaveMode;
  skipCleaning?: boolean;
  /** When set, cleaned output is written to this directory instead of the source directory. */
  outputDir?: string | null;
};

async function readTagsOnly(filename: string): Promise<{ origTags: string; errors: string[] }> {
  const errors: string[] = [];
  const mimeType = MimeTypes.lookup(filename);
  if (!mimeType) {
    throw new Error(`Invalid mime type for ${basename(filename)}. Only images and videos that exiftool can read and write are supported.`);
  }
  const origReadCommand = Command.sidecar('bin/media-metadata-cleaner_exiftool', ['--system:all', '-ee', filename]);
  const origReadProcess = (await origReadCommand.execute()) as ChildProcess<string>;
  if (origReadProcess.code !== 0 && origReadProcess.stderr) {
    errors.push(origReadProcess.stderr.toString());
  }
  return { origTags: origReadProcess.stdout, errors };
}

async function cleanMetadata(filename: string, outputDir?: string | null): Promise<CleanRaw> {
  const errors: string[] = [];
  const warnings: string[] = [];
  console.log(`cleanMetadata: ${basename(filename)}`);

  const mimeType = MimeTypes.lookup(filename);
  if (!mimeType) {
    throw new Error(`Invalid mime type for ${basename(filename)}. Only images and videos that exiftool can read and write are supported.`);
  }

  console.log(`origReadCommand: ${basename(filename)}`);
  const origReadCommand = Command.sidecar('bin/media-metadata-cleaner_exiftool', ['--system:all', '-ee', filename]);
  const origReadProcess = (await origReadCommand.execute()) as ChildProcess<string>;
  console.log(`origReadProcess: ${origReadProcess.code}`);
  const origTags = origReadProcess.stdout;
  console.log(`origTags: ${JSON.stringify(origTags)}`);

  const lastDot = filename.lastIndexOf('.');
  const stem = filename.slice(0, lastDot);
  const ext = filename.slice(lastDot + 1);
  const baseName = basename(filename);
  const dotInBase = baseName.lastIndexOf('.');
  const baseStem = dotInBase >= 0 ? baseName.slice(0, dotInBase) : baseName;
  const baseExt = dotInBase >= 0 ? baseName.slice(dotInBase + 1) : ext;
  const cleanedFilename = outputDir ? joinPath(outputDir, `${baseStem}-cleaned.${baseExt}`) : `${stem}-cleaned.${ext}`;

  console.log(`copyCommand: ${filename} ${cleanedFilename}`);
  const [copyCode, copyMessage] = await invoke<[number, string]>('copy_file', {
    src: filename,
    dst: cleanedFilename,
  });
  console.log(`copyCode: ${copyCode}, copyMessage: ${copyMessage}`);
  if (copyCode !== 0) {
    errors.push(copyMessage);
  }

  const keepTagsArgs = ["-TagsFromFile", "@", ...keepTags];
  const cleanArgs = ['-all:all=', '-CommonIFD0=', '-overwrite_original', ...keepTagsArgs, cleanedFilename];

  const cleanAllCommand = Command.sidecar('bin/media-metadata-cleaner_exiftool', cleanArgs);
  const cleanAllProcess = (await cleanAllCommand.execute()) as ChildProcess<string>;
  if (cleanAllProcess.code !== 0) {
    console.error(`Error cleaning file ${basename(filename)}: ${cleanAllProcess.stderr.toString()}`);
    errors.push(cleanAllProcess.stderr.toString());
  } else if (cleanAllProcess.stderr.length > 0) {
    for (const line of cleanAllProcess.stderr.toString().split('\n')) {
      if (shouldIgnoreWarning(line)) continue;
      warnings.push(line);
    }
  }
  if (warnings.length > 0) {
    console.warn(`Warning cleaning file ${basename(cleanedFilename)}: ${warnings}`);
  }
  console.log(`While cleaning file ${basename(filename)}: ${cleanAllProcess.stdout.toString()}`);

  const cleanTimeCommand = Command.sidecar('bin/media-metadata-cleaner_exiftool', ['-time:all=', '-overwrite_original', cleanedFilename]);
  const cleanTimeProcess = (await cleanTimeCommand.execute()) as ChildProcess<string>;
  if (cleanTimeProcess.code !== 0) {
    console.error(`Error cleaning file ${basename(filename)}: ${cleanTimeProcess.stderr.toString()}`);
    errors.push(cleanTimeProcess.stderr.toString());
  } else if (cleanTimeProcess.stderr.length > 0) {
    for (const line of cleanTimeProcess.stderr.toString().split('\n')) {
      if (shouldIgnoreWarning(line)) continue;
      warnings.push(line);
    }
  }
  console.log(`While cleaning file ${basename(cleanedFilename)}: ${cleanTimeProcess.stdout.toString()}`);

  const cleanedReadCommand = Command.sidecar('bin/media-metadata-cleaner_exiftool', ['--system:all', '-ee', cleanedFilename]);
  const cleanedReadProcess = (await cleanedReadCommand.execute()) as ChildProcess<string>;
  const cleanedTags = cleanedReadProcess.stdout;

  return new CleanRaw(origTags, cleanedFilename, cleanedTags, errors, warnings);
}

export async function processFiles(
  filenames: string[],
  options: ProcessOptions,
  onProgress?: (current: number, total: number) => void
): Promise<CleanedResult[]> {
  const { loadImageData, saveMode = 'cleaned-suffix', skipCleaning = false, outputDir = null } = options;
  const total = filenames.length;
  const results: CleanedResult[] = [];

  for (let i = 0; i < filenames.length; i++) {
    const filename = filenames[i];
    let info: string[] = [];

    if (skipCleaning) {
      try {
        const { origTags, errors } = await readTagsOnly(filename);
        let origImageData = '';
        const origMimeType = MimeTypes.lookup(filename) as string;
        if (loadImageData && displayMimeTypes.includes(origMimeType)) {
          const [readCode, , data] = await invoke<[number, string, string]>('read_file', { path: filename });
          if (readCode === 0) origImageData = data;
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
        results.push(
          new CleanedResult(
            new ImageInfo(basename(filename)),
            new ImageInfo(),
            [formatError(err)],
            [],
            []
          )
        );
      }
      onProgress?.(i + 1, total);
      continue;
    }

    let cleanRaw: CleanRaw;
    try {
      cleanRaw = await cleanMetadata(filename, outputDir);
    } catch (err) {
      results.push(
        new CleanedResult(
          new ImageInfo(basename(filename)),
          new ImageInfo(),
          [formatError(err)],
          [],
          []
        )
      );
      onProgress?.(i + 1, total);
      continue;
    }

    let origImageData = '';
    let cleanedImageData = '';
    const origMimeType = MimeTypes.lookup(filename) as string;
    const cleanedMimeType = MimeTypes.lookup(cleanRaw.cleanedFilename) as string;

    if (loadImageData) {
      if (displayMimeTypes.includes(origMimeType)) {
        const [readCode, readMessage, data] = await invoke<[number, string, string]>('read_file', { path: filename });
        if (readCode !== 0) {
          console.error(`Error reading file ${basename(filename)}: ${readMessage}`);
        } else {
          origImageData = data;
        }

        const [cleanedReadCode, cleanedReadMessage, cleanedData] = await invoke<[number, string, string]>('read_file', { path: cleanRaw.cleanedFilename });
        if (cleanedReadCode !== 0) {
          console.error(`Error reading file ${basename(cleanRaw.cleanedFilename)}: ${cleanedReadMessage}`);
        } else {
          cleanedImageData = cleanedData;
        }
      } else {
        info.push(`Not displaying ${basename(filename)} because media type ${origMimeType} can not be displayed.`);
      }
    }

    let outputPath = cleanRaw.cleanedFilename;
    if (cleanRaw.errors.length === 0) {
      if (saveMode === 'original-filename') {
        const dst = outputDir ? joinPath(outputDir, basename(filename)) : filename;
        const [copyCode, copyMessage] = await invoke<[number, string]>('copy_file', {
          src: cleanRaw.cleanedFilename,
          dst,
        });
        if (copyCode !== 0) {
          cleanRaw.errors.push(copyMessage);
        } else {
          const [removeCode, removeMessage] = await invoke<[number, string]>('remove_file', { path: cleanRaw.cleanedFilename });
          if (removeCode !== 0) {
            console.warn(`Could not remove ${basename(cleanRaw.cleanedFilename)}: ${removeMessage}`);
          }
          outputPath = dst;
        }
      } else if (saveMode === 'random-filename') {
        const ext = filename.slice(filename.lastIndexOf('.') + 1);
        const outDir = outputDir ?? dirname(filename);
        const randomPath = joinPath(outDir, `${crypto.randomUUID().replace(/-/g, '')}.${ext}`);
        const [copyCode, copyMessage] = await invoke<[number, string]>('copy_file', {
          src: cleanRaw.cleanedFilename,
          dst: randomPath,
        });
        if (copyCode !== 0) {
          cleanRaw.errors.push(copyMessage);
        } else {
          const [removeCode, removeMessage] = await invoke<[number, string]>('remove_file', { path: cleanRaw.cleanedFilename });
          if (removeCode !== 0) {
            console.warn(`Could not remove ${basename(cleanRaw.cleanedFilename)}: ${removeMessage}`);
          }
          outputPath = randomPath;
        }
      }
    } else {
      const [removeCode, removeMessage] = await invoke<[number, string]>('remove_file', { path: cleanRaw.cleanedFilename });
      if (removeCode !== 0) {
        console.warn(`Could not remove ${basename(cleanRaw.cleanedFilename)}: ${removeMessage}`);
      }
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
