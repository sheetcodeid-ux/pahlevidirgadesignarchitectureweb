// Package config memuat seluruh konfigurasi runtime dari environment
// variable dan memvalidasinya sekali saat boot, supaya service gagal cepat
// di startup ketimbang gagal pada request pertama yang menyentuh integrasi.
package config

import (
	"fmt"
	"os"
	"strings"
	"time"
)

type Config struct {
	Env             string
	Port            string
	AllowedOrigins  []string
	ShutdownTimeout time.Duration

	DatabaseURL string

	SupabaseURL        string
	SupabaseServiceKey string
	SupabaseAnonKey    string
	SupabaseJWTSecret  string

	R2AccountID       string
	R2AccessKeyID     string
	R2SecretAccessKey string
	R2Bucket          string
	R2PublicBaseURL   string

	TurnstileSecret string
	IPHashSalt      string

	ResendAPIKey    string
	InquiryNotifyTo string
	InquiryFrom     string
}

// Load membaca environment dan mengembalikan error yang menyebut semua
// variabel yang kurang sekaligus, bukan satu per satu tiap kali restart.
func Load() (*Config, error) {
	cfg := &Config{
		Env:             envOr("APP_ENV", "development"),
		Port:            envOr("PORT", "8080"),
		ShutdownTimeout: 15 * time.Second,
		AllowedOrigins:  splitCSV(envOr("ALLOWED_ORIGINS", "http://localhost:4321")),

		DatabaseURL: os.Getenv("DATABASE_URL"),

		SupabaseURL:        os.Getenv("SUPABASE_URL"),
		SupabaseServiceKey: os.Getenv("SUPABASE_SERVICE_ROLE_KEY"),
		SupabaseAnonKey:    os.Getenv("SUPABASE_ANON_KEY"),
		SupabaseJWTSecret:  os.Getenv("SUPABASE_JWT_SECRET"),

		R2AccountID:       os.Getenv("R2_ACCOUNT_ID"),
		R2AccessKeyID:     os.Getenv("R2_ACCESS_KEY_ID"),
		R2SecretAccessKey: os.Getenv("R2_SECRET_ACCESS_KEY"),
		R2Bucket:          os.Getenv("R2_BUCKET"),
		R2PublicBaseURL:   strings.TrimSuffix(os.Getenv("R2_PUBLIC_BASE_URL"), "/"),

		TurnstileSecret: os.Getenv("TURNSTILE_SECRET_KEY"),
		IPHashSalt:      os.Getenv("IP_HASH_SALT"),

		ResendAPIKey:    os.Getenv("RESEND_API_KEY"),
		InquiryNotifyTo: os.Getenv("INQUIRY_NOTIFY_TO"),
		InquiryFrom:     envOr("INQUIRY_FROM", "website@example.com"),
	}

	required := map[string]string{
		"DATABASE_URL":        cfg.DatabaseURL,
		"SUPABASE_JWT_SECRET": cfg.SupabaseJWTSecret,
	}

	var missing []string
	for name, value := range required {
		if value == "" {
			missing = append(missing, name)
		}
	}
	if len(missing) > 0 {
		return nil, fmt.Errorf("environment variable wajib belum diisi: %s", strings.Join(missing, ", "))
	}

	return cfg, nil
}

// IsProduction dipakai untuk mengetatkan perilaku yang di dev sengaja longgar
// (pesan error detail, CORS, verifikasi Turnstile).
func (c *Config) IsProduction() bool { return c.Env == "production" }

// AuthConfigured menandakan endpoint login bisa melayani permintaan. Tanpa
// ini panel admin tidak bisa dipakai, tapi situs publik tetap jalan.
func (c *Config) AuthConfigured() bool {
	return c.SupabaseURL != "" && c.SupabaseAnonKey != ""
}

// StorageConfigured menandakan upload gambar bisa dilayani. Website tetap
// bisa jalan tanpa ini selama belum ada admin panel yang meng-upload.
func (c *Config) StorageConfigured() bool {
	return c.R2AccountID != "" && c.R2AccessKeyID != "" && c.R2SecretAccessKey != "" && c.R2Bucket != ""
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func splitCSV(raw string) []string {
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if trimmed := strings.TrimSpace(p); trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}
