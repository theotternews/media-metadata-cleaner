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

  constructor(origImage: ImageInfo,
              cleanedImage: ImageInfo = new ImageInfo(),
              errors: string[] = [],
              warnings: string[] = []
             ) {
    this.origImage = origImage;
    this.cleanedImage = cleanedImage;
    this.errors = errors;
    this.warnings = warnings;
  }
};

export class MimeTypes {

  static lookup(filename: string): string {
    const ext = filename.slice(filename.lastIndexOf('.') + 1);
    return this.types[ext.toLowerCase()] || '';
  }

  static readonly types: Record<string, string> = {
    "avif": "image/avif",
    "bmp": "image/bmp",
    "cgm": "image/cgm",
    "g3": "image/g3fax",
    "gif": "image/gif",
    "heic": "image/heic",
    "heics": "image/heic-sequence",
    "heif": "image/heif",
    "heifs": "image/heif-sequence",
    "ief": "image/ief",
    "jpeg": "image/jpeg",
    "jpg": "image/jpeg",
    "jpe": "image/jpeg",
    "jxl": "image/jxl",
    "ktx": "image/ktx",
    "png": "image/png",
    "btif": "image/prs.btif",
    "sgi": "image/sgi",
    "svg": "image/svg+xml",
    "svgz": "image/svg+xml",
    "tiff": "image/tiff",
    "tif": "image/tiff",
    "psd": "image/vnd.adobe.photoshop",
    "uvi": "image/vnd.dece.graphic",
    "uvvi": "image/vnd.dece.graphic",
    "uvg": "image/vnd.dece.graphic",
    "uvvg": "image/vnd.dece.graphic",
    "djvu": "image/vnd.djvu",
    "djv": "image/vnd.djvu",
    "sub": "image/vnd.dvb.subtitle",
    "dwg": "image/vnd.dwg",
    "dxf": "image/vnd.dxf",
    "fbs": "image/vnd.fastbidsheet",
    "fpx": "image/vnd.fpx",
    "fst": "image/vnd.fst",
    "mmr": "image/vnd.fujixerox.edmics-mmr",
    "rlc": "image/vnd.fujixerox.edmics-rlc",
    "mdi": "image/vnd.ms-modi",
    "wdp": "image/vnd.ms-photo",
    "npx": "image/vnd.net-fpx",
    "wbmp": "image/vnd.wap.wbmp",
    "xif": "image/vnd.xiff",
    "webp": "image/webp",
    "3ds": "image/x-3ds",
    "ras": "image/x-cmu-raster",
    "cmx": "image/x-cmx",
    "fh": "image/x-freehand",
    "fhc": "image/x-freehand",
    "fh4": "image/x-freehand",
    "fh5": "image/x-freehand",
    "fh7": "image/x-freehand",
    "ico": "image/x-icon",
    "sid": "image/x-mrsid-image",
    "pcx": "image/x-pcx",
    "pic": "image/x-pict",
    "pct": "image/x-pict",
    "pnm": "image/x-portable-anymap",
    "pbm": "image/x-portable-bitmap",
    "pgm": "image/x-portable-graymap",
    "ppm": "image/x-portable-pixmap",
    "rgb": "image/x-rgb",
    "tga": "image/x-tga",
    "xbm": "image/x-xbitmap",
    "xpm": "image/x-xpixmap",
    "xwd": "image/x-xwindowdump",
    "3gp": "video/3gpp",
    "3g2": "video/3gpp2",
    "h261": "video/h261",
    "h263": "video/h263",
    "h264": "video/h264",
    "jpgv": "video/jpeg",
    "jpm": "video/jpm",
    "jpgm": "video/jpm",
    "mj2": "video/mj2",
    "mjp2": "video/mj2",
    "ts": "video/mp2t",
    "m2t": "video/mp2t",
    "m2ts": "video/mp2t",
    "mts": "video/mp2t",
    "mp4": "video/mp4",
    "mp4v": "video/mp4",
    "mpg4": "video/mp4",
    "mpeg": "video/mpeg",
    "mpg": "video/mpeg",
    "mpe": "video/mpeg",
    "m1v": "video/mpeg",
    "m2v": "video/mpeg",
    "ogv": "video/ogg",
    "qt": "video/quicktime",
    "mov": "video/quicktime",
    "uvh": "video/vnd.dece.hd",
    "uvvh": "video/vnd.dece.hd",
    "uvm": "video/vnd.dece.mobile",
    "uvvm": "video/vnd.dece.mobile",
    "uvp": "video/vnd.dece.pd",
    "uvvp": "video/vnd.dece.pd",
    "uvs": "video/vnd.dece.sd",
    "uvvs": "video/vnd.dece.sd",
    "uvv": "video/vnd.dece.video",
    "uvvv": "video/vnd.dece.video",
    "dvb": "video/vnd.dvb.file",
    "fvt": "video/vnd.fvt",
    "mxu": "video/vnd.mpegurl",
    "m4u": "video/vnd.mpegurl",
    "pyv": "video/vnd.ms-playready.media.pyv",
    "uvu": "video/vnd.uvvu.mp4",
    "uvvu": "video/vnd.uvvu.mp4",
    "viv": "video/vnd.vivo",
    "webm": "video/webm",
    "f4v": "video/x-f4v",
    "fli": "video/x-fli",
    "flv": "video/x-flv",
    "m4v": "video/x-m4v",
    "mkv": "video/x-matroska",
    "mk3d": "video/x-matroska",
    "mks": "video/x-matroska",
    "mng": "video/x-mng",
    "asf": "video/x-ms-asf",
    "asx": "video/x-ms-asf",
    "vob": "video/x-ms-vob",
    "wm": "video/x-ms-wm",
    "wmv": "video/x-ms-wmv",
    "wmx": "video/x-ms-wmx",
    "wvx": "video/x-ms-wvx",
    "avi": "video/x-msvideo",
    "movie": "video/x-sgi-movie",
    "smv": "video/x-smv"
  };
};
