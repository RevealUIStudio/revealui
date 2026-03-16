use std::process::Command;

/// Validate Stripe API keys by making a test call.
#[tauri::command]
pub async fn stripe_validate_keys(secret_key: String) -> Result<bool, String> {
    let client = reqwest::Client::new();
    let resp = client
        .get("https://api.stripe.com/v1/balance")
        .basic_auth(&secret_key, None::<&str>)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    Ok(resp.status().is_success())
}

/// Run stripe:seed script (creates products, prices, webhook, billing portal).
#[tauri::command]
pub async fn stripe_run_seed(repo_path: String) -> Result<String, String> {
    let output = Command::new("pnpm")
        .arg("stripe:seed")
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Failed to run stripe:seed: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

/// Run stripe:keys -- --write (generates RSA key pair for license signing).
#[tauri::command]
pub async fn stripe_run_keys(repo_path: String) -> Result<String, String> {
    let output = Command::new("pnpm")
        .arg("stripe:keys")
        .arg("--")
        .arg("--write")
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Failed to run stripe:keys: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

/// Run billing:catalog:sync (populates billing_catalog table from Stripe products).
#[tauri::command]
pub async fn stripe_catalog_sync(repo_path: String) -> Result<String, String> {
    let output = Command::new("pnpm")
        .arg("billing:catalog:sync")
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Failed to run billing:catalog:sync: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}
