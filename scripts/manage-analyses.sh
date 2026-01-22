#!/bin/bash

# Analysis Management Script
# Handles organization, cleanup, and reporting for AI-generated analyses

set -e

ANALYSIS_DIR="docs/analyses"
ARCHIVE_DIR="docs/archive/analyses"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create directories if they don't exist
mkdir -p "$ANALYSIS_DIR"
mkdir -p "$ARCHIVE_DIR"

show_help() {
    echo "🤖 Analysis Management Script"
    echo "============================"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  status    Show analysis statistics"
    echo "  list      List all analyses"
    echo "  archive   Move old analyses (>30 days) to archive"
    echo "  cleanup   Remove analyses older than 90 days"
    echo "  search    Search analyses by keyword"
    echo "  report    Generate analysis report"
    echo "  help      Show this help"
    echo ""
    echo "Examples:"
    echo "  $0 status"
    echo "  $0 search bug-fix"
    echo "  $0 archive"
}

show_status() {
    echo -e "${BLUE}🤖 Analysis Status${NC}"
    echo "=================="

    # Count files
    total=$(find "$ANALYSIS_DIR" -name "*.md" | wc -l)
    archived=$(find "$ARCHIVE_DIR" -name "*.md" 2>/dev/null | wc -l || echo 0)
    recent=$(find "$ANALYSIS_DIR" -name "*.md" -mtime -7 | wc -l)
    this_month=$(find "$ANALYSIS_DIR" -name "*.md" -newermt "$(date +%Y-%m-01)" | wc -l)

    echo "📊 Statistics:"
    echo "  Total analyses: $total"
    echo "  Archived: $archived"
    echo "  Recent (7 days): $recent"
    echo "  This month: $this_month"
    echo ""

    # Show task type breakdown
    echo "🎯 Task Types:"
    if [ "$total" -gt 0 ]; then
        echo "  Bug fixes: $(grep -l "bug-fix" "$ANALYSIS_DIR"/*.md | wc -l)"
        echo "  Features: $(grep -l "feature" "$ANALYSIS_DIR"/*.md | wc -l)"
        echo "  Refactors: $(grep -l "refactor" "$ANALYSIS_DIR"/*.md | wc -l)"
        echo "  Tests: $(grep -l "test" "$ANALYSIS_DIR"/*.md | wc -l)"
    fi
    echo ""

    # Show recent activity
    echo "📅 Recent Activity:"
    find "$ANALYSIS_DIR" -name "*.md" -mtime -7 | head -5 | while read -r file; do
        filename=$(basename "$file")
        echo "  • $filename"
    done
}

list_analyses() {
    echo -e "${BLUE}📋 All Analyses${NC}"
    echo "==============="

    if [ ! -d "$ANALYSIS_DIR" ]; then
        echo "No analyses directory found."
        return
    fi

    find "$ANALYSIS_DIR" -name "*.md" -type f | sort -r | while read -r file; do
        filename=$(basename "$file")
        # Extract date and task type from filename
        date_part=$(echo "$filename" | cut -d'-' -f1-3)
        task_type=$(echo "$filename" | cut -d'-' -f4)

        # Get first line of description
        description=$(head -3 "$file" | grep "Core Problem:" | sed 's/**Core Problem:** //' || echo "No description")

        echo -e "${GREEN}$date_part${NC} | ${YELLOW}$task_type${NC} | $description"
    done
}

archive_old() {
    echo -e "${YELLOW}🗄️  Archiving Old Analyses${NC}"
    echo "=========================="

    # Find analyses older than 30 days
    old_files=$(find "$ANALYSIS_DIR" -name "*.md" -mtime +30)

    if [ -z "$old_files" ]; then
        echo "No old analyses to archive."
        return
    fi

    echo "Files to archive:"
    echo "$old_files" | while read -r file; do
        echo "  • $(basename "$file")"
    done

    echo ""
    read -p "Archive these files? (y/N): " -n 1 -r
    echo ""

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "$old_files" | while read -r file; do
            mv "$file" "$ARCHIVE_DIR/"
            echo "Archived: $(basename "$file")"
        done
        echo -e "\n${GREEN}✅ Archiving complete${NC}"
    else
        echo "Archiving cancelled."
    fi
}

cleanup_old() {
    echo -e "${RED}🗑️  Cleaning Up Old Analyses${NC}"
    echo "=============================="

    # Find archived analyses older than 90 days
    old_files=$(find "$ARCHIVE_DIR" -name "*.md" -mtime +90 2>/dev/null)

    if [ -z "$old_files" ]; then
        echo "No old archived analyses to clean up."
        return
    fi

    echo "Files to delete:"
    echo "$old_files" | while read -r file; do
        echo "  • $(basename "$file")"
    done

    echo ""
    read -p "Permanently delete these files? (y/N): " -n 1 -r
    echo ""

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "$old_files" | xargs rm -f
        echo -e "\n${GREEN}✅ Cleanup complete${NC}"
    else
        echo "Cleanup cancelled."
    fi
}

search_analyses() {
    if [ $# -eq 0 ]; then
        echo "Usage: $0 search <keyword>"
        return
    fi

    keyword="$1"
    echo -e "${BLUE}🔍 Searching for: $keyword${NC}"
    echo "=========================="

    found_files=$(grep -l -i "$keyword" "$ANALYSIS_DIR"/*.md 2>/dev/null)

    if [ -z "$found_files" ]; then
        echo "No analyses found matching '$keyword'"
        return
    fi

    echo "$found_files" | while read -r file; do
        filename=$(basename "$file")
        # Show context around the match
        echo -e "\n${GREEN}$filename${NC}:"
        grep -i -A 2 -B 2 "$keyword" "$file" | head -10 | sed 's/^/  /'
    done
}

generate_report() {
    echo -e "${BLUE}📊 Analysis Report${NC}"
    echo "==================="

    report_file="$ANALYSIS_DIR/analysis-report-$(date +%Y-%m-%d).md"

    {
        echo "# 🤖 Analysis Report - $(date +%Y-%m-%d)"
        echo ""
        echo "## 📈 Statistics"
        echo "- Total analyses: $(find "$ANALYSIS_DIR" -name "*.md" | wc -l)"
        echo "- Archived: $(find "$ARCHIVE_DIR" -name "*.md" 2>/dev/null | wc -l || echo 0)"
        echo "- Recent (7 days): $(find "$ANALYSIS_DIR" -name "*.md" -mtime -7 | wc -l)"
        echo ""
        echo "## 🎯 Task Breakdown"

        for task_type in bug-fix feature refactor test review; do
            count=$(grep -l "$task_type" "$ANALYSIS_DIR"/*.md 2>/dev/null | wc -l)
            if [ "$count" -gt 0 ]; then
                echo "- $task_type: $count"
            fi
        done

        echo ""
        echo "## 📅 Recent Activity"
        find "$ANALYSIS_DIR" -name "*.md" -mtime -14 | head -10 | while read -r file; do
            filename=$(basename "$file")
            echo "- $filename"
        done

    } > "$report_file"

    echo "Report generated: $report_file"
}

# Main script logic
case "${1:-status}" in
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
        echo "Unknown command: $1"
        echo "Use '$0 help' for usage information."
        exit 1
        ;;
esac