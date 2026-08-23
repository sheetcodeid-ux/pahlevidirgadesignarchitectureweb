// Package handler berisi HTTP handler Fiber dan validasi input.
package handler

import (
	"github.com/pahlevidirga/architecture-web/apps/api/internal/config"
	"github.com/pahlevidirga/architecture-web/apps/api/internal/mailer"
	"github.com/pahlevidirga/architecture-web/apps/api/internal/repository"
	"github.com/pahlevidirga/architecture-web/apps/api/internal/storage"
)

// Handler menampung seluruh dependency. Field boleh nil untuk integrasi
// opsional (storage, mailer); handler terkait akan menolak request dengan
// 503 alih-alih panic.
type Handler struct {
	cfg       *config.Config
	projects  *repository.ProjectRepository
	inquiries *repository.InquiryRepository
	profiles  *repository.ProfileRepository
	storage   *storage.R2
	mailer    *mailer.Resend
}

func New(
	cfg *config.Config,
	projects *repository.ProjectRepository,
	inquiries *repository.InquiryRepository,
	profiles *repository.ProfileRepository,
	store *storage.R2,
	mail *mailer.Resend,
) *Handler {
	return &Handler{
		cfg:       cfg,
		projects:  projects,
		inquiries: inquiries,
		profiles:  profiles,
		storage:   store,
		mailer:    mail,
	}
}
