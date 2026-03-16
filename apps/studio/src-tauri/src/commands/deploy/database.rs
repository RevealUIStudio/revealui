use std::process::Command;

use super::super::error::StudioError;

/// Test a Neon connection string by running a query via psql.
#[tauri::command]
pub async fn neon_test_connection(connection_string: String) -> Result<String, StudioError> {
    let output = Command::new("psql")
        .env("DATABASE_URL", &connection_string)
        .arg("-c")
        .arg("SELECT NOW()")
        .output()
        .map_err(|e| StudioError::Database(format!("Failed to run psql: {}", e)))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(StudioError::Database(
            String::from_utf8_lossy(&output.stderr).to_string(),
        ))
    }
}

/// Run Drizzle migrations.
#[tauri::command]
pub async fn run_db_migrate(repo_path: String) -> Result<String, StudioError> {
    let output = Command::new("pnpm")
        .arg("--filter")
        .arg("@revealui/db")
        .arg("db:migrate")
        .current_dir(&repo_path)
        .output()
        .map_err(|e| StudioError::Database(format!("Failed to run db:migrate: {}", e)))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(StudioError::Database(
            String::from_utf8_lossy(&output.stderr).to_string(),
        ))
    }
}

/// Run database seed (mandatory — creates home page).
#[tauri::command]
pub async fn run_db_seed(repo_path: String) -> Result<String, StudioError> {
    let output = Command::new("pnpm")
        .arg("db:seed")
        .current_dir(&repo_path)
        .output()
        .map_err(|e| StudioError::Database(format!("Failed to run db:seed: {}", e)))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(StudioError::Database(
            String::from_utf8_lossy(&output.stderr).to_string(),
        ))
    }
}
