// Package tui implements the Bubble Tea model for the RevealUI terminal.
package tui

import (
	"fmt"
	"strings"

	tea "charm.land/bubbletea/v2"
	"charm.land/lipgloss/v2"
	"github.com/charmbracelet/ssh"
	gossh "golang.org/x/crypto/ssh"

	"github.com/revealuistudio/revealui/apps/terminal/api"
	"github.com/revealuistudio/revealui/apps/terminal/qr"
)

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

// View represents the current screen.
type View int

const (
	ViewLoading View = iota
	ViewTiers
	ViewCheckout
	ViewLicense
	ViewLinkEmail
	ViewLinkOTP
)

// ---------------------------------------------------------------------------
// Async messages
// ---------------------------------------------------------------------------

type pricingMsg struct{ tiers []Tier }
type lookupMsg struct{ user *api.LookupResponse }
type checkoutMsg struct{ url string }
type linkSentMsg struct{}
type verifiedMsg struct{ user *api.LookupResponse }
type errMsg struct{ err error }

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

// Model is the root Bubble Tea model.
type Model struct {
	session     ssh.Session
	client      *api.Client
	fingerprint string

	view   View
	tiers  []Tier
	cursor int

	selected *Tier
	qrCode   string
	qrURL    string
	license  string

	currentUser *api.LookupResponse
	loading     bool
	loadingMsg  string
	err         error

	// Account linking fields
	emailInput string
	otpInput   string

	width  int
	height int
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

// fallbackTiers returns hardcoded tiers used when the API is unreachable.
func fallbackTiers() []Tier {
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
func NewModel(s ssh.Session, client *api.Client) Model {
	// Extract SSH key fingerprint if available
	fp := ""
	if key := s.PublicKey(); key != nil {
		fp = gossh.FingerprintSHA256(key)
	}

	return Model{
		session:     s,
		client:      client,
		fingerprint: fp,
		view:        ViewLoading,
		tiers:       fallbackTiers(),
		loading:     true,
		loadingMsg:  "Loading pricing…",
		width:       80,
		height:      24,
	}
}

// ---------------------------------------------------------------------------
// Bubble Tea lifecycle
// ---------------------------------------------------------------------------

func (m Model) Init() tea.Cmd {
	cmds := []tea.Cmd{fetchPricingCmd(m.client)}

	// If we have a fingerprint, also look up the user
	if m.fingerprint != "" {
		cmds = append(cmds, lookupCmd(m.client, m.fingerprint))
	}

	return tea.Batch(cmds...)
}

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {

	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		return m, nil

	// -- Async results -------------------------------------------------------

	case pricingMsg:
		if len(msg.tiers) > 0 {
			m.tiers = msg.tiers
		}
		// If still on loading view, transition to tiers
		if m.view == ViewLoading {
			m.view = ViewTiers
			m.loading = false
		}
		return m, nil

	case lookupMsg:
		m.currentUser = msg.user
		return m, nil

	case checkoutMsg:
		m.loading = false
		m.qrURL = msg.url
		// Render QR code for the checkout URL
		rendered, err := qr.Render(msg.url)
		if err == nil {
			m.qrCode = rendered
		}
		return m, nil

	case linkSentMsg:
		m.loading = false
		m.view = ViewLinkOTP
		m.otpInput = ""
		return m, nil

	case verifiedMsg:
		m.loading = false
		m.currentUser = msg.user
		m.view = ViewTiers
		m.emailInput = ""
		m.otpInput = ""
		return m, nil

	case errMsg:
		m.loading = false
		m.err = msg.err
		// If we were on loading, show tiers with fallback data
		if m.view == ViewLoading {
			m.view = ViewTiers
		}
		return m, nil

	// -- Keyboard input ------------------------------------------------------

	case tea.KeyPressMsg:
		// Global quit
		if msg.String() == "ctrl+c" {
			return m, tea.Quit
		}

		// Text input views handle keys differently
		if m.view == ViewLinkEmail {
			return m.updateLinkEmail(msg)
		}
		if m.view == ViewLinkOTP {
			return m.updateLinkOTP(msg)
		}

		// Clear error on any keypress
		if m.err != nil && msg.String() != "q" {
			m.err = nil
			return m, nil
		}

		switch msg.String() {
		case "q":
			return m, tea.Quit

		case "up", "k":
			if m.view == ViewTiers && m.cursor > 0 {
				m.cursor--
			}

		case "down", "j":
			if m.view == ViewTiers && m.cursor < len(m.tiers)-1 {
				m.cursor++
			}

		case "l":
			// Link account — only if not already linked and have a fingerprint
			if m.view == ViewTiers && m.fingerprint != "" && m.currentUser == nil {
				m.view = ViewLinkEmail
				m.emailInput = ""
				m.err = nil
			}

		case "enter":
			if m.view == ViewTiers && m.cursor < len(m.tiers) {
				tier := m.tiers[m.cursor]
				if tier.ID == "free" {
					return m, nil // Free tier — nothing to purchase
				}
				m.selected = &tier
				m.view = ViewCheckout
				m.loading = true
				m.loadingMsg = "Creating checkout session…"
				m.qrCode = ""
				m.qrURL = ""
				return m, createCheckoutCmd(m.client, tier.ID)
			}

		case "esc":
			if m.view != ViewTiers {
				m.view = ViewTiers
				m.selected = nil
				m.loading = false
				m.qrCode = ""
				m.qrURL = ""
			}
		}
	}

	return m, nil
}

// ---------------------------------------------------------------------------
// Text input handlers
// ---------------------------------------------------------------------------

func (m Model) updateLinkEmail(msg tea.KeyPressMsg) (tea.Model, tea.Cmd) {
	switch msg.String() {
	case "esc":
		m.view = ViewTiers
		m.emailInput = ""
		m.err = nil
		return m, nil
	case "enter":
		email := strings.TrimSpace(m.emailInput)
		if email == "" || !strings.Contains(email, "@") {
			m.err = fmt.Errorf("please enter a valid email address")
			return m, nil
		}
		m.loading = true
		m.loadingMsg = "Sending verification code…"
		m.err = nil
		return m, linkSSHKeyCmd(m.client, m.fingerprint, email)
	case "backspace":
		if len(m.emailInput) > 0 {
			m.emailInput = m.emailInput[:len(m.emailInput)-1]
		}
		return m, nil
	default:
		// Only accept printable characters
		if len(msg.String()) == 1 {
			m.emailInput += msg.String()
		}
		return m, nil
	}
}

func (m Model) updateLinkOTP(msg tea.KeyPressMsg) (tea.Model, tea.Cmd) {
	switch msg.String() {
	case "esc":
		m.view = ViewTiers
		m.otpInput = ""
		m.emailInput = ""
		m.err = nil
		return m, nil
	case "enter":
		code := strings.TrimSpace(m.otpInput)
		if len(code) != 6 {
			m.err = fmt.Errorf("please enter the 6-digit code")
			return m, nil
		}
		m.loading = true
		m.loadingMsg = "Verifying…"
		m.err = nil
		return m, verifyOTPCmd(m.client, strings.TrimSpace(m.emailInput), code)
	case "backspace":
		if len(m.otpInput) > 0 {
			m.otpInput = m.otpInput[:len(m.otpInput)-1]
		}
		return m, nil
	default:
		// Only accept digits, max 6
		ch := msg.String()
		if len(ch) == 1 && ch[0] >= '0' && ch[0] <= '9' && len(m.otpInput) < 6 {
			m.otpInput += ch
		}
		return m, nil
	}
}

// ---------------------------------------------------------------------------
// Commands (async API calls)
// ---------------------------------------------------------------------------

func fetchPricingCmd(c *api.Client) tea.Cmd {
	return func() tea.Msg {
		resp, err := c.FetchPricing()
		if err != nil {
			return errMsg{err}
		}

		tiers := make([]Tier, 0, len(resp.Subscriptions))
		for _, t := range resp.Subscriptions {
			tiers = append(tiers, Tier{
				ID:          t.ID,
				Name:        t.Name,
				Price:       t.Price,
				Period:      t.Period,
				Description: t.Description,
				Features:    t.Features,
				Highlighted: t.Highlighted,
			})
		}
		return pricingMsg{tiers}
	}
}

func lookupCmd(c *api.Client, fingerprint string) tea.Cmd {
	return func() tea.Msg {
		user, err := c.LookupByFingerprint(fingerprint)
		if err != nil {
			return errMsg{err}
		}
		return lookupMsg{user}
	}
}

func createCheckoutCmd(c *api.Client, tierID string) tea.Cmd {
	return func() tea.Msg {
		resp, err := c.CreateCheckout(api.CheckoutRequest{
			Tier: tierID,
		})
		if err != nil {
			return errMsg{err}
		}
		return checkoutMsg{resp.URL}
	}
}

func linkSSHKeyCmd(c *api.Client, fingerprint, email string) tea.Cmd {
	return func() tea.Msg {
		err := c.LinkSSHKey(api.LinkSSHKeyRequest{
			Fingerprint: fingerprint,
			Email:       email,
		})
		if err != nil {
			return errMsg{err}
		}
		return linkSentMsg{}
	}
}

func verifyOTPCmd(c *api.Client, email, code string) tea.Cmd {
	return func() tea.Msg {
		user, err := c.VerifyOTP(api.VerifyOTPRequest{
			Email: email,
			Code:  code,
		})
		if err != nil {
			return errMsg{err}
		}
		return verifiedMsg{user}
	}
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

func (m Model) View() tea.View {
	var content string
	switch m.view {
	case ViewLoading:
		content = m.viewLoading()
	case ViewCheckout:
		content = m.viewCheckout()
	case ViewLicense:
		content = m.viewLicense()
	case ViewLinkEmail:
		content = m.viewLinkEmail()
	case ViewLinkOTP:
		content = m.viewLinkOTP()
	default:
		content = m.viewTiers()
	}
	v := tea.NewView(content)
	v.AltScreen = true
	return v
}

// -- Styles ------------------------------------------------------------------

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

	errorStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#EF4444"))

	successStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#10B981")).
			Bold(true)

	highlightBorder = lipgloss.NewStyle().
				Border(lipgloss.RoundedBorder()).
				BorderForeground(lipgloss.Color("#3B82F6")).
				Padding(0, 1)

	badgeStyle = lipgloss.NewStyle().
			Background(lipgloss.Color("#7C3AED")).
			Foreground(lipgloss.Color("#FFFFFF")).
			Padding(0, 1).
			Bold(true)
)

// -- Loading -----------------------------------------------------------------

func (m Model) viewLoading() string {
	s := titleStyle.Render("RevealUI") + "\n\n"
	s += dimStyle.Render("  "+m.loadingMsg) + "\n"
	return s
}

// -- Tier selection ----------------------------------------------------------

func (m Model) viewTiers() string {
	s := titleStyle.Render("RevealUI — Choose Your Plan") + "\n"

	// Show current user info if known
	if m.currentUser != nil {
		s += dimStyle.Render(fmt.Sprintf("  Signed in as %s", m.currentUser.Email))
		if m.currentUser.Tier != "" {
			s += "  " + badgeStyle.Render(strings.ToUpper(m.currentUser.Tier))
		}
		s += "\n"
	}
	s += "\n"

	for i, tier := range m.tiers {
		cursor := "  "
		style := dimStyle
		if i == m.cursor {
			cursor = "> "
			style = selectedStyle
		}

		price := tier.Price
		if price == "" {
			price = "—"
		}

		line := fmt.Sprintf("%s%s %s%s — %s",
			cursor, tier.Name, price, tier.Period, tier.Description)

		// Mark current tier
		if m.currentUser != nil && tier.ID == m.currentUser.Tier {
			line += " (current)"
		}

		if tier.Highlighted && i == m.cursor {
			s += highlightBorder.Render(style.Render(line)) + "\n"
		} else {
			s += style.Render(line) + "\n"
		}
	}

	// Error display
	if m.err != nil {
		s += "\n" + errorStyle.Render("  ⚠ "+m.err.Error())
	}

	if m.fingerprint != "" && m.currentUser == nil {
		s += "\n" + dimStyle.Render("↑/↓ navigate • enter select • l link account • q quit")
	} else {
		s += "\n" + dimStyle.Render("↑/↓ navigate • enter select • q quit")
	}

	if m.fingerprint == "" {
		s += "\n" + dimStyle.Render("Tip: Connect with an SSH key to link your account")
	}

	return s
}

// -- Checkout ----------------------------------------------------------------

func (m Model) viewCheckout() string {
	if m.selected == nil {
		return "No tier selected"
	}

	s := titleStyle.Render(fmt.Sprintf("Upgrade to %s — %s%s",
		m.selected.Name, m.selected.Price, m.selected.Period)) + "\n\n"

	for _, f := range m.selected.Features {
		s += fmt.Sprintf("  ✓ %s\n", f)
	}

	if m.loading {
		s += "\n" + dimStyle.Render("  "+m.loadingMsg)
	} else if m.qrURL != "" {
		s += "\n" + successStyle.Render("  Checkout ready!") + "\n\n"

		if m.qrCode != "" {
			s += m.qrCode + "\n"
		}

		s += fmt.Sprintf("  %s\n", m.qrURL)
		s += "\n" + dimStyle.Render("  Scan the QR code or open the URL in your browser.")
	}

	// Error display
	if m.err != nil {
		s += "\n" + errorStyle.Render("  ⚠ "+m.err.Error())
	}

	s += "\n\n" + dimStyle.Render("esc back • q quit")
	return s
}

// -- Account linking — email ------------------------------------------------

func (m Model) viewLinkEmail() string {
	s := titleStyle.Render("Link Your Account") + "\n\n"
	s += "  Enter the email address associated with your RevealUI account.\n"
	s += "  We'll send a 6-digit verification code.\n\n"

	s += fmt.Sprintf("  Email: %s", m.emailInput)
	if !m.loading {
		s += "█" // cursor
	}
	s += "\n"

	if m.loading {
		s += "\n" + dimStyle.Render("  "+m.loadingMsg)
	}

	if m.err != nil {
		s += "\n" + errorStyle.Render("  ⚠ "+m.err.Error())
	}

	s += "\n\n" + dimStyle.Render("enter submit • esc cancel")
	return s
}

// -- Account linking — OTP -------------------------------------------------

func (m Model) viewLinkOTP() string {
	s := titleStyle.Render("Verify Your Email") + "\n\n"
	s += fmt.Sprintf("  A verification code was sent to %s\n",
		successStyle.Render(strings.TrimSpace(m.emailInput)))
	s += "  Enter the 6-digit code below.\n\n"

	s += fmt.Sprintf("  Code: %s", m.otpInput)
	if !m.loading && len(m.otpInput) < 6 {
		s += "█"
	}
	s += "\n"

	if m.loading {
		s += "\n" + dimStyle.Render("  "+m.loadingMsg)
	}

	if m.err != nil {
		s += "\n" + errorStyle.Render("  ⚠ "+m.err.Error())
	}

	s += "\n\n" + dimStyle.Render("enter verify • esc cancel")
	return s
}

// -- License -----------------------------------------------------------------

func (m Model) viewLicense() string {
	s := titleStyle.Render("License Activated!") + "\n\n"
	if m.license != "" {
		s += fmt.Sprintf("  Key: %s\n", m.license)
	}
	s += "\n" + dimStyle.Render("q quit")
	return s
}
