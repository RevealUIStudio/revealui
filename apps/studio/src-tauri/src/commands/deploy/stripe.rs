use std::process::Command;

use super::super::error::StudioError;

/// Validate Stripe API keys by making a test call.
#[tauri::command]
pub async fn stripe_validate_keys(secret_key: String) -> Result<bool, StudioError> {
    let client = reqwest::Client::new();
    let resp = client
        .get("https://api.stripe.com/v1/balance")
        .basic_auth(&secret_key, None::<&str>)
        .send()
        .await?;

    Ok(resp.status().is_success())
}

/// Run stripe:seed script (creates products, prices, webhook, billing portal).
/// After seed completes, reads `.revealui/stripe-env.json` which contains
/// `{ envVars: { STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_STRIPE_*_PRICE_ID, ... }, catalogEntries }`.
#[tauri::command]
pub async fn stripe_run_seed(repo_path: String) -> Result<String, StudioError> {
    let output = Command::new("pnpm")
        .arg("stripe:seed")
        .current_dir(&repo_path)
        .output()
        .map_err(|e| StudioError::Process(format!("Failed to run stripe:seed: {}", e)))?;

    if !output.status.success() {
        return Err(StudioError::Process(
            String::from_utf8_lossy(&output.stderr).to_string(),
        ));
    }

    // Read .revealui/stripe-env.json which contains envVars + catalogEntries
    let env_file = std::path::Path::new(&repo_path).join(".revealui/stripe-env.json");
    match std::fs::read_to_string(&env_file) {
        Ok(contents) => Ok(contents),
        Err(_) => {
            // Fallback to stdout if the file doesn't exist (older seed script)
            Ok(String::from_utf8_lossy(&output.stdout).to_string())
        }
    }
}

/// Run stripe:keys -- --write (generates RSA key pair for license signing).
#[tauri::command]
pub async fn stripe_run_keys(repo_path: String) -> Result<String, StudioError> {
    let output = Command::new("pnpm")
        .arg("stripe:keys")
        .arg("--")
        .arg("--write")
        .current_dir(&repo_path)
        .output()
        .map_err(|e| StudioError::Process(format!("Failed to run stripe:keys: {}", e)))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(StudioError::Process(
            String::from_utf8_lossy(&output.stderr).to_string(),
        ))
    }
}

/// Run billing:catalog:sync (populates billing_catalog table from Stripe products).
#[tauri::command]
pub async fn stripe_catalog_sync(repo_path: String) -> Result<String, StudioError> {
    let output = Command::new("pnpm")
        .arg("billing:catalog:sync")
        .current_dir(&repo_path)
        .output()
        .map_err(|e| StudioError::Process(format!("Failed to run billing:catalog:sync: {}", e)))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(StudioError::Process(
            String::from_utf8_lossy(&output.stderr).to_string(),
        ))
    }
}
