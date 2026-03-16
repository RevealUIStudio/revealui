use super::super::error::StudioError;

/// HTTP health check — returns status code or error.
#[tauri::command]
pub async fn health_check(url: String) -> Result<u16, StudioError> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| StudioError::Network(e.to_string()))?;

    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| StudioError::Network(format!("Connection failed: {}", e)))?;

    Ok(resp.status().as_u16())
}
