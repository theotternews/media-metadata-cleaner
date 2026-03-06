export type SaveMode = 'cleaned-suffix' | 'overwrite' | 'random-filename';

export class CleanRaw {
  origTags: string;
  cleanedFilename: string;
  cleanedTags: string;
  errors: string[];
  warnings: string[];

  constructor(origTags: string,
              cleanedFilename: string,
              cleanedTags: string,
              errors: string[],
              warnings: string[]
             ) {
    this.origTags = origTags;
    this.cleanedFilename = cleanedFilename;
    this.cleanedTags = cleanedTags;
    this.errors = errors;
    this.warnings = warnings;
  }
};

export class ImageInfo {
  filename: string;
  imageData: string;
  mimeType: string;
  tags: string;

  constructor(filename: string = "",
              imageData: string = "",
              mimeType: string = "",
              tags: string = "") {
    this.filename = filename;
    this.imageData = imageData;
    this.mimeType = mimeType;
    this.tags = tags;
  }
};

export class CleanedResult {
  origImage: ImageInfo;
  cleanedImage: ImageInfo;
  errors: string[];
  warnings: string[];
  info: string[];

  constructor(origImage: ImageInfo,
              cleanedImage: ImageInfo = new ImageInfo(),
              errors: string[] = [],
              warnings: string[] = [],
              info: string[] = []
             ) {
    this.origImage = origImage;
    this.cleanedImage = cleanedImage;
    this.errors = errors;
    this.warnings = warnings;
    this.info = info;
  }
};

export class MimeTypes {

  static lookup(filename: string): string {
    const ext = filename.slice(filename.lastIndexOf('.') + 1);
    return this.types[ext.toLowerCase()] || '';
  }

  static readonly types: Record<string, string> = {
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
  };
};
