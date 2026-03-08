// RevealUI Terminal — SSH payment service
//
// Usage: ssh terminal.revealui.com
//
// Presents an interactive TUI for browsing tiers, purchasing licenses,
// and managing agent credits — all from the terminal.
//
// Built with the Charm ecosystem:
//   - Wish (SSH server)
//   - Bubble Tea (TUI framework)
//   - Lip Gloss (styling)
//
// Deploy: Fly.io or VPS (persistent TCP for SSH, not Vercel).
package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/ssh"
	"github.com/charmbracelet/wish"
	bm "github.com/charmbracelet/wish/bubbletea"

	"github.com/revealuistudio/revealui/apps/terminal/tui"
)

func main() {
	host := envOrDefault("HOST", "0.0.0.0")
	port := envOrDefault("PORT", "2222")
	hostKeyPath := envOrDefault("HOST_KEY_PATH", ".ssh/term_ed25519")

	s, err := wish.NewServer(
		wish.WithAddress(fmt.Sprintf("%s:%s", host, port)),
		wish.WithHostKeyPath(hostKeyPath),
		wish.WithMiddleware(
			bm.Middleware(func(s ssh.Session) (tea.Model, []tea.ProgramOption) {
				return tui.NewModel(s), []tea.ProgramOption{tea.WithAltScreen()}
			}),
		),
	)
	if err != nil {
		log.Fatalf("could not create server: %v", err)
	}

	done := make(chan os.Signal, 1)
	signal.Notify(done, os.Interrupt, syscall.SIGTERM)

	log.Printf("RevealUI Terminal listening on %s:%s", host, port)
	go func() {
		if err := s.ListenAndServe(); err != nil {
			log.Fatalf("server error: %v", err)
		}
	}()

	<-done
	log.Println("shutting down...")
	ctx, cancel := context.WithTimeout(context.Background(), 5_000_000_000) // 5s
	defer cancel()
	if err := s.Shutdown(ctx); err != nil {
		log.Fatalf("shutdown error: %v", err)
	}
}

func envOrDefault(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
