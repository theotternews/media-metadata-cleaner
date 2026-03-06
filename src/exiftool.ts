import { ChildProcess, Command } from '@tauri-apps/plugin-shell';

import { basename } from './fs_utils';
import { lookupMimeType } from './types';

const KEEP_TAGS = [
  '-ColorSpaceTags',
  '-Orientation',
  '-ResolutionUnit',
  '-XResolution',
  '-YResolution',
] as const;

const WARNINGS_TO_IGNORE = [
  'Warning: ICC_Profile deleted. Image colors may be affected',
  'Warning: No writable tags set from',
] as const;

const INVALID_MIME_MESSAGE = 'Only media files that exiftool can read and write are supported.';

export function shouldIgnoreWarning(line: string): boolean {
  if (line.trim() === '') return true;
  return WARNINGS_TO_IGNORE.some((prefix) => line.startsWith(prefix));
}

export function assertValidMimeType(filename: string): void {
  if (!lookupMimeType(filename)) {
    throw new Error(`Invalid mime type for ${basename(filename)}. ${INVALID_MIME_MESSAGE}`);
  }
}

export interface SidecarResult {
  readonly stdout: string;
  readonly code: number;
  readonly errors: string[];
  readonly warnings: string[];
}

export async function readTagsWithSidecar(filename: string): Promise<{ tags: string; errors: string[] }> {
  const cmd = Command.sidecar('bin/media-metadata-cleaner_exiftool', ['--system:all', '-ee', filename]);
  const proc = (await cmd.execute()) as ChildProcess<string>;
  const errors: string[] = [];
  if (proc.code !== 0 && proc.stderr) {
    errors.push(proc.stderr.toString());
  }
  return { tags: proc.stdout, errors };
}

export async function runExiftoolSidecar(args: string[]): Promise<SidecarResult> {
  const cmd = Command.sidecar('bin/media-metadata-cleaner_exiftool', args);
  const proc = (await cmd.execute()) as ChildProcess<string>;
  const errors: string[] = [];
  const warnings: string[] = [];
  if (proc.code !== 0 && proc.stderr) {
    errors.push(proc.stderr.toString());
  } else if (proc.stderr) {
    for (const line of proc.stderr.toString().split('\n')) {
      if (!shouldIgnoreWarning(line)) warnings.push(line);
    }
  }
  return { stdout: proc.stdout, code: proc.code ?? -1, errors, warnings };
}

export { KEEP_TAGS };
