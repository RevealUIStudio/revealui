use serde::Serialize;

#[derive(Debug, thiserror::Error, Serialize)]
#[serde(tag = "kind", content = "message")]
pub enum StudioError {
    #[error("Lock poisoned: {0}")]
    LockPoisoned(String),

    #[error("IO error: {0}")]
    Io(String),

    #[error("Process error: {0}")]
    Process(String),

    #[error("Network error: {0}")]
    Network(String),

    #[error("Database error: {0}")]
    Database(String),

    #[error("Crypto error: {0}")]
    Crypto(String),

    #[error("Vault error: {0}")]
    Vault(String),

    #[error("SSH error: {0}")]
    Ssh(String),

    #[error("Configuration error: {0}")]
    Config(String),

    #[error("{0}")]
    Other(String),
}

impl From<std::io::Error> for StudioError {
    fn from(e: std::io::Error) -> Self {
        StudioError::Io(e.to_string())
    }
}

impl From<reqwest::Error> for StudioError {
    fn from(e: reqwest::Error) -> Self {
        StudioError::Network(e.to_string())
    }
}

impl From<serde_json::Error> for StudioError {
    fn from(e: serde_json::Error) -> Self {
        StudioError::Config(e.to_string())
    }
}
