package handler

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
)

var authClient = &http.Client{Timeout: 12 * time.Second}

type kredensial struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type tokenSupabase struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
	User         struct {
		ID    string `json:"id"`
		Email string `json:"email"`
	} `json:"user"`
}

// Login menukar email dan kata sandi dengan token Supabase.
//
// Permintaannya diteruskan dari sini, bukan dari browser, karena invarian
// proyek ini: frontend tidak pernah bicara langsung ke Supabase. Konsekuensi
// praktisnya, anon key tidak pernah ikut terkirim ke halaman, dan pembatasan
// laju percobaan login bisa ditegakkan di satu tempat.
func (h *Handler) Login(c *fiber.Ctx) error {
	if !h.cfg.AuthConfigured() {
		return fiber.NewError(fiber.StatusServiceUnavailable, "autentikasi belum dikonfigurasi")
	}

	var req kredensial
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "body tidak valid")
	}

	req.Email = strings.TrimSpace(req.Email)
	if req.Email == "" || req.Password == "" {
		return fiber.NewError(fiber.StatusUnprocessableEntity, "email dan kata sandi wajib diisi")
	}

	tok, err := h.tukarToken("password", map[string]string{
		"email":    req.Email,
		"password": req.Password,
	})
	if err != nil {
		// Pesan tunggal untuk email tidak dikenal maupun kata sandi salah —
		// membedakannya memberi tahu penyerang alamat mana yang terdaftar.
		return fiber.NewError(fiber.StatusUnauthorized, "email atau kata sandi salah")
	}

	// Punya akun belum berarti berhak masuk panel. Non-staf ditolak di sini
	// supaya tidak memegang token yang lolos lapisan pertama.
	role, err := h.profiles.Role(c.Context(), tok.User.ID)
	if err != nil {
		return err
	}
	if role == "" {
		return fiber.NewError(fiber.StatusForbidden, "akun ini tidak berhak mengelola konten")
	}

	return c.JSON(fiber.Map{"data": fiber.Map{
		"accessToken":   tok.AccessToken,
		"refreshToken":  tok.RefreshToken,
		"expiresIn":     tok.ExpiresIn,
		"email":         tok.User.Email,
		"role":          role,
		"isMasterAdmin": role == "admin",
	}})
}

// Refresh memperpanjang sesi tanpa meminta kata sandi lagi.
func (h *Handler) Refresh(c *fiber.Ctx) error {
	if !h.cfg.AuthConfigured() {
		return fiber.NewError(fiber.StatusServiceUnavailable, "autentikasi belum dikonfigurasi")
	}

	var req struct {
		RefreshToken string `json:"refreshToken"`
	}
	if err := c.BodyParser(&req); err != nil || req.RefreshToken == "" {
		return fiber.NewError(fiber.StatusBadRequest, "refresh token tidak ada")
	}

	tok, err := h.tukarToken("refresh_token", map[string]string{"refresh_token": req.RefreshToken})
	if err != nil {
		return fiber.NewError(fiber.StatusUnauthorized, "sesi sudah berakhir, masuk kembali")
	}

	return c.JSON(fiber.Map{"data": fiber.Map{
		"accessToken":  tok.AccessToken,
		"refreshToken": tok.RefreshToken,
		"expiresIn":    tok.ExpiresIn,
	}})
}

func (h *Handler) tukarToken(grant string, body map[string]string) (*tokenSupabase, error) {
	payload, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}

	url := fmt.Sprintf("%s/auth/v1/token?grant_type=%s", strings.TrimSuffix(h.cfg.SupabaseURL, "/"), grant)
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", h.cfg.SupabaseAnonKey)

	resp, err := authClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("supabase menolak: status %d", resp.StatusCode)
	}

	var tok tokenSupabase
	if err := json.NewDecoder(resp.Body).Decode(&tok); err != nil {
		return nil, err
	}
	if tok.AccessToken == "" {
		return nil, fmt.Errorf("supabase tidak mengembalikan token")
	}
	return &tok, nil
}
