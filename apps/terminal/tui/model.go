// Package tui implements the Bubble Tea model for the RevealUI terminal.
package tui

import (
	"fmt"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/charmbracelet/ssh"

	"github.com/revealuistudio/revealui/apps/terminal/api"
)

// View represents the current screen.
type View int

const (
	ViewTiers View = iota
	ViewCheckout
	ViewLicense
)

// Model is the root Bubble Tea model.
type Model struct {
	session  ssh.Session
	client   *api.Client
	view     View
	tiers    []Tier
	cursor   int
	selected *Tier
	qrURL    string
	license  string
	err      error
	width    int
	height   int
}

// Tier mirrors the subscription tier data.
type Tier struct {
	ID          string
	Name        string
	Price       string
	Period      string
	Description string
	Features    []string
	Highlighted bool
}

// defaultTiers returns the built-in tier list (mirrors @revealui/contracts/pricing).
func defaultTiers() []Tier {
	return []Tier{
		{
			ID: "free", Name: "Free (OSS)", Price: "$0",
			Description: "Perfect for trying out RevealUI and small projects.",
			Features:    []string{"1 site", "3 users", "Basic sync", "Community support"},
		},
		{
			ID: "pro", Name: "Pro", Price: "$49", Period: "/mo",
			Description: "For software companies building production products.",
			Features:    []string{"5 sites", "25 users", "AI agents", "Stripe payments", "10K tasks/mo"},
			Highlighted: true,
		},
		{
			ID: "max", Name: "Max", Price: "$149", Period: "/mo",
			Description: "AI memory, multi-provider, compliance tooling.",
			Features:    []string{"15 sites", "100 users", "AI memory", "BYOK server-side", "50K tasks/mo"},
		},
		{
			ID: "enterprise", Name: "Forge", Price: "$299", Period: "/mo",
			Description: "Advanced scale and compliance requirements.",
			Features:    []string{"Unlimited sites", "Unlimited users", "SSO/SAML", "White-label", "Unlimited tasks"},
		},
	}
}

// NewModel creates a new TUI model for the given SSH session.
func NewModel(s ssh.Session) Model {
	apiURL := "https://api.revealui.com"
	return Model{
		session: s,
		client:  api.NewClient(apiURL),
		view:    ViewTiers,
		tiers:   defaultTiers(),
		width:   80,
		height:  24,
	}
}

func (m Model) Init() tea.Cmd {
	return nil
}

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		return m, nil

	case tea.KeyMsg:
		switch msg.String() {
		case "q", "ctrl+c":
			return m, tea.Quit
		case "up", "k":
			if m.cursor > 0 {
				m.cursor--
			}
		case "down", "j":
			if m.cursor < len(m.tiers)-1 {
				m.cursor++
			}
		case "enter":
			if m.view == ViewTiers && m.cursor < len(m.tiers) {
				m.selected = &m.tiers[m.cursor]
				if m.selected.ID != "free" {
					m.view = ViewCheckout
				}
			}
		case "esc":
			m.view = ViewTiers
			m.selected = nil
		}
	}

	return m, nil
}

func (m Model) View() string {
	switch m.view {
	case ViewCheckout:
		return m.viewCheckout()
	case ViewLicense:
		return m.viewLicense()
	default:
		return m.viewTiers()
	}
}

var (
	titleStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("#7C3AED")).
			MarginBottom(1)

	selectedStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#3B82F6")).
			Bold(true)

	dimStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#6B7280"))

	highlightBorder = lipgloss.NewStyle().
				Border(lipgloss.RoundedBorder()).
				BorderForeground(lipgloss.Color("#3B82F6")).
				Padding(0, 1)
)

func (m Model) viewTiers() string {
	s := titleStyle.Render("RevealUI — Choose Your Plan") + "\n\n"

	for i, tier := range m.tiers {
		cursor := "  "
		style := dimStyle
		if i == m.cursor {
			cursor = "> "
			style = selectedStyle
		}

		line := fmt.Sprintf("%s%s %s%s — %s",
			cursor, tier.Name, tier.Price, tier.Period, tier.Description)

		if tier.Highlighted && i == m.cursor {
			s += highlightBorder.Render(style.Render(line)) + "\n"
		} else {
			s += style.Render(line) + "\n"
		}
	}

	s += "\n" + dimStyle.Render("↑/↓ navigate • enter select • q quit")
	return s
}

func (m Model) viewCheckout() string {
	if m.selected == nil {
		return "No tier selected"
	}

	s := titleStyle.Render(fmt.Sprintf("Upgrade to %s — %s%s",
		m.selected.Name, m.selected.Price, m.selected.Period)) + "\n\n"

	for _, f := range m.selected.Features {
		s += fmt.Sprintf("  ✓ %s\n", f)
	}

	s += "\n" + dimStyle.Render("Checkout URL and QR code will appear here.")
	s += "\n" + dimStyle.Render("Scan the QR code or open the URL in your browser to complete payment.")
	s += "\n\n" + dimStyle.Render("esc back • q quit")
	return s
}

func (m Model) viewLicense() string {
	s := titleStyle.Render("License Activated!") + "\n\n"
	if m.license != "" {
		s += fmt.Sprintf("  Key: %s\n", m.license)
	}
	s += "\n" + dimStyle.Render("q quit")
	return s
}
