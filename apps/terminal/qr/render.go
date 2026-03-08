// Package qr provides terminal-rendered QR codes using Unicode block characters.
package qr

import (
	"fmt"
	"strings"

	qrcode "github.com/skip2/go-qrcode"
)

// Render generates a QR code string suitable for terminal display.
// Uses Unicode half-block characters for compact rendering.
func Render(url string) (string, error) {
	qr, err := qrcode.New(url, qrcode.Medium)
	if err != nil {
		return "", fmt.Errorf("generate QR code: %w", err)
	}

	bitmap := qr.Bitmap()
	var sb strings.Builder

	// Process two rows at a time using half-block characters
	for y := 0; y < len(bitmap)-1; y += 2 {
		for x := 0; x < len(bitmap[y]); x++ {
			top := bitmap[y][x]
			bottom := bitmap[y+1][x]

			switch {
			case top && bottom:
				sb.WriteRune('\u2588') // Full block
			case top && !bottom:
				sb.WriteRune('\u2580') // Upper half block
			case !top && bottom:
				sb.WriteRune('\u2584') // Lower half block
			default:
				sb.WriteRune(' ')
			}
		}
		sb.WriteRune('\n')
	}

	// Handle odd row count
	if len(bitmap)%2 != 0 {
		lastRow := bitmap[len(bitmap)-1]
		for x := 0; x < len(lastRow); x++ {
			if lastRow[x] {
				sb.WriteRune('\u2580')
			} else {
				sb.WriteRune(' ')
			}
		}
		sb.WriteRune('\n')
	}

	return sb.String(), nil
}
