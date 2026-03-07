import { describe, expect, it } from 'vitest';

import { lookupMimeType } from '../types';

describe('lookupMimeType', () => {
  it('returns correct MIME type for common image extensions', () => {
    expect(lookupMimeType('photo.jpg')).toBe('image/jpeg');
    expect(lookupMimeType('photo.jpeg')).toBe('image/jpeg');
    expect(lookupMimeType('photo.jpe')).toBe('image/jpeg');
    expect(lookupMimeType('photo.png')).toBe('image/png');
    expect(lookupMimeType('photo.gif')).toBe('image/gif');
    expect(lookupMimeType('photo.webp')).toBe('image/webp');
    expect(lookupMimeType('photo.tiff')).toBe('image/tiff');
    expect(lookupMimeType('photo.tif')).toBe('image/tiff');
    expect(lookupMimeType('photo.avif')).toBe('image/avif');
    expect(lookupMimeType('photo.heic')).toBe('image/heic');
    expect(lookupMimeType('photo.psd')).toBe('image/vnd.adobe.photoshop');
    expect(lookupMimeType('photo.jxl')).toBe('image/jxl');
  });

  it('returns correct MIME type for video extensions', () => {
    expect(lookupMimeType('clip.mov')).toBe('video/quicktime');
    expect(lookupMimeType('clip.qt')).toBe('video/quicktime');
    expect(lookupMimeType('clip.mp4')).toBe('video/mp4');
    expect(lookupMimeType('clip.avi')).toBe('video/x-msvideo');
    expect(lookupMimeType('clip.mkv')).toBe('video/x-matroska');
    expect(lookupMimeType('clip.mpeg')).toBe('video/mpeg');
    expect(lookupMimeType('clip.3gp')).toBe('video/3gpp');
    expect(lookupMimeType('clip.m4v')).toBe('video/x-m4v');
  });

  it('is case-insensitive', () => {
    expect(lookupMimeType('PHOTO.JPG')).toBe('image/jpeg');
    expect(lookupMimeType('CLIP.MOV')).toBe('video/quicktime');
    expect(lookupMimeType('photo.Png')).toBe('image/png');
  });

  it('works with full file paths', () => {
    expect(lookupMimeType('/some/dir/photo.jpg')).toBe('image/jpeg');
    expect(lookupMimeType('C:\\Users\\me\\photo.png')).toBe('image/png');
    expect(lookupMimeType('/a/b/c/clip.mov')).toBe('video/quicktime');
  });

  it('returns empty string for unknown extensions', () => {
    expect(lookupMimeType('file.txt')).toBe('');
    expect(lookupMimeType('file.pdf')).toBe('');
    expect(lookupMimeType('file.doc')).toBe('');
    expect(lookupMimeType('file.xyz')).toBe('');
  });

  it('returns empty string for files without extensions', () => {
    expect(lookupMimeType('noext')).toBe('');
  });
});
