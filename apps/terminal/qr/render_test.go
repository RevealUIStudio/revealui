package qr

import (
	"strings"
	"testing"
)

func TestRender_ProducesOutput(t *testing.T) {
	result, err := Render("https://example.com")
	if err != nil {
		t.Fatalf("Render() error: %v", err)
	}
	if result == "" {
		t.Fatal("Render() returned empty string")
	}
}

func TestRender_ContainsBlockCharacters(t *testing.T) {
	result, err := Render("https://example.com")
	if err != nil {
		t.Fatalf("Render() error: %v", err)
	}

	// QR codes rendered with half-block characters should contain at least
	// one of: full block, upper half block, or lower half block
	hasBlock := strings.ContainsRune(result, '\u2588') ||
		strings.ContainsRune(result, '\u2580') ||
		strings.ContainsRune(result, '\u2584')

	if !hasBlock {
		t.Error("Render() output contains no Unicode block characters")
	}
}

func TestRender_ContainsNewlines(t *testing.T) {
	result, err := Render("https://example.com")
	if err != nil {
		t.Fatalf("Render() error: %v", err)
	}

	lines := strings.Split(result, "\n")
	// QR codes have multiple rows; even the smallest (version 1) has 21 modules,
	// rendered 2 rows at a time = at least 10 lines
	if len(lines) < 5 {
		t.Errorf("Render() output has %d lines, expected at least 5", len(lines))
	}
}

func TestRender_DifferentURLsProduceDifferentOutput(t *testing.T) {
	result1, err := Render("https://example.com/a")
	if err != nil {
		t.Fatalf("Render(a) error: %v", err)
	}

	result2, err := Render("https://example.com/b")
	if err != nil {
		t.Fatalf("Render(b) error: %v", err)
	}

	if result1 == result2 {
		t.Error("different URLs should produce different QR codes")
	}
}

func TestRender_EmptyURL_ReturnsError(t *testing.T) {
	_, err := Render("")
	if err == nil {
		t.Fatal("Render('') should return an error for empty input")
	}
}

func TestRender_LongURL(t *testing.T) {
	// QR codes can encode up to ~4000 alphanumeric characters at medium ECC
	longURL := "https://checkout.stripe.com/" + strings.Repeat("abcdefghij", 20)
	result, err := Render(longURL)
	if err != nil {
		t.Fatalf("Render(long URL) error: %v", err)
	}
	if result == "" {
		t.Error("Render(long URL) returned empty string")
	}
}

func TestRender_ConsistentForSameInput(t *testing.T) {
	url := "https://revealui.com/checkout"
	result1, err := Render(url)
	if err != nil {
		t.Fatalf("Render() first call error: %v", err)
	}
	result2, err := Render(url)
	if err != nil {
		t.Fatalf("Render() second call error: %v", err)
	}
	if result1 != result2 {
		t.Error("same URL should produce same QR code output")
	}
}

func TestRender_LinesHaveConsistentWidth(t *testing.T) {
	result, err := Render("https://example.com")
	if err != nil {
		t.Fatalf("Render() error: %v", err)
	}

	lines := strings.Split(strings.TrimRight(result, "\n"), "\n")
	if len(lines) == 0 {
		t.Fatal("no lines in output")
	}

	// All lines should be the same width (bitmap is square)
	width := len([]rune(lines[0]))
	for i, line := range lines {
		lineWidth := len([]rune(line))
		if lineWidth != width {
			t.Errorf("line %d has width %d, expected %d", i, lineWidth, width)
		}
	}
}
