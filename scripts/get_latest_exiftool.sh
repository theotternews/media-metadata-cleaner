#!/bin/env bash

set -e

exiftool_bin_prefix="media-metadata-cleaner_exiftool"
base_dir=$(dirname ${0})/..

function linux_mac_setup() {
    target_triple=$1
    echo "setting up exiftool for ${target_triple}..."

    work_dir=$(mktemp -d)

    echo "getting latest exiftool release..."

    archive_url=$(curl -s https://exiftool.org/ | grep "Image-ExifTool-.*.tar.gz/download" | sed -E 's/.*"(.*)".*/\1/')
    echo "archive_url: ${archive_url}"

    version=$(echo ${archive_url} | sed -E "s|.*Image-ExifTool-([0-9\.]+).tar.gz/download|\1|")
    echo "version: ${version}"
    echo "$version" > ${base_dir}/exiftool-version.txt

    mkdir -p ${base_dir}/src-tauri/bin

    echo "processing archive..."
    curl -s -o ${work_dir}/exiftool-archive.tgz -L "${archive_url}"
    tar -xzf ${work_dir}/exiftool-archive.tgz -C ${work_dir}
    rm -rf ${base_dir}/src-tauri/bin/exiftool ${base_dir}/src-tauri/bin/lib

    exe_name=${base_dir}/src-tauri/bin/${exiftool_bin_prefix}-${target_triple}
    cp ${work_dir}/Image-ExifTool-$version/exiftool ${exe_name}
    echo wrote exe ${exe_name}

    mkdir -p ${base_dir}/src-tauri/bin/lib
    rsync -a ${work_dir}/Image-ExifTool-$version/lib/* ${base_dir}/src-tauri/bin/lib/
    mkdir -p ${base_dir}/src-tauri/bin/exiftool_files

    echo "exiftool for ${target_triple} setup complete"
}

function windows_setup() {
    target_triple=$1
    echo "setting up exiftool for ${target_triple}..."

    work_dir=$(mktemp -d)

    echo "getting latest exiftool release..."

    archive_url=$(curl -s https://exiftool.org/ | grep "exiftool-.*_32.zip/download" | sed -E 's/.*"(.*)".*/\1/')
    echo "archive_url: ${archive_url}"

    version=$(echo ${archive_url} | sed -E "s|.*exiftool-([0-9\.]+)_32.zip/download|\1|")
    echo "version: ${version}"
    echo ${version} > ${base_dir}/exiftool-version.txt

    mkdir -p ${base_dir}/src-tauri/bin

    echo "processing archive..."
    curl -s -o ${work_dir}/exiftool-archive.zip -L "${archive_url}"
    unzip -qq ${work_dir}/exiftool-archive.zip -d ${work_dir}

    if [ -d ${base_dir}/src-tauri/bin/exiftool_files ]; then
        chmod -R 777 ${base_dir}/src-tauri/bin/exiftool_files
    fi
    rm -rf ${base_dir}/src-tauri/bin/exiftool.exe ${base_dir}/src-tauri/bin/exiftool_files

    exe_name=${base_dir}/src-tauri/bin/${exiftool_bin_prefix}-${target_triple}.exe
    cp ${work_dir}/exiftool-${version}_32/exiftool\(-k\).exe ${exe_name}
    echo wrote exe ${exe_name}

    cp -r ${work_dir}/exiftool-${version}_32/exiftool_files ${base_dir}/src-tauri/bin/

    echo "exiftool for ${target_triple} setup complete"
}


target_triple=$(rustc --print host-tuple)
platfrom=""
case ${target_triple} in
    *darwin* | *linux*)
        linux_mac_setup ${target_triple}
        ;;
    *windows*)
        windows_setup ${target_triple}
        ;;
    *)
        echo "unknown platform: ${target_triple}"
        exit 1
        ;;
esac

echo "done"
