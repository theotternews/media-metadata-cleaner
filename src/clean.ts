import { invoke } from '@tauri-apps/api/core';
import { platform } from '@tauri-apps/plugin-os';
import { ChildProcess, Command } from '@tauri-apps/plugin-shell';
import { CleanRaw, CleanedResult, ImageInfo, MimeTypes } from './types';

// const convert = require('heic-convert') as (opts: {
//   buffer: Buffer;
//   format: string;
//   quality: number;
// }) => Promise<Buffer>;

// const keepTags = [
//   'ColorSpace',
//   'Orientation',
//   'ResolutionUnit',
//   'XResolution',
//   'YResolution',
// ] as const;

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

// async function heicToJpeg(filename: string, origTags: ExifTags): Promise<string> {
//   const stem = filename.slice(0, filename.lastIndexOf('.'));
//   const inputBuffer = await fs.readFile(filename);
//   const outputBuffer = await convert({
//     buffer: inputBuffer,
//     format: 'JPEG',
//     quality: 1,
//   });

//   // TODO
//   const targetFilename = `${stem}-cleaned.jpg`;
//   await fs.writeFile(targetFilename, outputBuffer);

//   const keysMap = (Object.keys(origTags) as string[]).reduce<Record<string, string | null>>(
//     (acc, key) => ({
//       ...acc,
//       [key]: (keepTags as readonly string[]).includes(key) ? (origTags[key] as string) : null,
//     }),
//     {}
//   );
//   await exiftool.write(targetFilename, keysMap);

//   // return targetFilename;
//   return "";
// }

async function cleanMetadata(filename: string): Promise<CleanRaw> {
  const errors: string[] = [];
  const warnings: string[] = [];
  console.log(`cleanMetadata: ${filename}`);

  const mimeType = MimeTypes.lookup(filename);
  if (!mimeType) {
    throw new Error(`Invalid mime type for ${filename}. Only images and videos are supported.`);
  }

  console.log(`origReadCommand: ${filename}`);
  const origReadCommand = Command.sidecar('bin/media-metadata-cleaner_exiftool', ['--system:all', filename]);
  const origReadProcess = (await origReadCommand.execute()) as ChildProcess<string>;
  console.log(`origReadProcess: ${origReadProcess.code}`);
  const origTags = origReadProcess.stdout;
  console.log(`origTags: ${JSON.stringify(origTags)}`);

  let cleanedFilename: string;
  if (mimeType === 'image/heic') {
    // cleanedFilename = await heicToJpeg(filename, origTags);
    cleanedFilename = "";
    errors.push("HEIC conversion not supported yet.");
    warnings.push("HEIC conversion not supported yet.");
  } else {
    const lastDot = filename.lastIndexOf('.');
    const stem = filename.slice(0, lastDot);
    const ext = filename.slice(lastDot + 1);
    cleanedFilename = `${stem}-cleaned.${ext}`;

    console.log(`copyCommand: ${filename} ${cleanedFilename}`);
    const [copyCode, copyMessage] = await invoke<[number, string]>('copy_file', {
      src: filename,
      dst: cleanedFilename,
    });
    console.log(`copyCode: ${copyCode}, copyMessage: ${copyMessage}`);
    if (copyCode !== 0) {
      errors.push(copyMessage);
    }

    const cleanAllCommand = Command.sidecar('bin/media-metadata-cleaner_exiftool', ['-all:all=', '-overwrite_original', cleanedFilename]);
    const cleanAllProcess = (await cleanAllCommand.execute()) as ChildProcess<string>;
    if (cleanAllProcess.code !== 0) {
      console.error(`Error cleaning file ${filename}: ${cleanAllProcess.stderr.toString()}`);
      errors.push(cleanAllProcess.stderr.toString());
    } else if (cleanAllProcess.stderr.length > 0) {
      console.warn(`Warning cleaning file ${cleanedFilename}: ${cleanAllProcess.stderr.toString()}`);
      warnings.push(cleanAllProcess.stderr.toString());
    }
    console.log(`While cleaning file ${filename}: ${cleanAllProcess.stdout.toString()}`);

    const cleanTimeCommand = Command.sidecar('bin/media-metadata-cleaner_exiftool', ['-time:all=', '-overwrite_original', cleanedFilename]);
    const cleanTimeProcess = (await cleanTimeCommand.execute()) as ChildProcess<string>;
    if (cleanTimeProcess.code !== 0) {
      console.error(`Error cleaning file ${filename}: ${cleanTimeProcess.stderr.toString()}`);
      errors.push(cleanTimeProcess.stderr.toString());
    } else if (cleanTimeProcess.stderr.length > 0) {
      console.warn(`Warning cleaning file ${cleanedFilename}: ${cleanTimeProcess.stderr.toString()}`);
      warnings.push(cleanTimeProcess.stderr.toString());
    }
    console.log(`While cleaning file ${cleanedFilename}: ${cleanTimeProcess.stdout.toString()}`);

  }

  const cleanedReadCommand = Command.sidecar('bin/media-metadata-cleaner_exiftool', ['--system:all', cleanedFilename]);
  const cleanedReadProcess = (await cleanedReadCommand.execute()) as ChildProcess<string>;
  const cleanedTags = cleanedReadProcess.stdout;
  
  return new CleanRaw(origTags, cleanedFilename, cleanedTags, errors, warnings);
}

export async function processFiles(
  filenames: string[],
  onProgress?: (current: number, total: number) => void
): Promise<CleanedResult[]> {
  const total = filenames.length;
  const results: CleanedResult[] = [];
  for (let i = 0; i < filenames.length; i++) {
    const filename = filenames[i];
    let cleanRaw: CleanRaw;
    try {
      cleanRaw = await cleanMetadata(filename);
    } catch (err) {
      results.push(
        new CleanedResult(
          new ImageInfo(filename),
          new ImageInfo(),
          [formatError(err)],
          []
        )
      );
      onProgress?.(i + 1, total);
      continue;
    }

    const [readCode, readMessage, origImageData] = await invoke<[number, string, string]>('read_file', { path: filename });
    if (readCode !== 0) {
      console.error(`Error reading file ${filename}: ${readMessage}`);
    }
    const origMimeType = MimeTypes.lookup(filename) as string;

    const [cleanedReadCode, cleanedReadMessage, cleanedImageData] = await invoke<[number, string, string]>('read_file', { path: cleanRaw.cleanedFilename });
    if (cleanedReadCode !== 0) {
      console.error(`Error reading file ${cleanRaw.cleanedFilename}: ${cleanedReadMessage}`);
    }
    const cleanedMimeType = MimeTypes.lookup(cleanRaw.cleanedFilename) as string;

    results.push(
      new CleanedResult(
        new ImageInfo(basename(filename), origImageData, origMimeType, cleanRaw.origTags),
        new ImageInfo(basename(cleanRaw.cleanedFilename), cleanedImageData, cleanedMimeType, cleanRaw.cleanedTags),
        cleanRaw.errors,
        cleanRaw.warnings
      )
    );
    onProgress?.(i + 1, total);
  }
  return results;
}
