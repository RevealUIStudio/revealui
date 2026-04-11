// Package api provides an HTTP client for the RevealUI API.
package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"
)

// Client is an HTTP client for the RevealUI API.
type Client struct {
	baseURL      string
	serviceToken string
	httpClient   *http.Client
}

// NewClient creates a new API client.
// serviceToken is optional — pass "" for public-only endpoints.
func NewClient(baseURL, serviceToken string) *Client {
	return &Client{
		baseURL:      baseURL,
		serviceToken: serviceToken,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// HTTPClient returns the underlying http.Client for reuse by other packages.
func (c *Client) HTTPClient() *http.Client {
	return c.httpClient
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// PricingTier mirrors the SubscriptionTier from @revealui/contracts/pricing.
type PricingTier struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Price       string   `json:"price,omitempty"`
	Period      string   `json:"period,omitempty"`
	Description string   `json:"description"`
	Features    []string `json:"features"`
	Highlighted bool     `json:"highlighted"`
}

// PricingResponse is the response from GET /api/pricing.
type PricingResponse struct {
	Subscriptions []PricingTier `json:"subscriptions"`
}

// LinkSSHKeyRequest is the request body for linking an SSH key to an account.
type LinkSSHKeyRequest struct {
	Fingerprint string `json:"fingerprint"`
	Email       string `json:"email"`
}

// VerifyOTPRequest is the request body for verifying an email OTP.
type VerifyOTPRequest struct {
	Email string `json:"email"`
	Code  string `json:"code"`
}

// CheckoutRequest is the request body for creating a checkout session.
type CheckoutRequest struct {
	PriceID string `json:"priceId"`
	Tier    string `json:"tier"`
}

// CheckoutResponse is the response from the checkout endpoint.
type CheckoutResponse struct {
	URL   string `json:"url"`
	Error string `json:"error,omitempty"`
}

// LookupResponse is the response from the fingerprint lookup endpoint.
type LookupResponse struct {
	Success bool   `json:"success"`
	UserID  string `json:"userId"`
	Email   string `json:"email"`
	Tier    string `json:"tier"`
}

// ---------------------------------------------------------------------------
// Public endpoints (no auth)
// ---------------------------------------------------------------------------

// FetchPricing fetches subscription tier data from GET /api/pricing.
func (c *Client) FetchPricing() (*PricingResponse, error) {
	resp, err := c.httpClient.Get(fmt.Sprintf("%s/api/pricing", c.baseURL))
	if err != nil {
		return nil, fmt.Errorf("pricing request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("pricing returned %d", resp.StatusCode)
	}

	var result PricingResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode pricing response: %w", err)
	}
	return &result, nil
}

// ---------------------------------------------------------------------------
// Authenticated endpoints
// ---------------------------------------------------------------------------

// authGet performs a GET request with the service token.
func (c *Client) authGet(endpoint string) (*http.Response, error) {
	req, err := http.NewRequest(http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	if c.serviceToken != "" {
		req.Header.Set("Authorization", "Bearer "+c.serviceToken)
	}
	return c.httpClient.Do(req)
}

// authPost performs a POST request with the service token.
func (c *Client) authPost(endpoint string, body []byte) (*http.Response, error) {
	req, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	if c.serviceToken != "" {
		req.Header.Set("Authorization", "Bearer "+c.serviceToken)
	}
	return c.httpClient.Do(req)
}

// LookupByFingerprint looks up a user by SSH key fingerprint.
func (c *Client) LookupByFingerprint(fingerprint string) (*LookupResponse, error) {
	endpoint := fmt.Sprintf("%s/api/terminal-auth/lookup?fingerprint=%s",
		c.baseURL, url.QueryEscape(fingerprint))

	resp, err := c.authGet(endpoint)
	if err != nil {
		return nil, fmt.Errorf("lookup request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, nil // New user — not linked yet
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("lookup returned %d", resp.StatusCode)
	}

	var result LookupResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode lookup response: %w", err)
	}
	return &result, nil
}

// CreateCheckout creates a Stripe checkout session and returns the URL.
func (c *Client) CreateCheckout(req CheckoutRequest) (*CheckoutResponse, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("marshal checkout request: %w", err)
	}

	resp, err := c.authPost(fmt.Sprintf("%s/api/billing/checkout", c.baseURL), body)
	if err != nil {
		return nil, fmt.Errorf("checkout request failed: %w", err)
	}
	defer resp.Body.Close()

	var result CheckoutResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode checkout response: %w", err)
	}
	if result.Error != "" {
		return nil, fmt.Errorf("checkout error: %s", result.Error)
	}
	return &result, nil
}

// LinkSSHKey initiates SSH key linking by sending an OTP to the user's email.
func (c *Client) LinkSSHKey(req LinkSSHKeyRequest) error {
	body, err := json.Marshal(req)
	if err != nil {
		return fmt.Errorf("marshal link request: %w", err)
	}

	resp, err := c.authPost(fmt.Sprintf("%s/api/terminal-auth/link", c.baseURL), body)
	if err != nil {
		return fmt.Errorf("link request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusConflict {
		return fmt.Errorf("SSH key already linked to an account")
	}
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("link returned %d", resp.StatusCode)
	}
	return nil
}

// VerifyOTP verifies the email OTP and completes SSH key linking.
func (c *Client) VerifyOTP(req VerifyOTPRequest) (*LookupResponse, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("marshal verify request: %w", err)
	}

	resp, err := c.authPost(fmt.Sprintf("%s/api/terminal-auth/verify", c.baseURL), body)
	if err != nil {
		return nil, fmt.Errorf("verify request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("verification failed (HTTP %d)", resp.StatusCode)
	}

	var result LookupResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode verify response: %w", err)
	}
	return &result, nil
}
