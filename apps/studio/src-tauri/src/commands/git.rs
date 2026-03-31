use std::path::Path;

use git2::{DiffFormat, DiffOptions, Repository, Status, StatusOptions};
use serde::Serialize;
use ts_rs::TS;

use super::error::StudioError;

// ── Branch / push / pull / log types ────────────────────────────────────────

#[derive(Debug, Serialize, TS)]
#[ts(export, export_to = "bindings/")]
pub struct GitBranch {
    pub name: String,
    pub is_current: bool,
}

#[derive(Debug, Serialize, TS)]
#[ts(export, export_to = "bindings/")]
pub struct GitPushResult {
    pub success: bool,
    pub message: String,
}

#[derive(Debug, Serialize, TS)]
#[ts(export, export_to = "bindings/")]
pub struct GitPullResult {
    pub success: bool,
    pub message: String,
}

#[derive(Debug, Serialize, TS)]
#[ts(export, export_to = "bindings/")]
pub struct GitCommitInfo {
    pub sha: String,
    pub short_sha: String,
    pub message: String,
    pub author: String,
    pub timestamp: i64, // Unix seconds
}

// ── Types ────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, TS)]
#[ts(export, export_to = "bindings/")]
pub struct GitFileEntry {
    pub path: String,
    /// One of: "modified" | "new" | "deleted" | "renamed" | "untracked" | "conflicted"
    pub status: String,
}

#[derive(Debug, Serialize, TS)]
#[ts(export, export_to = "bindings/")]
pub struct GitStatusResult {
    pub branch: String,
    pub staged: Vec<GitFileEntry>,
    pub unstaged: Vec<GitFileEntry>,
    pub untracked: Vec<GitFileEntry>,
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/// Expand a leading `~/` to the home directory. Returns the path unchanged
/// if it does not start with `~/` or if the home directory cannot be resolved.
fn expand_tilde(path: &str) -> String {
    if path.starts_with("~/") {
        if let Some(home) = dirs::home_dir() {
            return format!("{}/{}", home.display(), &path[2..]);
        }
    }
    path.to_string()
}

fn open_repo(repo_path: &str) -> Result<Repository, StudioError> {
    let expanded = expand_tilde(repo_path);
    Repository::open(&expanded)
        .map_err(|e| StudioError::Other(format!("Cannot open repository at {expanded}: {e}")))
}

// ── Commands ─────────────────────────────────────────────────────────────────

/// Return the current branch, staged/unstaged/untracked file lists.
#[tauri::command]
pub fn git_status(repo_path: String) -> Result<GitStatusResult, StudioError> {
    let repo = open_repo(&repo_path)?;

    let branch = repo
        .head()
        .ok()
        .as_ref()
        .and_then(|h| h.shorthand().map(str::to_string))
        .unwrap_or_else(|| "HEAD".to_string());

    let mut opts = StatusOptions::new();
    opts.include_untracked(true)
        .recurse_untracked_dirs(true)
        .include_ignored(false);

    let statuses = repo
        .statuses(Some(&mut opts))
        .map_err(|e| StudioError::Other(e.to_string()))?;

    let mut staged: Vec<GitFileEntry> = Vec::new();
    let mut unstaged: Vec<GitFileEntry> = Vec::new();
    let mut untracked: Vec<GitFileEntry> = Vec::new();

    for entry in statuses.iter() {
        let path = entry.path().unwrap_or("").to_string();
        let s = entry.status();

        // Index (staged) changes
        if s.intersects(
            Status::INDEX_NEW
                | Status::INDEX_MODIFIED
                | Status::INDEX_DELETED
                | Status::INDEX_RENAMED
                | Status::INDEX_TYPECHANGE,
        ) {
            let status_str = if s.contains(Status::INDEX_NEW) {
                "new"
            } else if s.contains(Status::INDEX_DELETED) {
                "deleted"
            } else if s.contains(Status::INDEX_RENAMED) {
                "renamed"
            } else {
                "modified"
            };
            staged.push(GitFileEntry {
                path: path.clone(),
                status: status_str.to_string(),
            });
        }

        // Working tree (unstaged) changes
        if s.intersects(
            Status::WT_MODIFIED | Status::WT_DELETED | Status::WT_TYPECHANGE | Status::WT_RENAMED,
        ) {
            let status_str = if s.contains(Status::WT_DELETED) {
                "deleted"
            } else if s.contains(Status::WT_RENAMED) {
                "renamed"
            } else {
                "modified"
            };
            unstaged.push(GitFileEntry {
                path: path.clone(),
                status: status_str.to_string(),
            });
        }

        // Untracked new files
        if s.contains(Status::WT_NEW) {
            untracked.push(GitFileEntry {
                path: path.clone(),
                status: "untracked".to_string(),
            });
        }

        // Merge conflicts
        if s.contains(Status::CONFLICTED) {
            unstaged.push(GitFileEntry {
                path: path.clone(),
                status: "conflicted".to_string(),
            });
        }
    }

    Ok(GitStatusResult {
        branch,
        staged,
        unstaged,
        untracked,
    })
}

/// Return a unified-diff patch for a single file.
/// - `staged = true`:  diff HEAD → index (what will be committed)
/// - `staged = false`: diff index → worktree (unstaged changes)
#[tauri::command]
pub fn git_diff_file(
    repo_path: String,
    file_path: String,
    staged: bool,
) -> Result<String, StudioError> {
    let repo = open_repo(&repo_path)?;

    let mut diff_opts = DiffOptions::new();
    diff_opts.pathspec(&file_path);

    let diff = if staged {
        let head_tree = repo.head().ok().and_then(|h| h.peel_to_tree().ok());
        let index = repo
            .index()
            .map_err(|e| StudioError::Other(e.to_string()))?;
        repo.diff_tree_to_index(head_tree.as_ref(), Some(&index), Some(&mut diff_opts))
    } else {
        repo.diff_index_to_workdir(None, Some(&mut diff_opts))
    }
    .map_err(|e| StudioError::Other(e.to_string()))?;

    let mut patch = String::new();
    diff.print(DiffFormat::Patch, |_delta, _hunk, line| {
        let origin = line.origin();
        let content = std::str::from_utf8(line.content()).unwrap_or("");
        match origin {
            '+' | '-' | ' ' => patch.push_str(&format!("{origin}{content}")),
            _ => patch.push_str(content),
        }
        true
    })
    .map_err(|e| StudioError::Other(e.to_string()))?;

    Ok(patch)
}

/// Stage a file (add to index). Handles deleted files by removing from index.
#[tauri::command]
pub fn git_stage_file(repo_path: String, file_path: String) -> Result<(), StudioError> {
    let expanded = expand_tilde(&repo_path);
    let repo = Repository::open(&expanded)
        .map_err(|e| StudioError::Other(format!("Cannot open repo: {e}")))?;
    let mut index = repo
        .index()
        .map_err(|e| StudioError::Other(e.to_string()))?;

    let full_path = Path::new(&expanded).join(&file_path);
    if full_path.exists() {
        index
            .add_path(Path::new(&file_path))
            .map_err(|e| StudioError::Other(e.to_string()))?;
    } else {
        index
            .remove_path(Path::new(&file_path))
            .map_err(|e| StudioError::Other(e.to_string()))?;
    }
    index
        .write()
        .map_err(|e| StudioError::Other(e.to_string()))
}

/// Unstage a file (reset HEAD → index). For new repos with no HEAD, removes from index.
#[tauri::command]
pub fn git_unstage_file(repo_path: String, file_path: String) -> Result<(), StudioError> {
    let repo = open_repo(&repo_path)?;

    // Resolve HEAD into an owned OID to avoid lifetime entanglement with the
    // temporary Reference returned by repo.head().
    let head_oid = repo.head().ok().and_then(|h| h.target());

    if let Some(oid) = head_oid {
        let obj = repo
            .find_object(oid, None)
            .map_err(|e| StudioError::Other(e.to_string()))?;
        repo.reset_default(Some(&obj), [&file_path])
            .map_err(|e| StudioError::Other(e.to_string()))
    } else {
        // Initial commit — no HEAD to reset to; just remove from index
        let mut index = repo
            .index()
            .map_err(|e| StudioError::Other(e.to_string()))?;
        index
            .remove_path(Path::new(&file_path))
            .map_err(|e| StudioError::Other(e.to_string()))?;
        index
            .write()
            .map_err(|e| StudioError::Other(e.to_string()))
    }
}

/// Discard working-tree changes to a file by checking it out from the index.
#[tauri::command]
pub fn git_discard_file(repo_path: String, file_path: String) -> Result<(), StudioError> {
    let repo = open_repo(&repo_path)?;
    let mut checkout_opts = git2::build::CheckoutBuilder::new();
    checkout_opts.path(&file_path).force();
    repo.checkout_index(None, Some(&mut checkout_opts))
        .map_err(|e| StudioError::Other(e.to_string()))
}

/// List all local branches. The currently checked-out branch has `is_current = true`.
#[tauri::command]
pub fn git_list_branches(repo_path: String) -> Result<Vec<GitBranch>, StudioError> {
    let repo = open_repo(&repo_path)?;

    let head_name = repo
        .head()
        .ok()
        .and_then(|h| h.shorthand().map(str::to_string));

    let branches = repo
        .branches(Some(git2::BranchType::Local))
        .map_err(|e| StudioError::Other(e.to_string()))?;

    let result: Vec<GitBranch> = branches
        .filter_map(|b| b.ok())
        .filter_map(|(branch, _)| {
            let name = branch.name().ok()??.to_string();
            let is_current = head_name.as_deref() == Some(name.as_str());
            Some(GitBranch { name, is_current })
        })
        .collect();

    Ok(result)
}

/// Create a new local branch from the current HEAD (does not switch to it).
#[tauri::command]
pub fn git_create_branch(repo_path: String, name: String) -> Result<(), StudioError> {
    let repo = open_repo(&repo_path)?;
    let head = repo
        .head()
        .map_err(|e| StudioError::Other(e.to_string()))?;
    let commit = head
        .peel_to_commit()
        .map_err(|e| StudioError::Other(e.to_string()))?;
    repo.branch(&name, &commit, false)
        .map_err(|e| StudioError::Other(format!("Cannot create branch '{name}': {e}")))?;
    Ok(())
}

/// Switch the working tree to an existing local branch (checkout + set HEAD).
#[tauri::command]
pub fn git_switch_branch(repo_path: String, name: String) -> Result<(), StudioError> {
    let repo = open_repo(&repo_path)?;
    let refname = format!("refs/heads/{name}");
    let obj = repo
        .revparse_single(&refname)
        .map_err(|e| StudioError::Other(format!("Branch not found '{name}': {e}")))?;
    let mut checkout_opts = git2::build::CheckoutBuilder::new();
    checkout_opts.safe();
    repo.checkout_tree(&obj, Some(&mut checkout_opts))
        .map_err(|e| StudioError::Other(format!("Checkout failed: {e}")))?;
    repo.set_head(&refname)
        .map_err(|e| StudioError::Other(e.to_string()))
}

/// Delete a local branch (must not be the current branch).
#[tauri::command]
pub fn git_delete_branch(repo_path: String, name: String) -> Result<(), StudioError> {
    let repo = open_repo(&repo_path)?;
    let mut branch = repo
        .find_branch(&name, git2::BranchType::Local)
        .map_err(|e| StudioError::Other(format!("Branch not found '{name}': {e}")))?;
    branch
        .delete()
        .map_err(|e| StudioError::Other(e.to_string()))
}

/// Push a branch to a remote using the system `git` binary (inherits SSH agent / credential store).
#[tauri::command]
pub fn git_push(
    repo_path: String,
    remote: String,
    branch: String,
) -> Result<GitPushResult, StudioError> {
    let expanded = expand_tilde(&repo_path);
    let output = std::process::Command::new("git")
        .args(["-C", &expanded, "push", &remote, &branch])
        .output()
        .map_err(|e| StudioError::Other(format!("Failed to run git: {e}")))?;

    let success = output.status.success();
    let raw = if success {
        String::from_utf8_lossy(&output.stdout)
    } else {
        String::from_utf8_lossy(&output.stderr)
    };
    let message = raw.trim().to_string();
    Ok(GitPushResult { success, message })
}

/// Pull from a remote using the system `git` binary (inherits SSH agent / credential store).
#[tauri::command]
pub fn git_pull(
    repo_path: String,
    remote: String,
    branch: String,
) -> Result<GitPullResult, StudioError> {
    let expanded = expand_tilde(&repo_path);
    let output = std::process::Command::new("git")
        .args(["-C", &expanded, "pull", &remote, &branch])
        .output()
        .map_err(|e| StudioError::Other(format!("Failed to run git: {e}")))?;

    let success = output.status.success();
    let raw = if success {
        String::from_utf8_lossy(&output.stdout)
    } else {
        String::from_utf8_lossy(&output.stderr)
    };
    let message = raw.trim().to_string();
    Ok(GitPullResult { success, message })
}

/// Return the last `limit` commits on the current branch (default 50).
#[tauri::command]
pub fn git_log(repo_path: String, limit: Option<u32>) -> Result<Vec<GitCommitInfo>, StudioError> {
    let repo = open_repo(&repo_path)?;
    let mut revwalk = repo
        .revwalk()
        .map_err(|e| StudioError::Other(e.to_string()))?;
    revwalk
        .push_head()
        .map_err(|e| StudioError::Other(e.to_string()))?;
    revwalk
        .set_sorting(git2::Sort::TIME)
        .map_err(|e| StudioError::Other(e.to_string()))?;

    let max = limit.unwrap_or(50) as usize;
    let commits = revwalk
        .take(max)
        .filter_map(|oid| oid.ok())
        .filter_map(|oid| repo.find_commit(oid).ok())
        .map(|commit| {
            let sha = commit.id().to_string();
            let short_sha = sha[..7].to_string();
            let message = commit.summary().unwrap_or("").to_string();
            let author = commit.author().name().unwrap_or("").to_string();
            let timestamp = commit.time().seconds();
            GitCommitInfo { sha, short_sha, message, author, timestamp }
        })
        .collect();

    Ok(commits)
}

/// Read a file from the working tree. Path is relative to `repo_path`.
#[tauri::command]
pub fn git_read_file(repo_path: String, file_path: String) -> Result<String, StudioError> {
    let expanded = expand_tilde(&repo_path);
    let full = Path::new(&expanded).join(&file_path);
    std::fs::read_to_string(&full)
        .map_err(|e| StudioError::Other(format!("Cannot read '{file_path}': {e}")))
}

// ── Diff content for MergeView ────────────────────────────────────────────────

/// Both file versions for a side-by-side diff viewer (e.g. CodeMirror MergeView).
/// New files have an empty `original`; deleted files have an empty `modified`.
#[derive(Debug, Serialize, TS)]
#[ts(export, export_to = "bindings/")]
pub struct GitDiffContent {
    pub original: String,
    pub modified: String,
}

/// Return the original and modified content of a file for a side-by-side diff.
///
/// - `staged = true`:  HEAD → index  (original = HEAD blob, modified = staged blob)
/// - `staged = false`: index → worktree (original = staged or HEAD blob, modified = working tree)
#[tauri::command]
pub fn git_diff_content(
    repo_path: String,
    file_path: String,
    staged: bool,
) -> Result<GitDiffContent, StudioError> {
    let repo = open_repo(&repo_path)?;

    if staged {
        let original = read_blob_at_head(&repo, &file_path).unwrap_or_default();
        let modified = read_blob_at_index(&repo, &file_path).unwrap_or_default();
        Ok(GitDiffContent { original, modified })
    } else {
        let original = read_blob_at_index(&repo, &file_path)
            .or_else(|_| read_blob_at_head(&repo, &file_path))
            .unwrap_or_default();
        let expanded = expand_tilde(&repo_path);
        let full = std::path::Path::new(&expanded).join(&file_path);
        let modified = std::fs::read_to_string(&full).unwrap_or_default();
        Ok(GitDiffContent { original, modified })
    }
}

fn read_blob_at_head(repo: &Repository, file_path: &str) -> Result<String, StudioError> {
    let tree = repo
        .head()
        .map_err(|e| StudioError::Other(e.to_string()))?
        .peel_to_tree()
        .map_err(|e| StudioError::Other(e.to_string()))?;
    let entry = tree
        .get_path(std::path::Path::new(file_path))
        .map_err(|e| StudioError::Other(format!("'{file_path}' not in HEAD: {e}")))?;
    let blob = repo
        .find_blob(entry.id())
        .map_err(|e| StudioError::Other(e.to_string()))?;
    String::from_utf8(blob.content().to_vec())
        .map_err(|_| StudioError::Other(format!("'{file_path}' contains binary content")))
}

fn read_blob_at_index(repo: &Repository, file_path: &str) -> Result<String, StudioError> {
    let index = repo
        .index()
        .map_err(|e| StudioError::Other(e.to_string()))?;
    let entry = index
        .get_path(std::path::Path::new(file_path), 0)
        .ok_or_else(|| StudioError::Other(format!("'{file_path}' not in index")))?;
    let blob = repo
        .find_blob(entry.id)
        .map_err(|e| StudioError::Other(e.to_string()))?;
    String::from_utf8(blob.content().to_vec())
        .map_err(|_| StudioError::Other(format!("'{file_path}' contains binary content")))
}

/// Write content to a file in the working tree. Path is relative to `repo_path`.
#[tauri::command]
pub fn git_write_file(
    repo_path: String,
    file_path: String,
    content: String,
) -> Result<(), StudioError> {
    let expanded = expand_tilde(&repo_path);
    let full = Path::new(&expanded).join(&file_path);
    std::fs::write(&full, content)
        .map_err(|e| StudioError::Other(format!("Cannot write '{file_path}': {e}")))
}

/// Commit the current index with the given message using the repo's git identity.
/// Returns the short commit SHA.
#[tauri::command]
pub fn git_commit(repo_path: String, message: String) -> Result<String, StudioError> {
    let repo = open_repo(&repo_path)?;

    let sig = repo
        .signature()
        .map_err(|e| StudioError::Other(format!("No git identity configured: {e}")))?;

    let mut index = repo
        .index()
        .map_err(|e| StudioError::Other(e.to_string()))?;
    let tree_id = index
        .write_tree()
        .map_err(|e| StudioError::Other(e.to_string()))?;
    let tree = repo
        .find_tree(tree_id)
        .map_err(|e| StudioError::Other(e.to_string()))?;

    let parent_commit: Option<git2::Commit> = repo.head().ok().and_then(|h| h.peel_to_commit().ok());
    let parents: Vec<&git2::Commit> = parent_commit.iter().collect();

    let oid = repo
        .commit(Some("HEAD"), &sig, &sig, &message, &tree, &parents)
        .map_err(|e| StudioError::Other(e.to_string()))?;

    Ok(oid.to_string())
}
