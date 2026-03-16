use super::super::error::StudioError;

/// Send a test email via Resend API.
#[tauri::command]
pub async fn resend_send_test(api_key: String, to_email: String) -> Result<bool, StudioError> {
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
        .await?;

    if resp.status().is_success() {
        Ok(true)
    } else {
        let text = resp.text().await.unwrap_or_default();
        Err(StudioError::Network(format!("Resend API error: {}", text)))
    }
}

/// Send a test email via SMTP.
#[tauri::command]
pub async fn smtp_send_test(
    host: String,
    port: u16,
    user: String,
    pass: String,
    to_email: String,
) -> Result<bool, StudioError> {
    use lettre::{
        message::Mailbox,
        transport::smtp::authentication::Credentials,
        AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor,
    };

    // Use the SMTP user as the "from" address — self-hosters won't have noreply@revealui.com
    let from_addr = format!("RevealUI Studio <{}>", user);
    let email = Message::builder()
        .from(
            from_addr
                .parse()
                .map_err(|e| StudioError::Other(format!("Invalid from address: {e}")))?,
        )
        .to(to_email
            .parse::<Mailbox>()
            .map_err(|e| StudioError::Other(format!("Invalid to address: {e}")))?)
        .subject("RevealUI — SMTP Test")
        .body("This is a test email from RevealUI Studio.".to_string())
        .map_err(|e| StudioError::Other(format!("Build email: {e}")))?;

    let creds = Credentials::new(user, pass);
    let mailer = AsyncSmtpTransport::<Tokio1Executor>::relay(&host)
        .map_err(|e| StudioError::Network(format!("SMTP relay: {e}")))?
        .port(port)
        .credentials(creds)
        .build();

    mailer
        .send(email)
        .await
        .map_err(|e| StudioError::Network(format!("SMTP send failed: {e}")))?;

    Ok(true)
}
