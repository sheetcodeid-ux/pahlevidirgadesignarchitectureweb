// Package mailer mengirim notifikasi transaksional lewat Resend.
package mailer

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"html"
	"net/http"
	"time"
)

type Resend struct {
	apiKey string
	from   string
	client *http.Client
}

func NewResend(apiKey, from string) *Resend {
	return &Resend{
		apiKey: apiKey,
		from:   from,
		client: &http.Client{Timeout: 10 * time.Second},
	}
}

// Enabled false berarti RESEND_API_KEY belum diisi; pemanggil boleh
// melewatkan pengiriman tanpa menganggapnya error.
func (r *Resend) Enabled() bool { return r != nil && r.apiKey != "" }

type InquiryNotification struct {
	To          string
	Name        string
	Email       string
	Phone       string
	ProjectType string
	BudgetRange string
	Message     string
}

// SendInquiryNotification memberi tahu studio bahwa ada calon klien masuk.
func (r *Resend) SendInquiryNotification(ctx context.Context, n InquiryNotification) error {
	if !r.Enabled() {
		return nil
	}

	body := map[string]any{
		"from":     r.from,
		"to":       []string{n.To},
		"reply_to": n.Email,
		"subject":  fmt.Sprintf("Inquiry baru dari %s", n.Name),
		"html":     inquiryHTML(n),
	}

	payload, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("encode email: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		"https://api.resend.com/emails", bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("buat request email: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+r.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := r.client.Do(req)
	if err != nil {
		return fmt.Errorf("kirim email: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return fmt.Errorf("resend menolak email: status %d", resp.StatusCode)
	}
	return nil
}

// inquiryHTML meng-escape seluruh nilai kiriman user — isi form tidak pernah
// dipercaya sebagai HTML.
func inquiryHTML(n InquiryNotification) string {
	row := func(label, value string) string {
		if value == "" {
			return ""
		}
		return fmt.Sprintf("<p><strong>%s:</strong> %s</p>", label, html.EscapeString(value))
	}

	return "<div style=\"font-family:system-ui,sans-serif;line-height:1.6\">" +
		"<h2>Inquiry baru dari website</h2>" +
		row("Nama", n.Name) +
		row("Email", n.Email) +
		row("Telepon", n.Phone) +
		row("Jenis proyek", n.ProjectType) +
		row("Rentang budget", n.BudgetRange) +
		"<hr><p style=\"white-space:pre-wrap\">" + html.EscapeString(n.Message) + "</p>" +
		"</div>"
}
