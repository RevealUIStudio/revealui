package tui

import (
	"testing"

	"github.com/revealuistudio/revealui/apps/terminal/api"
)

// ---------------------------------------------------------------------------
// fallbackTiers
// ---------------------------------------------------------------------------

func TestFallbackTiers_ReturnsFourTiers(t *testing.T) {
	tiers := fallbackTiers()
	if len(tiers) != 4 {
		t.Fatalf("fallbackTiers() returned %d tiers, want 4", len(tiers))
	}
}

func TestFallbackTiers_IDs(t *testing.T) {
	tiers := fallbackTiers()
	expected := []string{"free", "pro", "max", "enterprise"}
	for i, want := range expected {
		if tiers[i].ID != want {
			t.Errorf("tiers[%d].ID = %q, want %q", i, tiers[i].ID, want)
		}
	}
}

func TestFallbackTiers_FreeHasNoPrice(t *testing.T) {
	tiers := fallbackTiers()
	free := tiers[0]
	if free.Price != "$0" {
		t.Errorf("free tier Price = %q, want %q", free.Price, "$0")
	}
	if free.Period != "" {
		t.Errorf("free tier Period = %q, want empty", free.Period)
	}
}

func TestFallbackTiers_ProIsHighlighted(t *testing.T) {
	tiers := fallbackTiers()
	for _, tier := range tiers {
		if tier.ID == "pro" && !tier.Highlighted {
			t.Error("pro tier should be highlighted")
		}
		if tier.ID != "pro" && tier.Highlighted {
			t.Errorf("tier %q should not be highlighted", tier.ID)
		}
	}
}

func TestFallbackTiers_AllHaveFeatures(t *testing.T) {
	tiers := fallbackTiers()
	for _, tier := range tiers {
		if len(tier.Features) == 0 {
			t.Errorf("tier %q has no features", tier.ID)
		}
	}
}

func TestFallbackTiers_AllHaveDescription(t *testing.T) {
	tiers := fallbackTiers()
	for _, tier := range tiers {
		if tier.Description == "" {
			t.Errorf("tier %q has empty description", tier.ID)
		}
	}
}

func TestFallbackTiers_PaidTiersHavePeriod(t *testing.T) {
	tiers := fallbackTiers()
	for _, tier := range tiers {
		if tier.ID != "free" && tier.Period == "" {
			t.Errorf("paid tier %q has no period", tier.ID)
		}
	}
}

func TestFallbackTiers_Names(t *testing.T) {
	tiers := fallbackTiers()
	expected := []string{"Free (OSS)", "Pro", "Max", "Forge"}
	for i, want := range expected {
		if tiers[i].Name != want {
			t.Errorf("tiers[%d].Name = %q, want %q", i, tiers[i].Name, want)
		}
	}
}

// ---------------------------------------------------------------------------
// View enum values
// ---------------------------------------------------------------------------

func TestView_Constants(t *testing.T) {
	// Ensure the view constants have expected iota values
	if ViewLoading != 0 {
		t.Errorf("ViewLoading = %d, want 0", ViewLoading)
	}
	if ViewTiers != 1 {
		t.Errorf("ViewTiers = %d, want 1", ViewTiers)
	}
	if ViewCheckout != 2 {
		t.Errorf("ViewCheckout = %d, want 2", ViewCheckout)
	}
	if ViewLicense != 3 {
		t.Errorf("ViewLicense = %d, want 3", ViewLicense)
	}
	if ViewLinkEmail != 4 {
		t.Errorf("ViewLinkEmail = %d, want 4", ViewLinkEmail)
	}
	if ViewLinkOTP != 5 {
		t.Errorf("ViewLinkOTP = %d, want 5", ViewLinkOTP)
	}
}

// ---------------------------------------------------------------------------
// Tier struct fields
// ---------------------------------------------------------------------------

func TestTier_FieldValues(t *testing.T) {
	tier := Tier{
		ID:          "test",
		Name:        "Test Tier",
		Price:       "$99",
		Period:      "/mo",
		Description: "A test tier",
		Features:    []string{"feature1", "feature2"},
		Highlighted: true,
	}

	if tier.ID != "test" {
		t.Errorf("ID = %q, want %q", tier.ID, "test")
	}
	if tier.Name != "Test Tier" {
		t.Errorf("Name = %q, want %q", tier.Name, "Test Tier")
	}
	if tier.Price != "$99" {
		t.Errorf("Price = %q, want %q", tier.Price, "$99")
	}
	if tier.Period != "/mo" {
		t.Errorf("Period = %q, want %q", tier.Period, "/mo")
	}
	if tier.Description != "A test tier" {
		t.Errorf("Description = %q, want %q", tier.Description, "A test tier")
	}
	if len(tier.Features) != 2 {
		t.Errorf("Features length = %d, want 2", len(tier.Features))
	}
	if !tier.Highlighted {
		t.Error("Highlighted = false, want true")
	}
}

// ---------------------------------------------------------------------------
// Model initial state (without SSH session — testing defaults)
// ---------------------------------------------------------------------------

func TestModel_DefaultState(t *testing.T) {
	// Create a model with nil session and a real client to test default fields.
	// We cannot create a real ssh.Session in unit tests, so we test the struct
	// fields that don't depend on the session.
	client := api.NewClient("https://api.example.com", "")

	m := Model{
		client:     client,
		view:       ViewLoading,
		tiers:      fallbackTiers(),
		loading:    true,
		loadingMsg: "Loading pricing…",
		width:      80,
		height:     24,
	}

	if m.view != ViewLoading {
		t.Errorf("view = %d, want ViewLoading (%d)", m.view, ViewLoading)
	}
	if !m.loading {
		t.Error("loading = false, want true")
	}
	if m.loadingMsg != "Loading pricing…" {
		t.Errorf("loadingMsg = %q, want %q", m.loadingMsg, "Loading pricing…")
	}
	if m.width != 80 {
		t.Errorf("width = %d, want 80", m.width)
	}
	if m.height != 24 {
		t.Errorf("height = %d, want 24", m.height)
	}
	if len(m.tiers) != 4 {
		t.Errorf("tiers length = %d, want 4", len(m.tiers))
	}
	if m.cursor != 0 {
		t.Errorf("cursor = %d, want 0", m.cursor)
	}
	if m.selected != nil {
		t.Error("selected should be nil")
	}
	if m.currentUser != nil {
		t.Error("currentUser should be nil")
	}
	if m.err != nil {
		t.Errorf("err should be nil, got %v", m.err)
	}
	if m.fingerprint != "" {
		t.Errorf("fingerprint = %q, want empty", m.fingerprint)
	}
	if m.emailInput != "" {
		t.Errorf("emailInput = %q, want empty", m.emailInput)
	}
	if m.otpInput != "" {
		t.Errorf("otpInput = %q, want empty", m.otpInput)
	}
}

// ---------------------------------------------------------------------------
// Message types — verify they carry the right data
// ---------------------------------------------------------------------------

func TestPricingMsg_CarriesTiers(t *testing.T) {
	msg := pricingMsg{tiers: []Tier{
		{ID: "free", Name: "Free"},
		{ID: "pro", Name: "Pro"},
	}}
	if len(msg.tiers) != 2 {
		t.Errorf("pricingMsg.tiers length = %d, want 2", len(msg.tiers))
	}
}

func TestLookupMsg_CarriesUser(t *testing.T) {
	msg := lookupMsg{user: &api.LookupResponse{
		Success: true,
		UserID:  "user_1",
		Email:   "test@example.com",
		Tier:    "pro",
	}}
	if msg.user.UserID != "user_1" {
		t.Errorf("lookupMsg.user.UserID = %q, want %q", msg.user.UserID, "user_1")
	}
}

func TestCheckoutMsg_CarriesURL(t *testing.T) {
	msg := checkoutMsg{url: "https://checkout.stripe.com/sess_123"}
	if msg.url != "https://checkout.stripe.com/sess_123" {
		t.Errorf("checkoutMsg.url = %q, want checkout URL", msg.url)
	}
}

func TestErrMsg_CarriesError(t *testing.T) {
	msg := errMsg{err: nil}
	if msg.err != nil {
		t.Errorf("errMsg.err = %v, want nil", msg.err)
	}
}

func TestLookupMsg_NilUser(t *testing.T) {
	msg := lookupMsg{user: nil}
	if msg.user != nil {
		t.Error("lookupMsg.user should be nil")
	}
}
