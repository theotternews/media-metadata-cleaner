#!/bin/env bash

set -e

base_dir=$(dirname "$0")/..
work_dir=$(mktemp -d)

echo "getting latest exiftool release..."
exif_homepage=$(curl -s https://exiftool.org/)

archive_url=$(echo "$exif_homepage" | grep "Image-ExifTool-.*.tar.gz/download" | sed -E 's/.*"(.*)".*/\1/')
echo "archive_url (mac and linux): $archive_url"

win32_url=$(echo "$exif_homepage" | grep "exiftool-.*_32.zip/download" | sed -E 's/.*"(.*)".*/\1/')
echo "win32_url (windows): $win32_url"

version=$(echo "$archive_url" | sed -E "s|.*Image-ExifTool-([0-9\.]+).tar.gz/download|\1|")
echo "version: $version"
echo ${base_dir}/exiftool-version.txt

mkdir -p ${base_dir}/src-tauri/bin

echo "processing mac and linux archive..."
curl -s -o ${work_dir}/exiftool-archive.tgz -L "$archive_url"
tar -xzf ${work_dir}/exiftool-archive.tgz -C ${work_dir}
rm -rf ${base_dir}/src-tauri/bin/exiftool ${base_dir}/src-tauri/bin/lib
rsync -a ${work_dir}/Image-ExifTool-$version/{exiftool,lib} ${base_dir}/src-tauri/bin/

echo "processing windows zip..."
curl -s -o ${work_dir}/exiftool-win32.zip -L "$win32_url"
unzip -qq ${work_dir}/exiftool-win32.zip -d ${work_dir}

# zip, sheesh.
chmod -R 777 ${base_dir}/src-tauri/bin/exiftool_files
rm -rf ${base_dir}/src-tauri/bin/exiftool.exe ${base_dir}/src-tauri/bin/exiftool_files
rsync -a ${work_dir}/exiftool-${version}_32/exiftool\(-k\).exe ${base_dir}/src-tauri/bin/exiftool.exe
rsync -a ${work_dir}/exiftool-${version}_32/exiftool_files ${base_dir}/src-tauri/bin/

echo "cleaning up..."
# zip, sheesh.
chmod -R 777 ${work_dir}
rm -rf ${work_dir}

echo "done"
