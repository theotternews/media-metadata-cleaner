import { describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/plugin-shell', () => ({
  Command: { sidecar: vi.fn() },
  ChildProcess: class {},
}));

vi.mock('@tauri-apps/plugin-os', () => ({
  platform: () => 'linux',
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { assertValidMimeType, shouldIgnoreWarning } from '../exiftool';

describe('shouldIgnoreWarning', () => {
  it('ignores empty and whitespace-only lines', () => {
    expect(shouldIgnoreWarning('')).toBe(true);
    expect(shouldIgnoreWarning('   ')).toBe(true);
    expect(shouldIgnoreWarning('\t')).toBe(true);
  });

  it('ignores known ICC_Profile warning', () => {
    expect(shouldIgnoreWarning('Warning: ICC_Profile deleted. Image colors may be affected')).toBe(true);
  });

  it('ignores known "No writable tags" warning', () => {
    expect(shouldIgnoreWarning('Warning: No writable tags set from /some/file.jpg')).toBe(true);
  });

  it('does not ignore unknown warnings', () => {
    expect(shouldIgnoreWarning('Warning: Something unexpected happened')).toBe(false);
    expect(shouldIgnoreWarning('Error: file not found')).toBe(false);
  });

  it('does not ignore partial matches that are not prefixes', () => {
    expect(shouldIgnoreWarning('Some other Warning: ICC_Profile deleted.')).toBe(false);
  });
});

describe('assertValidMimeType', () => {
  it('does not throw for supported image types', () => {
    expect(() => assertValidMimeType('photo.jpg')).not.toThrow();
    expect(() => assertValidMimeType('photo.png')).not.toThrow();
    expect(() => assertValidMimeType('photo.gif')).not.toThrow();
    expect(() => assertValidMimeType('photo.webp')).not.toThrow();
    expect(() => assertValidMimeType('photo.tiff')).not.toThrow();
    expect(() => assertValidMimeType('photo.heic')).not.toThrow();
  });

  it('does not throw for supported video types', () => {
    expect(() => assertValidMimeType('clip.mov')).not.toThrow();
    expect(() => assertValidMimeType('clip.mp4')).not.toThrow();
    expect(() => assertValidMimeType('clip.avi')).not.toThrow();
  });

  it('throws for unsupported file types', () => {
    expect(() => assertValidMimeType('file.txt')).toThrow(/Invalid mime type/);
    expect(() => assertValidMimeType('file.pdf')).toThrow(/Invalid mime type/);
  });

  it('includes the filename in the error message', () => {
    expect(() => assertValidMimeType('/path/to/file.doc')).toThrow('file.doc');
  });
});
