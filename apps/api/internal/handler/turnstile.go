package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const turnstileVerifyURL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

var turnstileClient = &http.Client{Timeout: 8 * time.Second}

// verifyTurnstile menanyakan ke Cloudflare apakah token dari widget valid.
//
// Kalau secret belum diisi (mis. saat development), verifikasi dilewati —
// tapi config.Load memastikan production tetap bisa dikonfigurasi eksplisit.
func verifyTurnstile(ctx context.Context, secret, token, remoteIP string) error {
	if secret == "" {
		return nil
	}
	if strings.TrimSpace(token) == "" {
		return fmt.Errorf("token turnstile kosong")
	}

	form := url.Values{
		"secret":   {secret},
		"response": {token},
	}
	if remoteIP != "" {
		form.Set("remoteip", remoteIP)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		turnstileVerifyURL, strings.NewReader(form.Encode()))
	if err != nil {
		return fmt.Errorf("buat request turnstile: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := turnstileClient.Do(req)
	if err != nil {
		return fmt.Errorf("hubungi turnstile: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		Success    bool     `json:"success"`
		ErrorCodes []string `json:"error-codes"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return fmt.Errorf("baca respons turnstile: %w", err)
	}
	if !result.Success {
		return fmt.Errorf("turnstile menolak: %s", strings.Join(result.ErrorCodes, ", "))
	}
	return nil
}
