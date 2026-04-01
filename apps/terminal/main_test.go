package main

import (
	"os"
	"testing"
)

func TestEnvOrDefault_ReturnsEnvValue(t *testing.T) {
	t.Setenv("TEST_ENV_OR_DEFAULT", "custom-value")

	got := envOrDefault("TEST_ENV_OR_DEFAULT", "fallback")
	if got != "custom-value" {
		t.Errorf("envOrDefault() = %q, want %q", got, "custom-value")
	}
}

func TestEnvOrDefault_ReturnsFallbackWhenUnset(t *testing.T) {
	os.Unsetenv("TEST_ENV_OR_DEFAULT_MISSING")

	got := envOrDefault("TEST_ENV_OR_DEFAULT_MISSING", "fallback")
	if got != "fallback" {
		t.Errorf("envOrDefault() = %q, want %q", got, "fallback")
	}
}

func TestEnvOrDefault_ReturnsFallbackWhenEmpty(t *testing.T) {
	t.Setenv("TEST_ENV_OR_DEFAULT_EMPTY", "")

	got := envOrDefault("TEST_ENV_OR_DEFAULT_EMPTY", "fallback")
	if got != "fallback" {
		t.Errorf("envOrDefault() = %q, want %q", got, "fallback")
	}
}

func TestEnvOrDefault_DefaultPortValue(t *testing.T) {
	os.Unsetenv("PORT")

	got := envOrDefault("PORT", "2222")
	if got != "2222" {
		t.Errorf("envOrDefault() = %q, want %q", got, "2222")
	}
}

func TestEnvOrDefault_DefaultHostValue(t *testing.T) {
	os.Unsetenv("HOST")

	got := envOrDefault("HOST", "0.0.0.0")
	if got != "0.0.0.0" {
		t.Errorf("envOrDefault() = %q, want %q", got, "0.0.0.0")
	}
}
