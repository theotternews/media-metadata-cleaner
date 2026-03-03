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
  const origReadCommand = Command.sidecar('bin/exiftool', [filename, '', '']);
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

    const cleanCommand = Command.sidecar('bin/exiftool', ['-all:all=', '-overwrite_original', cleanedFilename]);
    const cleanProcess = (await cleanCommand.execute()) as ChildProcess<string>;
    if (cleanProcess.code !== 0) {
      console.error(`Error cleaning file ${cleanedFilename}: ${cleanProcess.stderr.toString()}`);
      errors.push(cleanProcess.stderr.toString());
    } else if (cleanProcess.stderr.length > 0) {
      console.warn(`Warning cleaning file ${cleanedFilename}: ${cleanProcess.stderr.toString()}`);
      warnings.push(cleanProcess.stderr.toString());
    }
    console.log(`While cleaning file ${cleanedFilename}: ${cleanProcess.stdout.toString()}`);
  }

  const cleanedReadCommand = Command.sidecar('bin/exiftool', [cleanedFilename, '', '']);
  const cleanedReadProcess = (await cleanedReadCommand.execute()) as ChildProcess<string>;
  const cleanedTags = cleanedReadProcess.stdout;
  
  return new CleanRaw(origTags, cleanedFilename, cleanedTags, errors, warnings);
}

export async function processFiles(filenames: string[]): Promise<CleanedResult[]> {
  const results: CleanedResult[] = [];
  for (const filename of filenames) {
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
  }
  return results;
}
