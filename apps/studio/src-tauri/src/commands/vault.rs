use arboard::Clipboard;
use revvault_core::{config::Config, store::SecretEntry, PassageStore};
use secrecy::ExposeSecret;
use serde::Serialize;
use std::path::PathBuf;

/// Serializable subset of SecretEntry for the frontend.
#[derive(Serialize)]
pub struct SecretInfo {
    pub path: String,
    pub namespace: String,
}

impl From<SecretEntry> for SecretInfo {
    fn from(entry: SecretEntry) -> Self {
        SecretInfo {
            path: entry.path,
            namespace: entry.namespace.to_string(),
        }
    }
}

/// Open the store using resolved config (env vars / platform defaults).
fn open_store() -> Result<PassageStore, String> {
    let config = Config::resolve().map_err(|e| e.to_string())?;
    PassageStore::open(config).map_err(|e| e.to_string())
}

/// Check whether the passage-store is initialised (dir + .age-recipients exist).
#[tauri::command]
pub fn vault_is_initialized() -> Result<bool, String> {
    let home = dirs::home_dir()
        .ok_or_else(|| "could not determine home directory".to_string())?;

    let candidates = [
        home.join(".revealui/passage-store"),
        PathBuf::from("/mnt/c/Users")
            .join(std::env::var("WINDOWS_USERNAME").unwrap_or_else(|_| "user".into()))
            .join(".revealui/passage-store"),
    ];

    Ok(candidates.iter().any(|p| p.is_dir() && p.join(".age-recipients").exists()))
}

/// Initialise the vault: create dirs and generate a new age key pair.
#[tauri::command]
pub fn vault_init() -> Result<(), String> {
    let home = dirs::home_dir()
        .ok_or_else(|| "could not determine home directory".to_string())?;

    let store_dir = home.join(".revealui/passage-store");
    let identity_dir = home.join(".age-identity");
    let identity_file = identity_dir.join("keys.txt");

    std::fs::create_dir_all(&store_dir)
        .map_err(|e| format!("Failed to create store dir: {e}"))?;
    std::fs::create_dir_all(&identity_dir)
        .map_err(|e| format!("Failed to create identity dir: {e}"))?;

    if identity_file.exists() {
        return Err("Vault identity already exists. Delete ~/.age-identity/keys.txt to re-init.".into());
    }

    let identity = age::x25519::Identity::generate();
    let public_key = identity.to_public();
    let secret_key = identity.to_string();

    std::fs::write(
        &identity_file,
        format!(
            "# RevealUI Vault Identity\n# public key: {}\n{}\n",
            public_key,
            secret_key.expose_secret()
        ),
    )
    .map_err(|e| format!("Failed to write identity: {e}"))?;

    std::fs::write(store_dir.join(".age-recipients"), format!("{}\n", public_key))
        .map_err(|e| format!("Failed to write recipients: {e}"))?;

    Ok(())
}

/// List secrets, optionally filtered by a path prefix.
#[tauri::command]
pub fn vault_list(prefix: Option<String>) -> Result<Vec<SecretInfo>, String> {
    let store = open_store()?;
    let entries = store.list(prefix.as_deref()).map_err(|e| e.to_string())?;
    Ok(entries.into_iter().map(SecretInfo::from).collect())
}

/// Get the plaintext value of a secret by its full path.
#[tauri::command]
pub fn vault_get(path: String) -> Result<String, String> {
    let store = open_store()?;
    let secret = store.get(&path).map_err(|e| e.to_string())?;
    Ok(secret.expose_secret().to_string())
}

/// Create a secret. Use `force = true` to overwrite an existing secret.
#[tauri::command]
pub fn vault_set(path: String, value: String, force: bool) -> Result<(), String> {
    let store = open_store()?;
    let plaintext = value.as_bytes();
    if force {
        store.upsert(&path, plaintext).map_err(|e| e.to_string())
    } else {
        store.set(&path, plaintext).map_err(|e| e.to_string())
    }
}

/// Delete a secret by its full path.
#[tauri::command]
pub fn vault_delete(path: String) -> Result<(), String> {
    let store = open_store()?;
    store.delete(&path).map_err(|e| e.to_string())
}

/// Fuzzy-search secrets by path.
#[tauri::command]
pub fn vault_search(query: String) -> Result<Vec<SecretInfo>, String> {
    let store = open_store()?;
    let entries = store.search(&query).map_err(|e| e.to_string())?;
    Ok(entries.into_iter().map(SecretInfo::from).collect())
}

/// Copy a value to the system clipboard.
#[tauri::command]
pub fn vault_copy(value: String) -> Result<(), String> {
    let mut clipboard = Clipboard::new().map_err(|e| format!("Clipboard error: {e}"))?;
    clipboard.set_text(&value).map_err(|e| format!("Failed to copy: {e}"))
}
