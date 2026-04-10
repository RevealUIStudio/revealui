// Package proxy bridges SSH sessions to the RevealUI API's WebSocket terminal.
//
// After SSH authentication, the proxy:
//  1. Lists active terminal sessions via GET /api/terminal/sessions
//  2. Lets the user select a session or create a new one
//  3. Connects to WS /api/terminal/ws/:id
//  4. Pipes SSH I/O ↔ WebSocket I/O bidirectionally
//
// This enables controlling Claude Code agents from any SSH client (iPhone, iPad, etc.).
package proxy

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"

	"github.com/charmbracelet/ssh"
	"github.com/gorilla/websocket"

	"github.com/revealuistudio/revealui/apps/terminal/api"
)

// SessionInfo mirrors the daemon's AgentSessionInfo for display.
type SessionInfo struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Backend string `json:"backend"`
	Status  string `json:"status"`
	IsPty   bool   `json:"isPty"`
}

// Proxy handles the SSH-to-WebSocket terminal bridge.
type Proxy struct {
	client *api.Client
	apiURL string
}

// New creates a new terminal proxy.
func New(client *api.Client, apiURL string) *Proxy {
	return &Proxy{client: client, apiURL: apiURL}
}

// Handle is the SSH session handler. It presents a session selector,
// then bridges the SSH session to the WebSocket terminal.
func (p *Proxy) Handle(s ssh.Session) {
	// Fetch available sessions
	sessions, err := p.listSessions()
	if err != nil {
		fmt.Fprintf(s, "\r\n\033[31mError: %s\033[0m\r\n", err)
		fmt.Fprintf(s, "\033[90mFalling back to payment TUI...\033[0m\r\n")
		return
	}

	// Show session picker
	sessionID, err := p.pickSession(s, sessions)
	if err != nil {
		if err == io.EOF {
			return // user disconnected
		}
		fmt.Fprintf(s, "\r\n\033[31mError: %s\033[0m\r\n", err)
		return
	}

	// Connect to WebSocket and bridge
	if err := p.bridge(s, sessionID); err != nil {
		fmt.Fprintf(s, "\r\n\033[31mConnection lost: %s\033[0m\r\n", err)
	}
}

// listSessions fetches active PTY sessions from the API.
func (p *Proxy) listSessions() ([]SessionInfo, error) {
	endpoint := fmt.Sprintf("%s/api/terminal/sessions", p.apiURL)
	resp, err := p.client.HTTPClient().Get(endpoint)
	if err != nil {
		return nil, fmt.Errorf("daemon unreachable: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API returned %d", resp.StatusCode)
	}

	var sessions []SessionInfo
	if err := json.NewDecoder(resp.Body).Decode(&sessions); err != nil {
		return nil, fmt.Errorf("decode sessions: %w", err)
	}
	return sessions, nil
}

// spawnSession creates a new Claude Code session via the API.
func (p *Proxy) spawnSession(name string) (string, error) {
	body := fmt.Sprintf(`{"name":"%s","cols":120,"rows":30}`, name)
	endpoint := fmt.Sprintf("%s/api/terminal/sessions", p.apiURL)

	resp, err := p.client.HTTPClient().Post(endpoint, "application/json", strings.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("spawn failed: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		SessionID string `json:"sessionId"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("decode spawn response: %w", err)
	}
	return result.SessionID, nil
}

// pickSession shows a text-based session selector.
func (p *Proxy) pickSession(s ssh.Session, sessions []SessionInfo) (string, error) {
	fmt.Fprintf(s, "\033[1;33mRevealUI Terminal — Agent Sessions\033[0m\r\n\r\n")

	// Filter to PTY sessions only
	ptySessions := make([]SessionInfo, 0)
	for _, sess := range sessions {
		if sess.IsPty && sess.Status == "running" {
			ptySessions = append(ptySessions, sess)
		}
	}

	if len(ptySessions) > 0 {
		fmt.Fprintf(s, "  \033[1mActive sessions:\033[0m\r\n")
		for i, sess := range ptySessions {
			fmt.Fprintf(s, "    \033[36m%d)\033[0m %s \033[90m(%s)\033[0m\r\n",
				i+1, sess.Name, sess.ID[:8])
		}
		fmt.Fprintf(s, "\r\n")
	} else {
		fmt.Fprintf(s, "  \033[90mNo active sessions.\033[0m\r\n\r\n")
	}

	fmt.Fprintf(s, "  \033[36mn)\033[0m New agent session\r\n")
	fmt.Fprintf(s, "  \033[36mq)\033[0m Quit\r\n")
	fmt.Fprintf(s, "\r\n  Choice: ")

	// Read single character
	buf := make([]byte, 64)
	n, err := s.Read(buf)
	if err != nil {
		return "", err
	}
	choice := strings.TrimSpace(string(buf[:n]))
	fmt.Fprintf(s, "%s\r\n", choice)

	switch choice {
	case "q":
		return "", io.EOF
	case "n":
		fmt.Fprintf(s, "\r\n  \033[90mSpawning new agent...\033[0m\r\n")
		sessionID, err := p.spawnSession(fmt.Sprintf("ssh-%d", len(sessions)+1))
		if err != nil {
			return "", err
		}
		fmt.Fprintf(s, "  \033[32mSession created: %s\033[0m\r\n\r\n", sessionID[:8])
		return sessionID, nil
	default:
		// Try to parse as session index
		idx := 0
		if _, err := fmt.Sscanf(choice, "%d", &idx); err == nil && idx >= 1 && idx <= len(ptySessions) {
			return ptySessions[idx-1].ID, nil
		}
		return "", fmt.Errorf("invalid choice: %s", choice)
	}
}

// bridge connects the SSH session to the WebSocket terminal and pipes I/O.
func (p *Proxy) bridge(s ssh.Session, sessionID string) error {
	// Build WebSocket URL
	wsURL := strings.Replace(p.apiURL, "https://", "wss://", 1)
	wsURL = strings.Replace(wsURL, "http://", "ws://", 1)
	wsURL = fmt.Sprintf("%s/api/terminal/ws/%s", wsURL, sessionID)

	fmt.Fprintf(s, "  \033[90mConnecting to %s...\033[0m\r\n", sessionID[:8])

	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		return fmt.Errorf("WebSocket dial failed: %w", err)
	}
	defer conn.Close()

	fmt.Fprintf(s, "  \033[32mConnected.\033[0m Press \033[1mCtrl+]\033[0m to detach.\r\n\r\n")

	var wg sync.WaitGroup
	done := make(chan struct{})

	// SSH → WebSocket (user input)
	wg.Add(1)
	go func() {
		defer wg.Done()
		buf := make([]byte, 4096)
		for {
			n, err := s.Read(buf)
			if err != nil {
				close(done)
				return
			}
			data := buf[:n]

			// Ctrl+] (0x1D) = detach
			for _, b := range data {
				if b == 0x1D {
					close(done)
					return
				}
			}

			msg := map[string]interface{}{
				"type": "input",
				"data": string(data),
			}
			if err := conn.WriteJSON(msg); err != nil {
				close(done)
				return
			}
		}
	}()

	// WebSocket → SSH (terminal output)
	wg.Add(1)
	go func() {
		defer wg.Done()
		for {
			select {
			case <-done:
				return
			default:
			}

			_, message, err := conn.ReadMessage()
			if err != nil {
				select {
				case <-done:
				default:
					close(done)
				}
				return
			}

			var msg struct {
				Type    string `json:"type"`
				Data    string `json:"data"`
				Code    *int   `json:"code"`
				Message string `json:"message"`
			}
			if err := json.Unmarshal(message, &msg); err != nil {
				continue
			}

			switch msg.Type {
			case "output":
				s.Write([]byte(msg.Data))
			case "exit":
				if msg.Code != nil {
					fmt.Fprintf(s, "\r\n\033[90mSession exited (code %d)\033[0m\r\n", *msg.Code)
				}
				return
			case "error":
				fmt.Fprintf(s, "\r\n\033[31mError: %s\033[0m\r\n", msg.Message)
			}
		}
	}()

	// Send initial resize
	pty, winCh, ok := s.Pty()
	if ok {
		msg := map[string]interface{}{
			"type": "resize",
			"cols": pty.Window.Width,
			"rows": pty.Window.Height,
		}
		conn.WriteJSON(msg)

		// Forward window size changes
		go func() {
			for win := range winCh {
				select {
				case <-done:
					return
				default:
				}
				msg := map[string]interface{}{
					"type": "resize",
					"cols": win.Width,
					"rows": win.Height,
				}
				conn.WriteJSON(msg)
			}
		}()
	}

	<-done
	wg.Wait()
	return nil
}
