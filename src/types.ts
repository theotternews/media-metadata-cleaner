export type SaveMode = 'cleaned-suffix' | 'original-filename' | 'random-filename';

export interface ProcessOptions {
  readonly loadImageData: boolean;
  readonly saveMode?: SaveMode;
  readonly skipCleaning?: boolean;
  readonly outputDir?: string | null;
}

export interface CleanRaw {
  readonly origTags: string;
  readonly cleanedFilename: string;
  readonly cleanedTags: string;
  readonly errors: string[];
  readonly warnings: string[];
}

export interface ImageInfo {
  readonly filename: string;
  readonly imageData: string;
  readonly mimeType: string;
  readonly tags: string;
}

export const emptyImageInfo: ImageInfo = { filename: '', imageData: '', mimeType: '', tags: '' };

export interface CleanedResult {
  readonly origImage: ImageInfo;
  readonly cleanedImage: ImageInfo;
  readonly errors: string[];
  readonly warnings: string[];
  readonly info: string[];
}

const MIME_TYPES = {
  "avif": "image/avif",
  "gif": "image/gif",
  "heic": "image/heic",
  "heics": "image/heic-sequence",
  "heif": "image/heif",
  "heifs": "image/heif-sequence",
  "jpeg": "image/jpeg",
  "jpg": "image/jpeg",
  "jpe": "image/jpeg",
  "jxl": "image/jxl",
  "png": "image/png",
  "tiff": "image/tiff",
  "tif": "image/tiff",
  "psd": "image/vnd.adobe.photoshop",
  "webp": "image/webp",
  "3gp": "video/3gpp",
  "3g2": "video/3gpp2",
  "jpm": "video/jpm",
  "jpgm": "video/jpm",
  "mj2": "video/mj2",
  "mjp2": "video/mj2",
  "mp4": "video/mp4",
  "mp4v": "video/mp4",
  "mpg4": "video/mp4",
  "mpeg": "video/mpeg",
  "mpg": "video/mpeg",
  "mpe": "video/mpeg",
  "m1v": "video/mpeg",
  "m2v": "video/mpeg",
  "qt": "video/quicktime",
  "mov": "video/quicktime",
  "dvb": "video/vnd.dvb.file",
  "m4v": "video/x-m4v",
  "mkv": "video/x-matroska",
  "mk3d": "video/x-matroska",
  "mks": "video/x-matroska",
  "mng": "video/x-mng",
  "avi": "video/x-msvideo",
} as const satisfies Record<string, string>;

export function lookupMimeType(filename: string): string {
  const ext = filename.slice(filename.lastIndexOf('.') + 1).toLowerCase();
  return MIME_TYPES[ext as keyof typeof MIME_TYPES] ?? '';
}
