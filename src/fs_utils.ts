import { invoke } from '@tauri-apps/api/core';
import { platform } from '@tauri-apps/plugin-os';

let _sep: string | null = null;
function sep(): string {
  return (_sep ??= platform() === 'windows' ? '\\' : '/');
}

export function basename(path: string): string {
  return path.slice(Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1);
}

export function dirname(pathStr: string): string {
  const idx = pathStr.lastIndexOf(sep());
  return idx === -1 ? '' : pathStr.slice(0, idx);
}

export function joinPath(dir: string, ...parts: string[]): string {
  const trimmedDir = dir.replace(/[/\\]+$/, '');
  return [trimmedDir, ...parts].join(sep());
}

/** Splits a file path into parent directory, filename stem (no extension), and extension. */
export function parseFilename(filename: string): { parent: string; stem: string; ext: string } {
  const parent = dirname(filename);
  const baseName = basename(filename);
  const dotInBase = baseName.lastIndexOf('.');
  const stem = dotInBase >= 0 ? baseName.slice(0, dotInBase) : baseName;
  const ext = dotInBase >= 0 ? baseName.slice(dotInBase + 1) : '';
  return { parent, stem, ext };
}

export async function readFileForDisplay(path: string): Promise<{ data: string; error?: string }> {
  const [code, message, data] = await invoke<[number, string, string]>('read_file', { path });
  if (code !== 0) return { data: '', error: message };
  return { data };
}

/** Copies src to dst, then removes src. Pushes copy errors into `errors`. Returns true if copy succeeded. */
export async function copyThenRemove(src: string, dst: string, errors: string[]): Promise<boolean> {
  const [copyCode, copyMessage] = await invoke<[number, string]>('copy_file', { src, dst });
  if (copyCode !== 0) {
    errors.push(copyMessage);
    return false;
  }
  await invoke<[number, string]>('remove_file', { path: src });
  return true;
}
