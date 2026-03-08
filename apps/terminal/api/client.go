// Package api provides an HTTP client for the RevealUI API.
package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// Client is an HTTP client for the RevealUI API.
type Client struct {
	baseURL    string
	httpClient *http.Client
}

// NewClient creates a new API client.
func NewClient(baseURL string) *Client {
	return &Client{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
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
	UserID string `json:"userId"`
	Email  string `json:"email"`
	Tier   string `json:"tier"`
}

// LookupByFingerprint looks up a user by SSH key fingerprint.
func (c *Client) LookupByFingerprint(fingerprint string) (*LookupResponse, error) {
	resp, err := c.httpClient.Get(
		fmt.Sprintf("%s/api/terminal-auth/lookup?fingerprint=%s", c.baseURL, fingerprint),
	)
	if err != nil {
		return nil, fmt.Errorf("lookup request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, nil // New user
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

	resp, err := c.httpClient.Post(
		fmt.Sprintf("%s/api/billing/checkout", c.baseURL),
		"application/json",
		bytes.NewReader(body),
	)
	if err != nil {
		return nil, fmt.Errorf("checkout request failed: %w", err)
	}
	defer resp.Body.Close()

	var result CheckoutResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode checkout response: %w", err)
	}
	return &result, nil
}
