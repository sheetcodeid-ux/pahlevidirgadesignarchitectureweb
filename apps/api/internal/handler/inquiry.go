package handler

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"log/slog"
	"net/mail"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"

	"github.com/pahlevidirga/architecture-web/apps/api/internal/mailer"
	"github.com/pahlevidirga/architecture-web/apps/api/internal/model"
)

type inquiryRequest struct {
	Name           string `json:"name"`
	Email          string `json:"email"`
	Phone          string `json:"phone"`
	ProjectType    string `json:"projectType"`
	BudgetRange    string `json:"budgetRange"`
	Message        string `json:"message"`
	Source         string `json:"source"`
	TurnstileToken string `json:"turnstileToken"`

	// Honeypot: field tersembunyi di form. Manusia tidak pernah mengisinya,
	// bot yang mengisi semua input akan mengisinya.
	Website string `json:"website"`
}

// CreateInquiry melayani POST /api/v1/inquiries dari form kontak.
func (h *Handler) CreateInquiry(c *fiber.Ctx) error {
	var req inquiryRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "body tidak valid")
	}

	// Jawab 202 seolah berhasil supaya bot tidak belajar bahwa jebakannya
	// terdeteksi, tapi jangan simpan apa pun.
	if strings.TrimSpace(req.Website) != "" {
		return c.Status(fiber.StatusAccepted).JSON(fiber.Map{"data": fiber.Map{"received": true}})
	}

	if err := validateInquiry(&req); err != nil {
		return err
	}

	if err := verifyTurnstile(c.Context(), h.cfg.TurnstileSecret, req.TurnstileToken, c.IP()); err != nil {
		slog.Warn("verifikasi turnstile gagal", "error", err, "ip", c.IP())
		return fiber.NewError(fiber.StatusForbidden, "verifikasi anti-bot gagal")
	}

	in := model.Inquiry{
		Name:      req.Name,
		Email:     req.Email,
		Message:   req.Message,
		IPHash:    h.hashIP(c.IP()),
		UserAgent: truncate(c.Get(fiber.HeaderUserAgent), 512),
	}
	in.Phone = optional(req.Phone)
	in.BudgetRange = optional(req.BudgetRange)
	in.Source = optional(req.Source)
	if validCategories[req.ProjectType] {
		in.ProjectType = &req.ProjectType
	}

	id, err := h.inquiries.Create(c.Context(), in)
	if err != nil {
		return err
	}

	h.notifyInquiry(req)

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"data": fiber.Map{"id": id, "received": true},
	})
}

// notifyInquiry mengirim email di goroutine terpisah. Calon klien sudah
// tersimpan di database, jadi kegagalan email tidak boleh menggagalkan
// request — cukup dicatat di log.
func (h *Handler) notifyInquiry(req inquiryRequest) {
	if !h.mailer.Enabled() || h.cfg.InquiryNotifyTo == "" {
		return
	}

	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		err := h.mailer.SendInquiryNotification(ctx, mailer.InquiryNotification{
			To:          h.cfg.InquiryNotifyTo,
			Name:        req.Name,
			Email:       req.Email,
			Phone:       req.Phone,
			ProjectType: req.ProjectType,
			BudgetRange: req.BudgetRange,
			Message:     req.Message,
		})
		if err != nil {
			slog.Error("notifikasi inquiry gagal dikirim", "error", err)
		}
	}()
}

func validateInquiry(req *inquiryRequest) error {
	req.Name = strings.TrimSpace(req.Name)
	req.Email = strings.TrimSpace(req.Email)
	req.Message = strings.TrimSpace(req.Message)
	req.Phone = strings.TrimSpace(req.Phone)

	switch {
	case len(req.Name) < 2 || len(req.Name) > 120:
		return fiber.NewError(fiber.StatusUnprocessableEntity, "nama harus 2-120 karakter")
	case len(req.Message) < 10 || len(req.Message) > 5000:
		return fiber.NewError(fiber.StatusUnprocessableEntity, "pesan harus 10-5000 karakter")
	case len(req.Phone) > 32:
		return fiber.NewError(fiber.StatusUnprocessableEntity, "nomor telepon terlalu panjang")
	}

	if _, err := mail.ParseAddress(req.Email); err != nil {
		return fiber.NewError(fiber.StatusUnprocessableEntity, "format email tidak valid")
	}

	return nil
}

// hashIP menyimpan sidik jari IP untuk deteksi abuse tanpa menyimpan alamat
// aslinya.
//
// Pakai HMAC dengan salt rahasia, bukan SHA-256 polos: ruang alamat IPv4 cuma
// 4 miliar kemungkinan, jadi hash tanpa salt bisa dibalik dengan brute force
// dalam hitungan menit. Tanpa IP_HASH_SALT terisi, kolomnya dikosongkan
// daripada menyimpan sesuatu yang menyesatkan seolah-olah anonim.
func (h *Handler) hashIP(ip string) string {
	if ip == "" || h.cfg.IPHashSalt == "" {
		return ""
	}
	mac := hmac.New(sha256.New, []byte(h.cfg.IPHashSalt))
	mac.Write([]byte(ip))
	return hex.EncodeToString(mac.Sum(nil))
}

func optional(s string) *string {
	if trimmed := strings.TrimSpace(s); trimmed != "" {
		return &trimmed
	}
	return nil
}

func truncate(s string, max int) string {
	if len(s) > max {
		return s[:max]
	}
	return s
}
