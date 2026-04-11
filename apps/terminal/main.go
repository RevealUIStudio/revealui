// RevealUI Terminal — SSH payment + agent terminal service
//
// Usage:
//   ssh terminal.revealui.com              — payment TUI (default)
//   ssh terminal.revealui.com -t agents    — agent terminal proxy
//
// Mode selection:
//   TERMINAL_MODE=agents env var forces agent mode (no SSH command parsing).
//   Otherwise, if the SSH client sends "agents" as the command, agent mode.
//   Default: payment TUI.
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
	"strings"
	"syscall"

	tea "charm.land/bubbletea/v2"
	"charm.land/wish/v2"
	bm "charm.land/wish/v2/bubbletea"
	"github.com/charmbracelet/ssh"

	"github.com/revealuistudio/revealui/apps/terminal/api"
	"github.com/revealuistudio/revealui/apps/terminal/proxy"
	"github.com/revealuistudio/revealui/apps/terminal/tui"
)

func main() {
	host := envOrDefault("HOST", "0.0.0.0")
	port := envOrDefault("PORT", "2222")
	hostKeyPath := envOrDefault("HOST_KEY_PATH", ".ssh/term_ed25519")
	apiURL := envOrDefault("REVEALUI_API_URL", "https://api.revealui.com")
	apiToken := os.Getenv("REVEALUI_API_TOKEN") // optional — empty for public-only
	defaultMode := envOrDefault("TERMINAL_MODE", "tui")

	client := api.NewClient(apiURL, apiToken)
	termProxy := proxy.New(client, apiURL)

	s, err := wish.NewServer(
		wish.WithAddress(fmt.Sprintf("%s:%s", host, port)),
		wish.WithHostKeyPath(hostKeyPath),
		wish.WithPublicKeyAuth(func(_ ssh.Context, _ ssh.PublicKey) bool {
			return true // Accept all keys — fingerprint used for account lookup, not auth
		}),
		wish.WithMiddleware(
			// Route to agent proxy or payment TUI based on SSH command
			func(next ssh.Handler) ssh.Handler {
				return func(s ssh.Session) {
					cmd := strings.Join(s.Command(), " ")
					if strings.TrimSpace(cmd) == "agents" || defaultMode == "agents" {
						termProxy.Handle(s)
						return
					}
					next(s)
				}
			},
			bm.Middleware(func(s ssh.Session) (tea.Model, []tea.ProgramOption) {
				return tui.NewModel(s, client), nil
			}),
		),
	)
	if err != nil {
		log.Fatalf("could not create server: %v", err)
	}

	done := make(chan os.Signal, 1)
	signal.Notify(done, os.Interrupt, syscall.SIGTERM)

	log.Printf("RevealUI Terminal listening on %s:%s (mode: %s)", host, port, defaultMode)
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
