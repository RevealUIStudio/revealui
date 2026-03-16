use rand::Rng;
use rsa::pkcs8::{EncodePrivateKey, EncodePublicKey, LineEnding};
use rsa::RsaPrivateKey;

/// Generate a crypto-random alphanumeric string of the given length.
#[tauri::command]
pub fn generate_secret(length: usize) -> Result<String, String> {
    let charset = b"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let mut rng = rand::thread_rng();
    let secret: String = (0..length)
        .map(|_| {
            let idx = rng.gen_range(0..charset.len());
            charset[idx] as char
        })
        .collect();
    Ok(secret)
}

/// Generate a 64-character hex string (32 bytes) for REVEALUI_KEK.
#[tauri::command]
pub fn generate_kek() -> Result<String, String> {
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill(&mut bytes);
    Ok(hex::encode(bytes))
}

/// Generate an RSA-2048 key pair. Returns (private_pem, public_pem).
#[tauri::command]
pub fn generate_rsa_keypair() -> Result<(String, String), String> {
    let mut rng = rand::thread_rng();
    let private_key = RsaPrivateKey::new(&mut rng, 2048).map_err(|e| e.to_string())?;
    let public_key = private_key.to_public_key();

    let private_pem = private_key
        .to_pkcs8_pem(LineEnding::LF)
        .map_err(|e| e.to_string())?;
    let public_pem = public_key
        .to_public_key_pem(LineEnding::LF)
        .map_err(|e| e.to_string())?;

    Ok((private_pem.to_string(), public_pem))
}
