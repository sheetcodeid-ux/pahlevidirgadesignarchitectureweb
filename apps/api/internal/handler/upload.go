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

// Me mengembalikan identitas dan peran pemilik token.
//
// Peran dipakai frontend untuk menyembunyikan menu yang tidak relevan. Itu
// kenyamanan, bukan keamanan: penjagaan sesungguhnya tetap di RequireStaff dan
// pada tiap endpoint.
func (h *Handler) Me(c *fiber.Ctx) error {
	userID, _ := c.Locals("userID").(string)

	role, err := h.profiles.Role(c.Context(), userID)
	if err != nil {
		return err
	}

	return c.JSON(fiber.Map{
		"data": fiber.Map{
			"id":            userID,
			"email":         c.Locals("userEmail"),
			"role":          role,
			"isMasterAdmin": role == "admin",
		},
	})
}
