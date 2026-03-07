import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockInvoke = vi.fn();
const mockExecute = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

vi.mock('@tauri-apps/plugin-os', () => ({
  platform: () => 'linux',
}));

vi.mock('@tauri-apps/plugin-shell', () => ({
  Command: {
    sidecar: () => ({ execute: mockExecute }),
  },
  ChildProcess: class {},
}));

import { processFiles } from '../clean';
import type { ProcessOptions } from '../types';

function sidecarResult(stdout: string, stderr = '', code = 0) {
  return { code, stdout, stderr };
}

const SAMPLE_TAGS = 'ExifTool Version Number : 13.52\nFile Type : JPEG\n';
const CLEANED_TAGS = 'ExifTool Version Number : 13.52\n';

beforeEach(() => {
  vi.clearAllMocks();

  mockExecute.mockResolvedValue(sidecarResult(SAMPLE_TAGS));

  mockInvoke.mockImplementation((cmd: string) => {
    if (cmd === 'read_file') return Promise.resolve('base64data');
    if (cmd === 'copy_file') return Promise.resolve(100);
    if (cmd === 'remove_file') return Promise.resolve(null);
    return Promise.resolve(null);
  });
});

describe('processFiles', () => {
  describe('read-only mode (skipCleaning = true)', () => {
    const readOnlyOpts: ProcessOptions = { loadImageData: true, skipCleaning: true };

    it('reads tags and loads image data for displayable types', async () => {
      const [result] = await processFiles(['/home/user/photo.jpg'], readOnlyOpts);

      expect(result.origImage.filename).toBe('photo.jpg');
      expect(result.origImage.tags).toBe(SAMPLE_TAGS);
      expect(result.origImage.imageData).toBe('base64data');
      expect(result.origImage.mimeType).toBe('image/jpeg');
      expect(result.cleanedImage.filename).toBe('');
      expect(result.errors).toEqual([]);
    });

    it('adds info message for non-displayable types', async () => {
      const [result] = await processFiles(['/home/user/clip.mov'], readOnlyOpts);

      expect(result.origImage.imageData).toBe('');
      expect(result.info).toEqual([
        expect.stringContaining('can not be displayed'),
      ]);
    });

    it('skips image loading when loadImageData is false', async () => {
      const opts: ProcessOptions = { loadImageData: false, skipCleaning: true };
      const [result] = await processFiles(['/home/user/photo.jpg'], opts);

      expect(result.origImage.imageData).toBe('');
      expect(mockInvoke).not.toHaveBeenCalledWith('read_file', expect.anything());
    });

    it('returns error for unsupported file types', async () => {
      const [result] = await processFiles(['/home/user/file.txt'], readOnlyOpts);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Invalid mime type');
    });
  });

  describe('clean mode, saveMode = cleaned-suffix (default)', () => {
    const cleanOpts: ProcessOptions = { loadImageData: true };

    it('produces a cleaned file with -cleaned suffix', async () => {
      mockExecute
        .mockResolvedValueOnce(sidecarResult(SAMPLE_TAGS))   // readTagsWithSidecar (orig)
        .mockResolvedValueOnce(sidecarResult('', '', 0))      // cleanAll
        .mockResolvedValueOnce(sidecarResult('', '', 0))      // cleanTime
        .mockResolvedValueOnce(sidecarResult(CLEANED_TAGS));  // readTagsWithSidecar (cleaned)

      const [result] = await processFiles(['/home/user/photo.jpg'], cleanOpts);

      expect(result.origImage.tags).toBe(SAMPLE_TAGS);
      expect(result.cleanedImage.tags).toBe(CLEANED_TAGS);
      expect(result.cleanedImage.filename).toBe('photo-cleaned.jpg');
      expect(result.errors).toEqual([]);
    });

    it('loads image data for displayable types', async () => {
      mockExecute
        .mockResolvedValueOnce(sidecarResult(SAMPLE_TAGS))
        .mockResolvedValueOnce(sidecarResult('', '', 0))
        .mockResolvedValueOnce(sidecarResult('', '', 0))
        .mockResolvedValueOnce(sidecarResult(CLEANED_TAGS));

      const [result] = await processFiles(['/home/user/photo.png'], cleanOpts);

      expect(result.origImage.imageData).toBe('base64data');
      expect(result.cleanedImage.imageData).toBe('base64data');
    });

    it('adds info message for non-displayable types', async () => {
      mockExecute
        .mockResolvedValueOnce(sidecarResult(SAMPLE_TAGS))
        .mockResolvedValueOnce(sidecarResult('', '', 0))
        .mockResolvedValueOnce(sidecarResult('', '', 0))
        .mockResolvedValueOnce(sidecarResult(CLEANED_TAGS));

      const [result] = await processFiles(['/home/user/clip.mov'], cleanOpts);

      expect(result.origImage.imageData).toBe('');
      expect(result.cleanedImage.imageData).toBe('');
      expect(result.info).toEqual([expect.stringContaining('can not be displayed')]);
    });
  });

  describe('clean mode, saveMode = original-filename', () => {
    const opts: ProcessOptions = { loadImageData: false, saveMode: 'original-filename' };

    it('renames cleaned file back to original path', async () => {
      mockExecute
        .mockResolvedValueOnce(sidecarResult(SAMPLE_TAGS))
        .mockResolvedValueOnce(sidecarResult('', '', 0))
        .mockResolvedValueOnce(sidecarResult('', '', 0))
        .mockResolvedValueOnce(sidecarResult(CLEANED_TAGS));

      const [result] = await processFiles(['/home/user/photo.jpg'], opts);

      expect(result.cleanedImage.filename).toBe('photo.jpg');
      expect(result.errors).toEqual([]);

      const copyCall = mockInvoke.mock.calls.find(
        ([cmd]: string[]) => cmd === 'copy_file',
      );
      expect(copyCall).toBeDefined();
    });

    it('uses outputDir when set', async () => {
      const optsWithDir: ProcessOptions = {
        loadImageData: false,
        saveMode: 'original-filename',
        outputDir: '/output',
      };

      mockExecute
        .mockResolvedValueOnce(sidecarResult(SAMPLE_TAGS))
        .mockResolvedValueOnce(sidecarResult('', '', 0))
        .mockResolvedValueOnce(sidecarResult('', '', 0))
        .mockResolvedValueOnce(sidecarResult(CLEANED_TAGS));

      const [result] = await processFiles(['/home/user/photo.jpg'], optsWithDir);

      expect(result.cleanedImage.filename).toBe('photo.jpg');
      expect(result.errors).toEqual([]);
    });
  });

  describe('clean mode, saveMode = random-filename', () => {
    it('renames cleaned file to a random UUID filename', async () => {
      const opts: ProcessOptions = { loadImageData: false, saveMode: 'random-filename' };

      mockExecute
        .mockResolvedValueOnce(sidecarResult(SAMPLE_TAGS))
        .mockResolvedValueOnce(sidecarResult('', '', 0))
        .mockResolvedValueOnce(sidecarResult('', '', 0))
        .mockResolvedValueOnce(sidecarResult(CLEANED_TAGS));

      const [result] = await processFiles(['/home/user/photo.jpg'], opts);

      expect(result.cleanedImage.filename).toMatch(/^[0-9a-f]{32}\.jpg$/);
      expect(result.errors).toEqual([]);
    });
  });

  describe('clean mode with outputDir', () => {
    it('writes cleaned file to the output directory', async () => {
      const opts: ProcessOptions = { loadImageData: false, outputDir: '/tmp/output' };

      mockExecute
        .mockResolvedValueOnce(sidecarResult(SAMPLE_TAGS))
        .mockResolvedValueOnce(sidecarResult('', '', 0))
        .mockResolvedValueOnce(sidecarResult('', '', 0))
        .mockResolvedValueOnce(sidecarResult(CLEANED_TAGS));

      const [result] = await processFiles(['/home/user/photo.jpg'], opts);

      expect(result.cleanedImage.filename).toBe('photo-cleaned.jpg');
      expect(result.errors).toEqual([]);

      const firstCopy = mockInvoke.mock.calls.find(
        ([cmd, args]: [string, { dst?: string }]) =>
          cmd === 'copy_file' && args.dst?.startsWith('/tmp/output'),
      );
      expect(firstCopy).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('removes cleaned file when errors occur during cleaning', async () => {
      mockExecute
        .mockResolvedValueOnce(sidecarResult(SAMPLE_TAGS))
        .mockResolvedValueOnce(sidecarResult('', 'exiftool error', 1))
        .mockResolvedValueOnce(sidecarResult('', '', 0))
        .mockResolvedValueOnce(sidecarResult(CLEANED_TAGS));

      const opts: ProcessOptions = { loadImageData: false };
      const [result] = await processFiles(['/home/user/photo.jpg'], opts);

      expect(result.errors.length).toBeGreaterThan(0);

      const removeCall = mockInvoke.mock.calls.find(
        ([cmd]: string[]) => cmd === 'remove_file',
      );
      expect(removeCall).toBeDefined();
    });

    it('catches and returns errors for unsupported files', async () => {
      const opts: ProcessOptions = { loadImageData: false };
      const [result] = await processFiles(['/home/user/file.txt'], opts);

      expect(result.errors[0]).toContain('Invalid mime type');
      expect(result.origImage.filename).toBe('file.txt');
    });

    it('catches unexpected exceptions gracefully', async () => {
      mockExecute.mockRejectedValueOnce(new Error('sidecar crashed'));

      const opts: ProcessOptions = { loadImageData: false };
      const [result] = await processFiles(['/home/user/photo.jpg'], opts);

      expect(result.errors).toEqual(['sidecar crashed']);
    });
  });

  describe('exiftool warnings', () => {
    it('collects non-ignorable warnings from cleaning steps', async () => {
      mockExecute
        .mockResolvedValueOnce(sidecarResult(SAMPLE_TAGS))
        .mockResolvedValueOnce(sidecarResult('', 'Warning: Something unusual\n', 0))
        .mockResolvedValueOnce(sidecarResult('', '', 0))
        .mockResolvedValueOnce(sidecarResult(CLEANED_TAGS));

      const opts: ProcessOptions = { loadImageData: false };
      const [result] = await processFiles(['/home/user/photo.jpg'], opts);

      expect(result.warnings).toContain('Warning: Something unusual');
    });

    it('filters out known benign warnings', async () => {
      const benign = 'Warning: ICC_Profile deleted. Image colors may be affected\n';
      mockExecute
        .mockResolvedValueOnce(sidecarResult(SAMPLE_TAGS))
        .mockResolvedValueOnce(sidecarResult('', benign, 0))
        .mockResolvedValueOnce(sidecarResult('', '', 0))
        .mockResolvedValueOnce(sidecarResult(CLEANED_TAGS));

      const opts: ProcessOptions = { loadImageData: false };
      const [result] = await processFiles(['/home/user/photo.jpg'], opts);

      expect(result.warnings).toEqual([]);
    });
  });

  describe('progress and abort', () => {
    it('calls onProgress for each file processed', async () => {
      const opts: ProcessOptions = { loadImageData: false, skipCleaning: true };
      const progress = vi.fn();

      await processFiles(['/home/user/a.jpg', '/home/user/b.png'], opts, progress);

      expect(progress).toHaveBeenCalledTimes(2);
      expect(progress).toHaveBeenCalledWith(1, 2);
      expect(progress).toHaveBeenCalledWith(2, 2);
    });

    it('stops processing when abort signal is triggered', async () => {
      const opts: ProcessOptions = { loadImageData: false, skipCleaning: true };
      const controller = new AbortController();
      controller.abort();

      const results = await processFiles(
        ['/home/user/a.jpg', '/home/user/b.jpg'],
        opts,
        undefined,
        controller.signal,
      );

      expect(results).toEqual([]);
    });
  });

  describe('multiple files', () => {
    it('processes each file independently', async () => {
      const opts: ProcessOptions = { loadImageData: false, skipCleaning: true };

      const results = await processFiles(
        ['/home/user/photo.jpg', '/home/user/clip.mov', '/home/user/file.txt'],
        opts,
      );

      expect(results).toHaveLength(3);
      expect(results[0].errors).toEqual([]);
      expect(results[1].errors).toEqual([]);
      expect(results[2].errors[0]).toContain('Invalid mime type');
    });
  });
});
