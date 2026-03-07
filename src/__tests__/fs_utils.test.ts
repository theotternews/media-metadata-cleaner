import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/plugin-os', () => ({
  platform: () => 'linux',
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { basename, dirname, joinPath, parseFilename } from '../fs_utils';

describe('basename', () => {
  it('extracts filename from unix paths', () => {
    expect(basename('/home/user/photo.jpg')).toBe('photo.jpg');
    expect(basename('/a/b/c/file.txt')).toBe('file.txt');
  });

  it('extracts filename from windows paths', () => {
    expect(basename('C:\\Users\\me\\photo.jpg')).toBe('photo.jpg');
    expect(basename('D:\\a\\b\\file.txt')).toBe('file.txt');
  });

  it('returns the filename itself when there is no directory', () => {
    expect(basename('photo.jpg')).toBe('photo.jpg');
  });

  it('handles mixed separators', () => {
    expect(basename('/home/user\\photo.jpg')).toBe('photo.jpg');
  });
});

describe('dirname (linux)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('extracts directory from unix paths', () => {
    expect(dirname('/home/user/photo.jpg')).toBe('/home/user');
    expect(dirname('/a/b/c/file.txt')).toBe('/a/b/c');
  });

  it('returns empty string when there is no directory', () => {
    expect(dirname('photo.jpg')).toBe('');
  });

  it('handles root-level files', () => {
    expect(dirname('/photo.jpg')).toBe('');
  });
});

describe('joinPath (linux)', () => {
  it('joins directory and filename', () => {
    expect(joinPath('/home/user', 'photo.jpg')).toBe('/home/user/photo.jpg');
  });

  it('joins multiple segments', () => {
    expect(joinPath('/home', 'user', 'photo.jpg')).toBe('/home/user/photo.jpg');
  });

  it('strips trailing slashes from the directory', () => {
    expect(joinPath('/home/user/', 'photo.jpg')).toBe('/home/user/photo.jpg');
    expect(joinPath('/home/user///', 'photo.jpg')).toBe('/home/user/photo.jpg');
  });
});

describe('parseFilename (linux)', () => {
  it('splits a simple filename', () => {
    expect(parseFilename('photo.jpg')).toEqual({ parent: '', stem: 'photo', ext: 'jpg' });
  });

  it('splits a full unix path', () => {
    expect(parseFilename('/home/user/photo.jpg')).toEqual({
      parent: '/home/user',
      stem: 'photo',
      ext: 'jpg',
    });
  });

  it('handles files without extensions', () => {
    expect(parseFilename('/home/user/README')).toEqual({
      parent: '/home/user',
      stem: 'README',
      ext: '',
    });
  });

  it('uses last dot for double extensions', () => {
    expect(parseFilename('/tmp/archive.tar.gz')).toEqual({
      parent: '/tmp',
      stem: 'archive.tar',
      ext: 'gz',
    });
  });

  it('handles dotfiles', () => {
    expect(parseFilename('/home/user/.gitignore')).toEqual({
      parent: '/home/user',
      stem: '',
      ext: 'gitignore',
    });
  });
});
