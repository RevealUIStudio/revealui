#!/bin/bash
# =============================================================================
# Analysis Management Script
# =============================================================================
# Handles organization, cleanup, and reporting for AI-generated analyses
#
# Usage:
#   ./manage-analyses.sh [command] [options]
#
# Commands:
#   status    Show analysis statistics
#   list      List all analyses
#   archive   Move old analyses (>30 days) to archive
#   cleanup   Remove analyses older than 90 days
#   search    Search analyses by keyword
#   report    Generate analysis report
#   help      Show this help
#
# Options:
#   --json       Output in JSON format (for automation)
#   --no-color   Disable colored output
#   --force      Skip confirmation prompts
#   --verbose    Show detailed output
#
# Examples:
#   ./manage-analyses.sh status --json
#   ./manage-analyses.sh search "bug-fix" --no-color
#   ./manage-analyses.sh archive --force
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/_helpers.sh"

ANALYSIS_DIR="docs/analyses"
ARCHIVE_DIR="docs/archive/analyses"

# Parse flags first
parse_common_flags "$@"
set -- "${REMAINING_ARGS[@]}"

# Create directories if they don't exist
mkdir -p "$ANALYSIS_DIR" 2>/dev/null || true
mkdir -p "$ARCHIVE_DIR" 2>/dev/null || true

show_help() {
  if [ "$JSON_MODE" = "true" ]; then
    json_success '{"command": "help", "message": "Use --help without --json for usage information"}'
    exit $EXIT_SUCCESS
  fi

  cat << 'EOF'
Analysis Management Script

Usage:
  ./manage-analyses.sh [command] [options]

Commands:
  status    Show analysis statistics
  list      List all analyses
  archive   Move old analyses (>30 days) to archive
  cleanup   Remove analyses older than 90 days
  search    Search analyses by keyword
  report    Generate analysis report
  help      Show this help

Options:
  --json       Output in JSON format (for automation)
  --no-color   Disable colored output
  --force      Skip confirmation prompts
  --verbose    Show detailed output

Examples:
  ./manage-analyses.sh status --json
  ./manage-analyses.sh search "bug-fix" --no-color
  ./manage-analyses.sh archive --force
EOF
}

show_status() {
  # Count files
  local total=$(find "$ANALYSIS_DIR" -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
  local archived=$(find "$ARCHIVE_DIR" -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
  local recent=$(find "$ANALYSIS_DIR" -name "*.md" -mtime -7 2>/dev/null | wc -l | tr -d ' ')
  local this_month=$(find "$ANALYSIS_DIR" -name "*.md" -newermt "$(date +%Y-%m-01)" 2>/dev/null | wc -l | tr -d ' ')

  # Count by type
  local bug_fixes=0
  local features=0
  local refactors=0
  local tests=0

  if [ "$total" -gt 0 ]; then
    bug_fixes=$(grep -l "bug-fix" "$ANALYSIS_DIR"/*.md 2>/dev/null | wc -l | tr -d ' ')
    features=$(grep -l "feature" "$ANALYSIS_DIR"/*.md 2>/dev/null | wc -l | tr -d ' ')
    refactors=$(grep -l "refactor" "$ANALYSIS_DIR"/*.md 2>/dev/null | wc -l | tr -d ' ')
    tests=$(grep -l "test" "$ANALYSIS_DIR"/*.md 2>/dev/null | wc -l | tr -d ' ')
  fi

  if [ "$JSON_MODE" = "true" ]; then
    # Collect recent files
    local recent_files_json="["
    local first=true
    while IFS= read -r file; do
      [ -z "$file" ] && continue
      local filename=$(basename "$file")
      if [ "$first" = "true" ]; then
        recent_files_json+="\"$filename\""
        first=false
      else
        recent_files_json+=",\"$filename\""
      fi
    done < <(find "$ANALYSIS_DIR" -name "*.md" -mtime -7 2>/dev/null | head -5)
    recent_files_json+="]"

    json_success "{
    \"total\": $total,
    \"archived\": $archived,
    \"recent\": $recent,
    \"thisMonth\": $this_month,
    \"byType\": {
      \"bugFixes\": $bug_fixes,
      \"features\": $features,
      \"refactors\": $refactors,
      \"tests\": $tests
    },
    \"recentFiles\": $recent_files_json
  }"
  else
    log_header "Analysis Status"

    echo "Statistics:"
    echo "  Total analyses: $total"
    echo "  Archived: $archived"
    echo "  Recent (7 days): $recent"
    echo "  This month: $this_month"
    echo ""

    echo "Task Types:"
    echo "  Bug fixes: $bug_fixes"
    echo "  Features: $features"
    echo "  Refactors: $refactors"
    echo "  Tests: $tests"
    echo ""

    echo "Recent Activity:"
    find "$ANALYSIS_DIR" -name "*.md" -mtime -7 2>/dev/null | head -5 | while read -r file; do
      [ -z "$file" ] && continue
      local filename=$(basename "$file")
      echo "  - $filename"
    done
  fi
}

list_analyses() {
  if [ ! -d "$ANALYSIS_DIR" ]; then
    if [ "$JSON_MODE" = "true" ]; then
      json_success '{"analyses": [], "count": 0}'
    else
      log_warning "No analyses directory found."
    fi
    return
  fi

  local files=()
  while IFS= read -r file; do
    [ -z "$file" ] && continue
    files+=("$file")
  done < <(find "$ANALYSIS_DIR" -name "*.md" -type f 2>/dev/null | sort -r)

  if [ "$JSON_MODE" = "true" ]; then
    local json_array="["
    local first=true
    for file in "${files[@]}"; do
      local filename=$(basename "$file")
      local date_part=$(echo "$filename" | cut -d'-' -f1-3)
      local task_type=$(echo "$filename" | cut -d'-' -f4)

      if [ "$first" = "true" ]; then
        first=false
      else
        json_array+=","
      fi
      json_array+="{\"filename\":\"$filename\",\"date\":\"$date_part\",\"type\":\"$task_type\"}"
    done
    json_array+="]"

    json_success "{\"analyses\": $json_array, \"count\": ${#files[@]}}"
  else
    log_header "All Analyses"

    for file in "${files[@]}"; do
      local filename=$(basename "$file")
      local date_part=$(echo "$filename" | cut -d'-' -f1-3)
      local task_type=$(echo "$filename" | cut -d'-' -f4)
      local description=$(head -3 "$file" | grep "Core Problem:" | sed 's/**Core Problem:** //' || echo "No description")

      echo -e "${GREEN}$date_part${NC} | ${YELLOW}$task_type${NC} | $description"
    done
  fi
}

archive_old() {
  # Find analyses older than 30 days
  local old_files=()
  while IFS= read -r file; do
    [ -z "$file" ] && continue
    old_files+=("$file")
  done < <(find "$ANALYSIS_DIR" -name "*.md" -mtime +30 2>/dev/null)

  if [ ${#old_files[@]} -eq 0 ]; then
    if [ "$JSON_MODE" = "true" ]; then
      json_success '{"archived": [], "count": 0, "message": "No old analyses to archive"}'
    else
      log_info "No old analyses to archive."
    fi
    return
  fi

  if [ "$JSON_MODE" = "true" ]; then
    # In JSON mode with --force, archive automatically
    local archived_json="["
    local first=true
    for file in "${old_files[@]}"; do
      local filename=$(basename "$file")
      mv "$file" "$ARCHIVE_DIR/"
      if [ "$first" = "true" ]; then
        archived_json+="\"$filename\""
        first=false
      else
        archived_json+=",\"$filename\""
      fi
    done
    archived_json+="]"
    json_success "{\"archived\": $archived_json, \"count\": ${#old_files[@]}}"
  else
    log_header "Archiving Old Analyses"

    echo "Files to archive:"
    for file in "${old_files[@]}"; do
      echo "  - $(basename "$file")"
    done
    echo ""

    if confirm "Archive these files?"; then
      for file in "${old_files[@]}"; do
        mv "$file" "$ARCHIVE_DIR/"
        log_success "Archived: $(basename "$file")"
      done
      log_success "Archiving complete"
    else
      log_warning "Archiving cancelled."
      exit $EXIT_CANCELLED
    fi
  fi
}

cleanup_old() {
  # Find archived analyses older than 90 days
  local old_files=()
  while IFS= read -r file; do
    [ -z "$file" ] && continue
    old_files+=("$file")
  done < <(find "$ARCHIVE_DIR" -name "*.md" -mtime +90 2>/dev/null)

  if [ ${#old_files[@]} -eq 0 ]; then
    if [ "$JSON_MODE" = "true" ]; then
      json_success '{"deleted": [], "count": 0, "message": "No old archived analyses to clean up"}'
    else
      log_info "No old archived analyses to clean up."
    fi
    return
  fi

  if [ "$JSON_MODE" = "true" ]; then
    # In JSON mode with --force, delete automatically
    local deleted_json="["
    local first=true
    for file in "${old_files[@]}"; do
      local filename=$(basename "$file")
      rm -f "$file"
      if [ "$first" = "true" ]; then
        deleted_json+="\"$filename\""
        first=false
      else
        deleted_json+=",\"$filename\""
      fi
    done
    deleted_json+="]"
    json_success "{\"deleted\": $deleted_json, \"count\": ${#old_files[@]}}"
  else
    log_header "Cleaning Up Old Analyses"

    echo "Files to delete:"
    for file in "${old_files[@]}"; do
      echo "  - $(basename "$file")"
    done
    echo ""

    if confirm "Permanently delete these files?"; then
      for file in "${old_files[@]}"; do
        rm -f "$file"
      done
      log_success "Cleanup complete"
    else
      log_warning "Cleanup cancelled."
      exit $EXIT_CANCELLED
    fi
  fi
}

search_analyses() {
  local keyword="$1"

  if [ -z "$keyword" ]; then
    if [ "$JSON_MODE" = "true" ]; then
      json_error "VALIDATION_ERROR" "Search keyword required"
      exit $EXIT_VALIDATION_ERROR
    else
      log_error "Usage: $0 search <keyword>"
      exit $EXIT_VALIDATION_ERROR
    fi
  fi

  local found_files=()
  while IFS= read -r file; do
    [ -z "$file" ] && continue
    found_files+=("$file")
  done < <(grep -l -i "$keyword" "$ANALYSIS_DIR"/*.md 2>/dev/null)

  if [ ${#found_files[@]} -eq 0 ]; then
    if [ "$JSON_MODE" = "true" ]; then
      json_success "{\"query\": \"$keyword\", \"results\": [], \"count\": 0}"
    else
      log_info "No analyses found matching '$keyword'"
    fi
    return
  fi

  if [ "$JSON_MODE" = "true" ]; then
    local results_json="["
    local first=true
    for file in "${found_files[@]}"; do
      local filename=$(basename "$file")
      if [ "$first" = "true" ]; then
        first=false
      else
        results_json+=","
      fi
      results_json+="{\"filename\":\"$filename\"}"
    done
    results_json+="]"
    json_success "{\"query\": \"$keyword\", \"results\": $results_json, \"count\": ${#found_files[@]}}"
  else
    log_header "Search Results: $keyword"

    for file in "${found_files[@]}"; do
      local filename=$(basename "$file")
      echo -e "\n${GREEN}$filename${NC}:"
      grep -i -A 2 -B 2 "$keyword" "$file" 2>/dev/null | head -10 | sed 's/^/  /'
    done
  fi
}

generate_report() {
  local report_file="$ANALYSIS_DIR/analysis-report-$(date +%Y-%m-%d).md"

  local total=$(find "$ANALYSIS_DIR" -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
  local archived=$(find "$ARCHIVE_DIR" -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
  local recent=$(find "$ANALYSIS_DIR" -name "*.md" -mtime -7 2>/dev/null | wc -l | tr -d ' ')

  if [ "$JSON_MODE" = "true" ]; then
    json_success "{\"reportFile\": \"$report_file\", \"stats\": {\"total\": $total, \"archived\": $archived, \"recent\": $recent}}"
  else
    log_header "Generating Analysis Report"

    {
      echo "# Analysis Report - $(date +%Y-%m-%d)"
      echo ""
      echo "## Statistics"
      echo "- Total analyses: $total"
      echo "- Archived: $archived"
      echo "- Recent (7 days): $recent"
      echo ""
      echo "## Task Breakdown"

      for task_type in bug-fix feature refactor test review; do
        local count=$(grep -l "$task_type" "$ANALYSIS_DIR"/*.md 2>/dev/null | wc -l | tr -d ' ')
        if [ "$count" -gt 0 ]; then
          echo "- $task_type: $count"
        fi
      done

      echo ""
      echo "## Recent Activity"
      find "$ANALYSIS_DIR" -name "*.md" -mtime -14 2>/dev/null | head -10 | while read -r file; do
        [ -z "$file" ] && continue
        local filename=$(basename "$file")
        echo "- $filename"
      done
    } > "$report_file"

    log_success "Report generated: $report_file"
  fi
}

# Main script logic
command="${1:-status}"

case "$command" in
  status)
    show_status
    ;;
  list)
    list_analyses
    ;;
  archive)
    archive_old
    ;;
  cleanup)
    cleanup_old
    ;;
  search)
    shift
    search_analyses "$@"
    ;;
  report)
    generate_report
    ;;
  help|--help|-h)
    show_help
    ;;
  *)
    if [ "$JSON_MODE" = "true" ]; then
      json_error "VALIDATION_ERROR" "Unknown command: $command"
      exit $EXIT_VALIDATION_ERROR
    else
      log_error "Unknown command: $command"
      log_info "Use '$0 help' for usage information."
      exit $EXIT_VALIDATION_ERROR
    fi
    ;;
esac
