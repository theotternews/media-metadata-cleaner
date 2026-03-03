# media-metadata-cleaner

Desktop app that strips metadata from images (EXIF, XMP, etc.) using [exiftool](https://exiftool.org). HEIC is re-encoded as JPEG at 100% quality.

## Installation

Download the latest release for your platform from **[Releases](https://codeberg.org/otternews/media-metadata-cleaner/releases)**. 

## Usage

1. Click the button to choose image files (e.g. JPEG, PNG, HEIC). Multiple selection is allowed.
2. Wait for processing. Each file gets an row in the results: **Original** vs **Cleaned** image and tags, as well as any errors or warnings.
3. Green rows succeeded; yellow had warnings; red had errors. 
4. Cleaned files are written next to the originals with a `-cleaned` suffix (e.g. `photo.jpg` → `photo-cleaned.jpg`). Originals are never overwritten.

**Notes:** Use correct file extensions (e.g. don’t name a JPEG `.png`). 

## Development

**Prerequisites:** [Node.js](https://nodejs.org/) (LTS), [Rust](https://rustup.rs/), [Tauri system deps](https://v2.tauri.app/start/prerequisites/) for your OS.

```bash
git clone https://codeberg.org/otternews/media-metadata-cleaner.git
cd media-metadata-cleaner
npm install
```

First build downloads ExifTool into the app bundle (requires network).

```bash
npm run tauri dev
```

Production build:

```bash
npm run tauri build
```

Outputs are under `src-tauri/target/release/bundle/` (installer or app depending on OS).

## License

This project is released under the [Anti-Capitalist Software License (v 1.4)](https://anticapitalist.software/). See [LICENSE](LICENSE) for the full text.
