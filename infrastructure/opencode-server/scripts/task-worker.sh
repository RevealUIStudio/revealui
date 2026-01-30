#!/bin/bash
# Task Worker for Long-Running OpenCode Operations
# This script handles background tasks that might timeout

set -euo pipefail

# Configuration
TASK_DIR="/tasks"
LOG_DIR="/var/log/opencode-tasks"
MAX_RETRIES=3
RETRY_DELAY=5

# Create directories
mkdir -p "$TASK_DIR/queue" "$TASK_DIR/running" "$TASK_DIR/completed" "$TASK_DIR/failed" "$LOG_DIR"

# Logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_DIR/worker.log"
}

# Process a single task
process_task() {
    local task_file="$1"
    local task_id=$(basename "$task_file" .json)
    local task_dir=$(dirname "$task_file")
    
    log "Processing task: $task_id"
    
    # Move to running
    mv "$task_file" "$TASK_DIR/running/$task_id.json"
    task_file="$TASK_DIR/running/$task_id.json"
    
    # Read task parameters
    local command=$(jq -r '.command' "$task_file")
    local cwd=$(jq -r '.cwd // "/workspace"' "$task_file")
    local timeout=$(jq -r '.timeout // 3600' "$task_file")  # Default 1 hour
    local retries=$(jq -r '.retries // 0' "$task_file")
    
    log "Command: $command"
    log "Working dir: $cwd"
    log "Timeout: ${timeout}s"
    
    # Execute with timeout and retry logic
    local attempt=0
    local exit_code=1
    local output=""
    
    while [ $attempt -lt $((retries + 1)) ]; do
        attempt=$((attempt + 1))
        log "Attempt $attempt of $((retries + 1))"
        
        # Run command with timeout
        if output=$(cd "$cwd" && timeout "$timeout" bash -c "$command" 2>&1); then
            exit_code=0
            log "✅ Task completed successfully"
            break
        else
            exit_code=$?
            log "❌ Attempt $attempt failed with exit code $exit_code"
            
            if [ $attempt -lt $((retries + 1)) ]; then
                log "Waiting ${RETRY_DELAY}s before retry..."
                sleep $RETRY_DELAY
            fi
        fi
    done
    
    # Update task status
    local end_time=$(date -Iseconds)
    if [ $exit_code -eq 0 ]; then
        jq --arg end_time "$end_time" \
           --arg output "$output" \
           '.status = "completed" | .end_time = $end_time | .output = $output' \
           "$task_file" > "$task_file.tmp" && mv "$task_file.tmp" "$task_file"
        
        mv "$task_file" "$TASK_DIR/completed/"
        log "✅ Task $task_id completed and archived"
    else
        jq --arg end_time "$end_time" \
           --arg output "$output" \
           --arg exit_code "$exit_code" \
           '.status = "failed" | .end_time = $end_time | .output = $output | .exit_code = $exit_code' \
           "$task_file" > "$task_file.tmp" && mv "$task_file.tmp" "$task_file"
        
        mv "$task_file" "$TASK_DIR/failed/"
        log "❌ Task $task_id failed and archived"
    fi
}

# Main worker loop
log "🚀 Task Worker started"
log "Watching for tasks in $TASK_DIR/queue"

while true; do
    # Find pending tasks
    for task_file in "$TASK_DIR/queue"/*.json; do
        if [ -f "$task_file" ]; then
            process_task "$task_file"
        fi
    done
    
    # Sleep before checking again
    sleep 2
done