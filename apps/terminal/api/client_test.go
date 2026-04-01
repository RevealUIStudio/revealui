package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// ---------------------------------------------------------------------------
// NewClient
// ---------------------------------------------------------------------------

func TestNewClient_SetsBaseURL(t *testing.T) {
	c := NewClient("https://api.example.com", "tok_123")
	if c.baseURL != "https://api.example.com" {
		t.Errorf("baseURL = %q, want %q", c.baseURL, "https://api.example.com")
	}
}

func TestNewClient_SetsServiceToken(t *testing.T) {
	c := NewClient("https://api.example.com", "tok_123")
	if c.serviceToken != "tok_123" {
		t.Errorf("serviceToken = %q, want %q", c.serviceToken, "tok_123")
	}
}

func TestNewClient_EmptyToken(t *testing.T) {
	c := NewClient("https://api.example.com", "")
	if c.serviceToken != "" {
		t.Errorf("serviceToken = %q, want empty", c.serviceToken)
	}
}

func TestNewClient_HTTPClientNotNil(t *testing.T) {
	c := NewClient("https://api.example.com", "")
	if c.httpClient == nil {
		t.Error("httpClient is nil")
	}
}

func TestNewClient_HTTPClientTimeout(t *testing.T) {
	c := NewClient("https://api.example.com", "")
	if c.httpClient.Timeout.Seconds() != 30 {
		t.Errorf("httpClient.Timeout = %v, want 30s", c.httpClient.Timeout)
	}
}

// ---------------------------------------------------------------------------
// FetchPricing
// ---------------------------------------------------------------------------

func TestFetchPricing_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/pricing" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		if r.Method != http.MethodGet {
			t.Errorf("unexpected method: %s", r.Method)
		}

		resp := PricingResponse{
			Subscriptions: []PricingTier{
				{
					ID:          "pro",
					Name:        "Pro",
					Price:       "$49",
					Period:      "/mo",
					Description: "For production use",
					Features:    []string{"5 sites", "25 users"},
					Highlighted: true,
				},
			},
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	c := NewClient(server.URL, "")
	result, err := c.FetchPricing()
	if err != nil {
		t.Fatalf("FetchPricing() error: %v", err)
	}
	if len(result.Subscriptions) != 1 {
		t.Fatalf("got %d subscriptions, want 1", len(result.Subscriptions))
	}

	tier := result.Subscriptions[0]
	if tier.ID != "pro" {
		t.Errorf("tier.ID = %q, want %q", tier.ID, "pro")
	}
	if tier.Name != "Pro" {
		t.Errorf("tier.Name = %q, want %q", tier.Name, "Pro")
	}
	if tier.Price != "$49" {
		t.Errorf("tier.Price = %q, want %q", tier.Price, "$49")
	}
	if tier.Period != "/mo" {
		t.Errorf("tier.Period = %q, want %q", tier.Period, "/mo")
	}
	if !tier.Highlighted {
		t.Error("tier.Highlighted = false, want true")
	}
	if len(tier.Features) != 2 {
		t.Errorf("got %d features, want 2", len(tier.Features))
	}
}

func TestFetchPricing_ServerError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	c := NewClient(server.URL, "")
	_, err := c.FetchPricing()
	if err == nil {
		t.Fatal("FetchPricing() expected error for 500 response")
	}
}

func TestFetchPricing_InvalidJSON(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte("not json"))
	}))
	defer server.Close()

	c := NewClient(server.URL, "")
	_, err := c.FetchPricing()
	if err == nil {
		t.Fatal("FetchPricing() expected error for invalid JSON")
	}
}

func TestFetchPricing_EmptySubscriptions(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(PricingResponse{Subscriptions: []PricingTier{}})
	}))
	defer server.Close()

	c := NewClient(server.URL, "")
	result, err := c.FetchPricing()
	if err != nil {
		t.Fatalf("FetchPricing() error: %v", err)
	}
	if len(result.Subscriptions) != 0 {
		t.Errorf("got %d subscriptions, want 0", len(result.Subscriptions))
	}
}

func TestFetchPricing_ConnectionRefused(t *testing.T) {
	c := NewClient("http://127.0.0.1:1", "") // nothing listening
	_, err := c.FetchPricing()
	if err == nil {
		t.Fatal("FetchPricing() expected error for connection refused")
	}
}

// ---------------------------------------------------------------------------
// LookupByFingerprint
// ---------------------------------------------------------------------------

func TestLookupByFingerprint_Found(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/terminal-auth/lookup" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		fp := r.URL.Query().Get("fingerprint")
		if fp != "SHA256:abc123" {
			t.Errorf("fingerprint = %q, want %q", fp, "SHA256:abc123")
		}
		// Verify auth header is set
		auth := r.Header.Get("Authorization")
		if auth != "Bearer tok_test" {
			t.Errorf("Authorization = %q, want %q", auth, "Bearer tok_test")
		}

		resp := LookupResponse{
			Success: true,
			UserID:  "user_1",
			Email:   "test@example.com",
			Tier:    "pro",
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	c := NewClient(server.URL, "tok_test")
	result, err := c.LookupByFingerprint("SHA256:abc123")
	if err != nil {
		t.Fatalf("LookupByFingerprint() error: %v", err)
	}
	if result == nil {
		t.Fatal("LookupByFingerprint() returned nil")
	}
	if result.UserID != "user_1" {
		t.Errorf("UserID = %q, want %q", result.UserID, "user_1")
	}
	if result.Email != "test@example.com" {
		t.Errorf("Email = %q, want %q", result.Email, "test@example.com")
	}
	if result.Tier != "pro" {
		t.Errorf("Tier = %q, want %q", result.Tier, "pro")
	}
}

func TestLookupByFingerprint_NotFound(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	c := NewClient(server.URL, "tok_test")
	result, err := c.LookupByFingerprint("SHA256:unknown")
	if err != nil {
		t.Fatalf("LookupByFingerprint() error: %v", err)
	}
	if result != nil {
		t.Errorf("expected nil for unknown fingerprint, got %+v", result)
	}
}

func TestLookupByFingerprint_ServerError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	c := NewClient(server.URL, "tok_test")
	_, err := c.LookupByFingerprint("SHA256:abc123")
	if err == nil {
		t.Fatal("expected error for 500 response")
	}
}

func TestLookupByFingerprint_NoToken(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify no auth header when token is empty
		auth := r.Header.Get("Authorization")
		if auth != "" {
			t.Errorf("Authorization should be empty, got %q", auth)
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	c := NewClient(server.URL, "")
	_, _ = c.LookupByFingerprint("SHA256:abc123")
}

func TestLookupByFingerprint_URLEncodes(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fp := r.URL.Query().Get("fingerprint")
		if fp != "SHA256:abc+def/ghi" {
			t.Errorf("fingerprint = %q, want %q", fp, "SHA256:abc+def/ghi")
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	c := NewClient(server.URL, "")
	_, _ = c.LookupByFingerprint("SHA256:abc+def/ghi")
}

// ---------------------------------------------------------------------------
// CreateCheckout
// ---------------------------------------------------------------------------

func TestCreateCheckout_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/billing/checkout" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		if r.Method != http.MethodPost {
			t.Errorf("unexpected method: %s", r.Method)
		}
		if ct := r.Header.Get("Content-Type"); ct != "application/json" {
			t.Errorf("Content-Type = %q, want application/json", ct)
		}

		var req CheckoutRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decode request body: %v", err)
		}
		if req.Tier != "pro" {
			t.Errorf("req.Tier = %q, want %q", req.Tier, "pro")
		}

		resp := CheckoutResponse{URL: "https://checkout.stripe.com/session_123"}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	c := NewClient(server.URL, "tok_test")
	result, err := c.CreateCheckout(CheckoutRequest{Tier: "pro"})
	if err != nil {
		t.Fatalf("CreateCheckout() error: %v", err)
	}
	if result.URL != "https://checkout.stripe.com/session_123" {
		t.Errorf("URL = %q, want checkout URL", result.URL)
	}
}

func TestCreateCheckout_ErrorInResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		resp := CheckoutResponse{Error: "tier not found"}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	c := NewClient(server.URL, "tok_test")
	_, err := c.CreateCheckout(CheckoutRequest{Tier: "nonexistent"})
	if err == nil {
		t.Fatal("expected error when response contains error field")
	}
}

func TestCreateCheckout_ServerError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("internal error"))
	}))
	defer server.Close()

	c := NewClient(server.URL, "tok_test")
	_, err := c.CreateCheckout(CheckoutRequest{Tier: "pro"})
	if err == nil {
		t.Fatal("expected error for 500 response")
	}
}

// ---------------------------------------------------------------------------
// LinkSSHKey
// ---------------------------------------------------------------------------

func TestLinkSSHKey_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/terminal-auth/link" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		if r.Method != http.MethodPost {
			t.Errorf("unexpected method: %s", r.Method)
		}

		var req LinkSSHKeyRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decode request body: %v", err)
		}
		if req.Fingerprint != "SHA256:abc123" {
			t.Errorf("req.Fingerprint = %q, want %q", req.Fingerprint, "SHA256:abc123")
		}
		if req.Email != "test@example.com" {
			t.Errorf("req.Email = %q, want %q", req.Email, "test@example.com")
		}

		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	c := NewClient(server.URL, "tok_test")
	err := c.LinkSSHKey(LinkSSHKeyRequest{
		Fingerprint: "SHA256:abc123",
		Email:       "test@example.com",
	})
	if err != nil {
		t.Fatalf("LinkSSHKey() error: %v", err)
	}
}

func TestLinkSSHKey_Conflict(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusConflict)
	}))
	defer server.Close()

	c := NewClient(server.URL, "tok_test")
	err := c.LinkSSHKey(LinkSSHKeyRequest{
		Fingerprint: "SHA256:already-linked",
		Email:       "test@example.com",
	})
	if err == nil {
		t.Fatal("expected error for 409 Conflict")
	}
}

func TestLinkSSHKey_ServerError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	c := NewClient(server.URL, "tok_test")
	err := c.LinkSSHKey(LinkSSHKeyRequest{
		Fingerprint: "SHA256:abc123",
		Email:       "test@example.com",
	})
	if err == nil {
		t.Fatal("expected error for 500 response")
	}
}

// ---------------------------------------------------------------------------
// VerifyOTP
// ---------------------------------------------------------------------------

func TestVerifyOTP_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/terminal-auth/verify" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}

		var req VerifyOTPRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decode request body: %v", err)
		}
		if req.Email != "test@example.com" {
			t.Errorf("req.Email = %q, want %q", req.Email, "test@example.com")
		}
		if req.Code != "123456" {
			t.Errorf("req.Code = %q, want %q", req.Code, "123456")
		}

		resp := LookupResponse{
			Success: true,
			UserID:  "user_1",
			Email:   "test@example.com",
			Tier:    "pro",
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	c := NewClient(server.URL, "tok_test")
	result, err := c.VerifyOTP(VerifyOTPRequest{
		Email: "test@example.com",
		Code:  "123456",
	})
	if err != nil {
		t.Fatalf("VerifyOTP() error: %v", err)
	}
	if result.UserID != "user_1" {
		t.Errorf("UserID = %q, want %q", result.UserID, "user_1")
	}
	if result.Tier != "pro" {
		t.Errorf("Tier = %q, want %q", result.Tier, "pro")
	}
}

func TestVerifyOTP_InvalidCode(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer server.Close()

	c := NewClient(server.URL, "tok_test")
	_, err := c.VerifyOTP(VerifyOTPRequest{
		Email: "test@example.com",
		Code:  "000000",
	})
	if err == nil {
		t.Fatal("expected error for invalid OTP code")
	}
}

// ---------------------------------------------------------------------------
// JSON serialization of types
// ---------------------------------------------------------------------------

func TestPricingTier_JSONRoundTrip(t *testing.T) {
	tier := PricingTier{
		ID:          "pro",
		Name:        "Pro",
		Price:       "$49",
		Period:      "/mo",
		Description: "For production use",
		Features:    []string{"5 sites", "25 users"},
		Highlighted: true,
	}

	data, err := json.Marshal(tier)
	if err != nil {
		t.Fatalf("Marshal: %v", err)
	}

	var decoded PricingTier
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Unmarshal: %v", err)
	}

	if decoded.ID != tier.ID {
		t.Errorf("ID = %q, want %q", decoded.ID, tier.ID)
	}
	if decoded.Name != tier.Name {
		t.Errorf("Name = %q, want %q", decoded.Name, tier.Name)
	}
	if decoded.Highlighted != tier.Highlighted {
		t.Errorf("Highlighted = %v, want %v", decoded.Highlighted, tier.Highlighted)
	}
	if len(decoded.Features) != len(tier.Features) {
		t.Errorf("Features length = %d, want %d", len(decoded.Features), len(tier.Features))
	}
}

func TestPricingTier_OmitsEmptyPrice(t *testing.T) {
	tier := PricingTier{
		ID:          "free",
		Name:        "Free",
		Description: "Free tier",
		Features:    []string{"1 site"},
	}

	data, err := json.Marshal(tier)
	if err != nil {
		t.Fatalf("Marshal: %v", err)
	}

	// Price and Period have omitempty, should not appear
	var raw map[string]interface{}
	json.Unmarshal(data, &raw)

	if _, ok := raw["price"]; ok {
		t.Error("empty Price should be omitted from JSON")
	}
	if _, ok := raw["period"]; ok {
		t.Error("empty Period should be omitted from JSON")
	}
}

func TestCheckoutRequest_JSON(t *testing.T) {
	req := CheckoutRequest{PriceID: "price_123", Tier: "pro"}
	data, err := json.Marshal(req)
	if err != nil {
		t.Fatalf("Marshal: %v", err)
	}

	var decoded CheckoutRequest
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Unmarshal: %v", err)
	}
	if decoded.PriceID != "price_123" {
		t.Errorf("PriceID = %q, want %q", decoded.PriceID, "price_123")
	}
	if decoded.Tier != "pro" {
		t.Errorf("Tier = %q, want %q", decoded.Tier, "pro")
	}
}

func TestLinkSSHKeyRequest_JSON(t *testing.T) {
	req := LinkSSHKeyRequest{
		Fingerprint: "SHA256:abc123",
		Email:       "test@example.com",
	}
	data, err := json.Marshal(req)
	if err != nil {
		t.Fatalf("Marshal: %v", err)
	}

	var decoded LinkSSHKeyRequest
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Unmarshal: %v", err)
	}
	if decoded.Fingerprint != req.Fingerprint {
		t.Errorf("Fingerprint = %q, want %q", decoded.Fingerprint, req.Fingerprint)
	}
	if decoded.Email != req.Email {
		t.Errorf("Email = %q, want %q", decoded.Email, req.Email)
	}
}

func TestVerifyOTPRequest_JSON(t *testing.T) {
	req := VerifyOTPRequest{Email: "test@example.com", Code: "123456"}
	data, err := json.Marshal(req)
	if err != nil {
		t.Fatalf("Marshal: %v", err)
	}

	var decoded VerifyOTPRequest
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Unmarshal: %v", err)
	}
	if decoded.Email != req.Email {
		t.Errorf("Email = %q, want %q", decoded.Email, req.Email)
	}
	if decoded.Code != req.Code {
		t.Errorf("Code = %q, want %q", decoded.Code, req.Code)
	}
}
