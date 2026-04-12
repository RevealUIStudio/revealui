use super::super::error::StudioError;

/// Send a test email via Gmail REST API with service account JWT.
///
/// Mirrors the TypeScript implementation in `apps/api/src/lib/email.ts`.
/// Uses domain-wide delegation: the service account impersonates `from_email`
/// (a Google Workspace user) to send via the Gmail API.
#[tauri::command]
pub async fn gmail_send_test(
    service_account_email: String,
    private_key: String,
    from_email: String,
    to_email: String,
) -> Result<bool, StudioError> {
    use base64::engine::general_purpose::URL_SAFE_NO_PAD;
    use base64::Engine;
    use rsa::pkcs8::DecodePrivateKey;
    use rsa::Pkcs1v15Sign;
    use sha2::{Digest, Sha256};

    #[derive(serde::Deserialize)]
    struct TokenResponse {
        access_token: String,
    }

    // 1. Build JWT for service account authentication (RS256)
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| StudioError::Other(format!("System time error: {e}")))?
        .as_secs();

    let pem = private_key.replace("\\n", "\n");
    let rsa_key = rsa::RsaPrivateKey::from_pkcs8_pem(&pem)
        .map_err(|e| StudioError::Crypto(format!("Invalid RSA private key: {e}")))?;

    let header = URL_SAFE_NO_PAD.encode(br#"{"alg":"RS256","typ":"JWT"}"#);
    let payload = URL_SAFE_NO_PAD.encode(
        serde_json::json!({
            "iss": service_account_email,
            "sub": from_email,
            "aud": "https://oauth2.googleapis.com/token",
            "scope": "https://www.googleapis.com/auth/gmail.send",
            "iat": now,
            "exp": now + 3600,
        })
        .to_string()
        .as_bytes(),
    );

    let signing_input = format!("{header}.{payload}");
    let digest = Sha256::digest(signing_input.as_bytes());
    let signature = rsa_key
        .sign(Pkcs1v15Sign::new::<Sha256>(), &digest)
        .map_err(|e| StudioError::Crypto(format!("JWT signing failed: {e}")))?;
    let jwt = format!("{signing_input}.{}", URL_SAFE_NO_PAD.encode(&signature));

    // 2. Exchange JWT for access token
    let client = reqwest::Client::new();
    let token_resp = client
        .post("https://oauth2.googleapis.com/token")
        .form(&[
            ("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer"),
            ("assertion", &jwt),
        ])
        .send()
        .await?;

    if !token_resp.status().is_success() {
        let text = token_resp.text().await.unwrap_or_default();
        return Err(StudioError::Network(format!(
            "Google OAuth2 token exchange failed: {text}"
        )));
    }

    let TokenResponse { access_token } = token_resp
        .json()
        .await
        .map_err(|e| StudioError::Network(format!("Token parse error: {e}")))?;

    // 3. Build RFC 2822 MIME message
    let raw_message = format!(
        "From: {from_email}\r\nTo: {to_email}\r\nSubject: RevealUI Studio — Gmail Test\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=\"UTF-8\"\r\n\r\nYour Gmail configuration is working. This is a test from RevealUI Studio setup wizard."
    );
    let encoded = URL_SAFE_NO_PAD.encode(raw_message.as_bytes());

    // 4. Send via Gmail API
    let send_resp = client
        .post("https://gmail.googleapis.com/gmail/v1/users/me/messages/send")
        .bearer_auth(&access_token)
        .json(&serde_json::json!({ "raw": encoded }))
        .send()
        .await?;

    if send_resp.status().is_success() {
        Ok(true)
    } else {
        let text = send_resp.text().await.unwrap_or_default();
        Err(StudioError::Network(format!("Gmail API error: {text}")))
    }
}

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
