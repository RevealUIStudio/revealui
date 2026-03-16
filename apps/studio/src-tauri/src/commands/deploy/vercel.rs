use reqwest::Client;
use serde::{Deserialize, Serialize};

use super::super::error::StudioError;

#[derive(Serialize, Deserialize)]
pub struct VercelProject {
    pub id: String,
    pub name: String,
    pub framework: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct VercelDeployment {
    pub uid: String,
    pub url: Option<String>,
    pub state: Option<String>,
    #[serde(rename = "created")]
    pub created_at: Option<u64>,
}

/// Create a Vercel project linked to a GitHub repo.
#[tauri::command]
pub async fn vercel_create_project(
    token: String,
    name: String,
    framework: String,
    root_directory: Option<String>,
) -> Result<VercelProject, StudioError> {
    let client = Client::new();
    let mut body = serde_json::json!({
        "name": name,
        "framework": framework,
    });
    if let Some(root) = root_directory {
        body["rootDirectory"] = serde_json::Value::String(root);
    }
    let resp = client
        .post("https://api.vercel.com/v10/projects")
        .bearer_auth(&token)
        .json(&body)
        .send()
        .await?;

    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(StudioError::Network(format!(
            "Failed to create project: {}",
            text
        )));
    }

    resp.json::<VercelProject>()
        .await
        .map_err(|e| StudioError::Network(e.to_string()))
}

/// Validate a Vercel API token by listing projects.
#[tauri::command]
pub async fn vercel_validate_token(token: String) -> Result<Vec<VercelProject>, StudioError> {
    let client = Client::new();
    let resp = client
        .get("https://api.vercel.com/v9/projects")
        .bearer_auth(&token)
        .send()
        .await?;

    if !resp.status().is_success() {
        return Err(StudioError::Network(format!(
            "Vercel API error: {}",
            resp.status()
        )));
    }

    #[derive(Deserialize)]
    struct ListResponse {
        projects: Vec<VercelProject>,
    }

    let body: ListResponse = resp
        .json()
        .await
        .map_err(|e| StudioError::Network(e.to_string()))?;
    Ok(body.projects)
}

/// Push environment variables to a Vercel project.
#[tauri::command]
pub async fn vercel_set_env(
    token: String,
    project_id: String,
    key: String,
    value: String,
    target: Vec<String>,
) -> Result<(), StudioError> {
    let client = Client::new();
    let url = format!("https://api.vercel.com/v10/projects/{}/env", project_id);

    let body = serde_json::json!({
        "key": key,
        "value": value,
        "type": "encrypted",
        "target": target,
    });

    let resp = client
        .post(&url)
        .bearer_auth(&token)
        .json(&body)
        .send()
        .await?;

    if resp.status().as_u16() == 409 {
        let patch_url = format!("{}/{}", url, key);
        let patch_resp = client
            .patch(&patch_url)
            .bearer_auth(&token)
            .json(&serde_json::json!({ "value": value, "target": target }))
            .send()
            .await?;

        if !patch_resp.status().is_success() {
            return Err(StudioError::Network(format!(
                "Vercel env update failed: {}",
                patch_resp.status()
            )));
        }
    } else if !resp.status().is_success() {
        return Err(StudioError::Network(format!(
            "Vercel env create failed: {}",
            resp.status()
        )));
    }

    Ok(())
}

/// Trigger a deployment via Vercel API.
#[tauri::command]
pub async fn vercel_deploy(token: String, project_id: String) -> Result<String, StudioError> {
    let client = Client::new();
    let resp = client
        .post("https://api.vercel.com/v13/deployments")
        .bearer_auth(&token)
        .json(&serde_json::json!({
            "name": project_id,
            "project": project_id,
            "target": "production",
        }))
        .send()
        .await?;

    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(StudioError::Network(format!("Deploy failed: {}", text)));
    }

    #[derive(Deserialize)]
    struct DeployResponse {
        id: String,
    }

    let body: DeployResponse = resp
        .json()
        .await
        .map_err(|e| StudioError::Network(e.to_string()))?;
    Ok(body.id)
}

/// Check deployment status.
#[tauri::command]
pub async fn vercel_get_deployment(
    token: String,
    deployment_id: String,
) -> Result<VercelDeployment, StudioError> {
    let client = Client::new();
    let url = format!(
        "https://api.vercel.com/v13/deployments/{}",
        deployment_id
    );
    let resp = client
        .get(&url)
        .bearer_auth(&token)
        .send()
        .await?;

    if !resp.status().is_success() {
        return Err(StudioError::Network(format!(
            "Vercel API error: {}",
            resp.status()
        )));
    }

    let deploy: VercelDeployment = resp
        .json()
        .await
        .map_err(|e| StudioError::Network(e.to_string()))?;
    Ok(deploy)
}
