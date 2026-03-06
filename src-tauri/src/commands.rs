use base64::Engine;
use std::fs;

#[tauri::command]
pub fn read_file(path: &str) -> Result<String, String> {
    let data = fs::read(path).map_err(|e| e.to_string())?;
    Ok(base64::engine::general_purpose::STANDARD.encode(&data))
}

#[tauri::command]
pub fn write_file(path: &str, data: &[u8]) -> Result<(), String> {
    fs::write(path, data).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn copy_file(src: &str, dst: &str) -> Result<u64, String> {
    fs::copy(src, dst).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remove_file(path: &str) -> Result<(), String> {
    fs::remove_file(path).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use base64::Engine;
    use std::io::Write;

    #[test]
    fn read_file_returns_base64() {
        let mut tmp = tempfile::NamedTempFile::new().unwrap();
        tmp.write_all(b"hello world").unwrap();
        let result = read_file(tmp.path().to_str().unwrap()).unwrap();
        let decoded = base64::engine::general_purpose::STANDARD
            .decode(&result)
            .unwrap();
        assert_eq!(decoded, b"hello world");
    }

    #[test]
    fn read_file_nonexistent_returns_err() {
        let result = read_file("/tmp/nonexistent_file_12345.xyz");
        assert!(result.is_err());
    }

    #[test]
    fn write_file_creates_content() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("out.bin");
        write_file(path.to_str().unwrap(), b"data").unwrap();
        assert_eq!(fs::read(&path).unwrap(), b"data");
    }

    #[test]
    fn copy_file_duplicates_content() {
        let mut tmp = tempfile::NamedTempFile::new().unwrap();
        tmp.write_all(b"copy me").unwrap();

        let dir = tempfile::tempdir().unwrap();
        let dst = dir.path().join("copied.bin");
        let bytes = copy_file(tmp.path().to_str().unwrap(), dst.to_str().unwrap()).unwrap();
        assert_eq!(bytes, 7);
        assert_eq!(fs::read(&dst).unwrap(), b"copy me");
    }

    #[test]
    fn remove_file_deletes_file() {
        let tmp = tempfile::NamedTempFile::new().unwrap();
        let path = tmp.path().to_owned();
        tmp.keep().unwrap();
        assert!(path.exists());
        remove_file(path.to_str().unwrap()).unwrap();
        assert!(!path.exists());
    }

    #[test]
    fn remove_file_nonexistent_returns_err() {
        let result = remove_file("/tmp/nonexistent_file_12345.xyz");
        assert!(result.is_err());
    }
}
