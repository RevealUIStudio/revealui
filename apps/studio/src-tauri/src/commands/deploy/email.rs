/// Send a test email via Resend API.
#[tauri::command]
pub async fn resend_send_test(api_key: String, to_email: String) -> Result<bool, String> {
    let client = reqwest::Client::new();
    let resp = client
        .post("https://api.resend.com/emails")
        .bearer_auth(&api_key)
        .json(&serde_json::json!({
            "from": "RevealUI Studio <noreply@resend.dev>",
            "to": [to_email],
            "subject": "RevealUI Studio — Email Test",
            "text": "Your email configuration is working. This is a test from RevealUI Studio setup wizard."
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if resp.status().is_success() {
        Ok(true)
    } else {
        let text = resp.text().await.unwrap_or_default();
        Err(format!("Resend API error: {}", text))
    }
}
