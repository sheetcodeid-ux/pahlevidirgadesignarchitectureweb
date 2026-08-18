package handler

import (
	"strings"

	"github.com/gofiber/fiber/v2"
)

type uploadRequest struct {
	ProjectSlug string `json:"projectSlug"`
	ContentType string `json:"contentType"`
}

// CreateUploadURL melayani POST /api/v1/admin/uploads.
//
// Mengembalikan presigned PUT URL supaya panel admin bisa mengunggah gambar
// langsung ke R2 tanpa melewati backend.
func (h *Handler) CreateUploadURL(c *fiber.Ctx) error {
	if h.storage == nil {
		return fiber.NewError(fiber.StatusServiceUnavailable, "penyimpanan objek belum dikonfigurasi")
	}

	var req uploadRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "body tidak valid")
	}

	req.ProjectSlug = strings.TrimSpace(req.ProjectSlug)
	if req.ProjectSlug == "" {
		return fiber.NewError(fiber.StatusUnprocessableEntity, "projectSlug wajib diisi")
	}

	target, err := h.storage.PresignUpload(c.Context(), req.ProjectSlug, req.ContentType)
	if err != nil {
		return fiber.NewError(fiber.StatusUnprocessableEntity, err.Error())
	}

	return c.JSON(fiber.Map{"data": target})
}

// Me mengembalikan identitas dari token, berguna untuk memverifikasi bahwa
// alur login panel admin sudah tersambung benar.
func (h *Handler) Me(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"data": fiber.Map{
			"id":    c.Locals("userID"),
			"email": c.Locals("userEmail"),
		},
	})
}
