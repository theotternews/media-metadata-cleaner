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
