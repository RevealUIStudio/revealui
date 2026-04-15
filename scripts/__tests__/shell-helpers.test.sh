#!/usr/bin/env bash
# =============================================================================
# Shell Script Helpers Integration Tests
# =============================================================================
# Tests for scripts/agent/_helpers.sh
#
# Run with: bash scripts/__tests__/shell-helpers.test.sh
# Or with vitest: vitest scripts/__tests__/shell-helpers.test.ts
# =============================================================================

set -e

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Colors for test output
TEST_GREEN='\033[0;32m'
TEST_RED='\033[0;31m'
TEST_YELLOW='\033[1;33m'
TEST_NC='\033[0m'

# Test result tracking
declare -a FAILED_TESTS=()

# =============================================================================
# Test Framework Functions
# =============================================================================

assert_equals() {
  local expected="$1"
  local actual="$2"
  local message="${3:-Assertion failed}"

  if [ "$expected" = "$actual" ]; then
    return 0
  else
    echo -e "${TEST_RED}✗${TEST_NC} $message"
    echo "  Expected: $expected"
    echo "  Actual:   $actual"
    FAILED_TESTS+=("$message")
    return 1
  fi
}

assert_contains() {
  local haystack="$1"
  local needle="$2"
  local message="${3:-String should contain substring}"

  if [[ "$haystack" == *"$needle"* ]]; then
    return 0
  else
    echo -e "${TEST_RED}✗${TEST_NC} $message"
    echo "  String: $haystack"
    echo "  Should contain: $needle"
    FAILED_TESTS+=("$message")
    return 1
  fi
}

assert_not_contains() {
  local haystack="$1"
  local needle="$2"
  local message="${3:-String should not contain substring}"

  if [[ "$haystack" != *"$needle"* ]]; then
    return 0
  else
    echo -e "${TEST_RED}✗${TEST_NC} $message"
    echo "  String: $haystack"
    echo "  Should not contain: $needle"
    FAILED_TESTS+=("$message")
    return 1
  fi
}

run_test() {
  local test_name="$1"
  local test_function="$2"

  ((TESTS_RUN++))

  if $test_function; then
    ((TESTS_PASSED++))
    echo -e "${TEST_GREEN}✓${TEST_NC} $test_name"
  else
    ((TESTS_FAILED++))
    echo -e "${TEST_RED}✗${TEST_NC} $test_name"
  fi
}

# =============================================================================
# Setup
# =============================================================================

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
HELPERS_PATH="$PROJECT_ROOT/scripts/agent/_helpers.sh"

# Verify helpers file exists
if [ ! -f "$HELPERS_PATH" ]; then
  echo -e "${TEST_RED}ERROR:${TEST_NC} Helpers file not found at $HELPERS_PATH"
  exit 1
fi

# =============================================================================
# Test Cases
# =============================================================================

test_helpers_file_exists() {
  [ -f "$HELPERS_PATH" ]
}

test_parse_json_flag() {
  source "$HELPERS_PATH"
  parse_common_flags --json
  assert_equals "true" "$JSON_MODE" "JSON_MODE should be true with --json flag"
}

test_parse_short_json_flag() {
  source "$HELPERS_PATH"
  parse_common_flags -j
  assert_equals "true" "$JSON_MODE" "JSON_MODE should be true with -j flag"
}

test_parse_no_color_flag() {
  source "$HELPERS_PATH"
  parse_common_flags --no-color
  assert_equals "true" "$NO_COLOR" "NO_COLOR should be true with --no-color flag"
}

test_parse_verbose_flag() {
  source "$HELPERS_PATH"
  parse_common_flags --verbose
  assert_equals "true" "$VERBOSE" "VERBOSE should be true with --verbose flag"
}

test_parse_short_verbose_flag() {
  source "$HELPERS_PATH"
  parse_common_flags -v
  assert_equals "true" "$VERBOSE" "VERBOSE should be true with -v flag"
}

test_parse_force_flag() {
  source "$HELPERS_PATH"
  parse_common_flags --force
  assert_equals "true" "$FORCE" "FORCE should be true with --force flag"
}

test_parse_short_force_flag() {
  source "$HELPERS_PATH"
  parse_common_flags -f
  assert_equals "true" "$FORCE" "FORCE should be true with -f flag"
}

test_parse_multiple_flags() {
  source "$HELPERS_PATH"
  parse_common_flags --json --verbose --force
  assert_equals "true" "$JSON_MODE" "JSON_MODE should be true" && \
  assert_equals "true" "$VERBOSE" "VERBOSE should be true" && \
  assert_equals "true" "$FORCE" "FORCE should be true"
}

test_parse_args_count() {
  source "$HELPERS_PATH"
  parse_common_flags --json --verbose arg1 arg2
  assert_equals "2" "$PARSED_ARGS_COUNT" "PARSED_ARGS_COUNT should be 2"
}

test_log_info_human_mode() {
  source "$HELPERS_PATH"
  JSON_MODE=false
  output=$(log_info "Test message" 2>&1)
  assert_contains "$output" "[INFO]" "log_info should contain [INFO] tag"
  assert_contains "$output" "Test message" "log_info should contain message"
}

test_log_info_json_mode() {
  source "$HELPERS_PATH"
  JSON_MODE=true
  output=$(log_info "Test message" 2>&1)
  assert_equals "" "$output" "log_info should output nothing in JSON mode"
}

test_log_success_human_mode() {
  source "$HELPERS_PATH"
  JSON_MODE=false
  output=$(log_success "Success message" 2>&1)
  assert_contains "$output" "[OK]" "log_success should contain [OK] tag"
}

test_log_warning_human_mode() {
  source "$HELPERS_PATH"
  JSON_MODE=false
  output=$(log_warning "Warning message" 2>&1)
  assert_contains "$output" "[WARN]" "log_warning should contain [WARN] tag"
}

test_log_error_human_mode() {
  source "$HELPERS_PATH"
  JSON_MODE=false
  output=$(log_error "Error message" 2>&1)
  assert_contains "$output" "[ERROR]" "log_error should contain [ERROR] tag"
}

test_log_debug_verbose_mode() {
  source "$HELPERS_PATH"
  JSON_MODE=false
  VERBOSE=true
  output=$(log_debug "Debug message" 2>&1)
  assert_contains "$output" "[DEBUG]" "log_debug should show in verbose mode"
}

test_log_debug_non_verbose_mode() {
  source "$HELPERS_PATH"
  JSON_MODE=false
  VERBOSE=false
  output=$(log_debug "Debug message" 2>&1)
  assert_equals "" "$output" "log_debug should not show when not verbose"
}

test_json_string_output() {
  source "$HELPERS_PATH"
  JSON_MODE=true
  output=$(json_string "key" "value")
  assert_contains "$output" '"key": "value"' "json_string should format correctly"
}

test_json_number_output() {
  source "$HELPERS_PATH"
  JSON_MODE=true
  output=$(json_number "count" 42)
  assert_contains "$output" '"count": 42' "json_number should format correctly"
}

test_json_bool_output() {
  source "$HELPERS_PATH"
  JSON_MODE=true
  output=$(json_bool "enabled" true)
  assert_contains "$output" '"enabled": true' "json_bool should format correctly"
}

test_json_success_output() {
  source "$HELPERS_PATH"
  JSON_MODE=true
  output=$(json_success '{"test": "data"}')
  assert_contains "$output" '"success": true' "json_success should have success field"
  assert_contains "$output" '"data": {"test": "data"}' "json_success should have data field"
}

test_json_error_output() {
  source "$HELPERS_PATH"
  JSON_MODE=true
  output=$(json_error "ERROR_CODE" "Error message")
  assert_contains "$output" '"success": false' "json_error should have success: false"
  assert_contains "$output" '"code": "ERROR_CODE"' "json_error should have error code"
  assert_contains "$output" '"message": "Error message"' "json_error should have message"
}

test_command_exists_positive() {
  source "$HELPERS_PATH"
  command_exists "bash"
  local result=$?
  assert_equals "0" "$result" "command_exists should return 0 for existing command"
}

test_command_exists_negative() {
  source "$HELPERS_PATH"
  command_exists "nonexistent_command_xyz123"
  local result=$?
  assert_equals "1" "$result" "command_exists should return 1 for non-existing command"
}

test_confirm_with_force() {
  source "$HELPERS_PATH"
  FORCE=true
  confirm "Test confirmation"
  local result=$?
  assert_equals "0" "$result" "confirm should return 0 with --force flag"
}

test_confirm_with_json_mode() {
  source "$HELPERS_PATH"
  JSON_MODE=true
  confirm "Test confirmation"
  local result=$?
  assert_equals "0" "$result" "confirm should return 0 in JSON mode"
}

test_exit_codes_defined() {
  source "$HELPERS_PATH"
  assert_equals "0" "$EXIT_SUCCESS" "EXIT_SUCCESS should be 0"
  assert_equals "1" "$EXIT_GENERAL_ERROR" "EXIT_GENERAL_ERROR should be 1"
  assert_equals "4" "$EXIT_VALIDATION_ERROR" "EXIT_VALIDATION_ERROR should be 4"
  assert_equals "13" "$EXIT_INVALID_STATE" "EXIT_INVALID_STATE should be 13"
}

test_colors_with_no_color_flag() {
  source "$HELPERS_PATH"
  NO_COLOR=true
  setup_colors
  assert_equals "" "$RED" "RED should be empty with NO_COLOR=true"
  assert_equals "" "$GREEN" "GREEN should be empty with NO_COLOR=true"
}

test_json_string_escaping() {
  source "$HELPERS_PATH"
  JSON_MODE=true
  output=$(json_string "key" 'value with "quotes"')
  assert_contains "$output" '\"quotes\"' "json_string should escape double quotes"
}

test_json_array_functions() {
  source "$HELPERS_PATH"
  JSON_MODE=true

  output=$(json_array_start "items")
  assert_contains "$output" '"items": [' "json_array_start should format correctly"

  output=$(json_array_item "item1")
  assert_contains "$output" '"item1",' "json_array_item should format with comma"

  output=$(json_array_item "item2" true)
  assert_not_contains "$output" ',' "json_array_item with last=true should not have comma"

  output=$(json_array_end)
  assert_contains "$output" '],' "json_array_end should close array"
}

test_log_header_formatting() {
  source "$HELPERS_PATH"
  JSON_MODE=false
  output=$(log_header "Test Header")
  assert_contains "$output" "Test Header" "log_header should contain header text"
  assert_contains "$output" "===" "log_header should contain border"
}

# =============================================================================
# Run All Tests
# =============================================================================

echo ""
echo "=========================================="
echo "Shell Helpers Integration Tests"
echo "=========================================="
echo ""

run_test "Helpers file exists" test_helpers_file_exists
run_test "Parse --json flag" test_parse_json_flag
run_test "Parse -j flag" test_parse_short_json_flag
run_test "Parse --no-color flag" test_parse_no_color_flag
run_test "Parse --verbose flag" test_parse_verbose_flag
run_test "Parse -v flag" test_parse_short_verbose_flag
run_test "Parse --force flag" test_parse_force_flag
run_test "Parse -f flag" test_parse_short_force_flag
run_test "Parse multiple flags" test_parse_multiple_flags
run_test "Parse args count" test_parse_args_count
run_test "log_info in human mode" test_log_info_human_mode
run_test "log_info in JSON mode" test_log_info_json_mode
run_test "log_success in human mode" test_log_success_human_mode
run_test "log_warning in human mode" test_log_warning_human_mode
run_test "log_error in human mode" test_log_error_human_mode
run_test "log_debug in verbose mode" test_log_debug_verbose_mode
run_test "log_debug in non-verbose mode" test_log_debug_non_verbose_mode
run_test "json_string output" test_json_string_output
run_test "json_number output" test_json_number_output
run_test "json_bool output" test_json_bool_output
run_test "json_success output" test_json_success_output
run_test "json_error output" test_json_error_output
run_test "command_exists positive" test_command_exists_positive
run_test "command_exists negative" test_command_exists_negative
run_test "confirm with --force" test_confirm_with_force
run_test "confirm in JSON mode" test_confirm_with_json_mode
run_test "Exit codes defined" test_exit_codes_defined
run_test "Colors with --no-color" test_colors_with_no_color_flag
run_test "JSON string escaping" test_json_string_escaping
run_test "JSON array functions" test_json_array_functions
run_test "log_header formatting" test_log_header_formatting

# =============================================================================
# Test Summary
# =============================================================================

echo ""
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo "Total:  $TESTS_RUN"
echo -e "Passed: ${TEST_GREEN}$TESTS_PASSED${TEST_NC}"
echo -e "Failed: ${TEST_RED}$TESTS_FAILED${TEST_NC}"
echo ""

if [ $TESTS_FAILED -gt 0 ]; then
  echo "Failed tests:"
  for test in "${FAILED_TESTS[@]}"; do
    echo -e "  ${TEST_RED}✗${TEST_NC} $test"
  done
  echo ""
  exit 1
else
  echo -e "${TEST_GREEN}All tests passed!${TEST_NC}"
  echo ""
  exit 0
fi
