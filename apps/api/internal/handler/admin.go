package handler

import (
	"errors"

	"github.com/gofiber/fiber/v2"

	"github.com/pahlevidirga/architecture-web/apps/api/internal/model"
	"github.com/pahlevidirga/architecture-web/apps/api/internal/repository"
)

var statusProyekSah = map[string]bool{"draft": true, "published": true, "archived": true}
var statusInquirySah = map[string]bool{"new": true, "contacted": true, "qualified": true, "closed": true}

// ListProjectsAdmin melayani GET /api/v1/admin/projects — termasuk draft.
func (h *Handler) ListProjectsAdmin(c *fiber.Ctx) error {
	daftar, err := h.admin.ListAll(c.Context())
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{"data": daftar})
}

func (h *Handler) CreateProject(c *fiber.Ctx) error {
	var in model.ProjectInput
	if err := c.BodyParser(&in); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "body tidak valid")
	}
	if err := periksaInput(&in, true); err != nil {
		return err
	}

	id, err := h.admin.Create(c.Context(), in)
	if err != nil {
		return fiber.NewError(fiber.StatusUnprocessableEntity, err.Error())
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"data": fiber.Map{"id": id}})
}

func (h *Handler) UpdateProject(c *fiber.Ctx) error {
	var in model.ProjectInput
	if err := c.BodyParser(&in); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "body tidak valid")
	}
	if err := periksaInput(&in, false); err != nil {
		return err
	}

	err := h.admin.Update(c.Context(), c.Params("id"), in)
	if errors.Is(err, repository.ErrNotFound) {
		return fiber.NewError(fiber.StatusNotFound, "proyek tidak ditemukan")
	}
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{"data": fiber.Map{"updated": true}})
}

func (h *Handler) DeleteProject(c *fiber.Ctx) error {
	err := h.admin.Delete(c.Context(), c.Params("id"))
	if errors.Is(err, repository.ErrNotFound) {
		return fiber.NewError(fiber.StatusNotFound, "proyek tidak ditemukan")
	}
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{"data": fiber.Map{"deleted": true}})
}

func (h *Handler) AddProjectImage(c *fiber.Ctx) error {
	var in model.ImageInput
	if err := c.BodyParser(&in); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "body tidak valid")
	}
	if in.StorageKey == "" {
		return fiber.NewError(fiber.StatusUnprocessableEntity, "storageKey wajib diisi")
	}

	id, err := h.admin.AddImage(c.Context(), c.Params("id"), in)
	if err != nil {
		return fiber.NewError(fiber.StatusUnprocessableEntity, err.Error())
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"data": fiber.Map{"id": id}})
}

func (h *Handler) DeleteProjectImage(c *fiber.Ctx) error {
	err := h.admin.DeleteImage(c.Context(), c.Params("imageId"))
	if errors.Is(err, repository.ErrNotFound) {
		return fiber.NewError(fiber.StatusNotFound, "gambar tidak ditemukan")
	}
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{"data": fiber.Map{"deleted": true}})
}

func (h *Handler) ListInquiries(c *fiber.Ctx) error {
	status := c.Query("status")
	if status != "" && !statusInquirySah[status] {
		return fiber.NewError(fiber.StatusBadRequest, "status tidak dikenal")
	}

	daftar, err := h.admin.ListInquiries(c.Context(), status)
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{"data": daftar})
}

func (h *Handler) UpdateInquiry(c *fiber.Ctx) error {
	var req struct {
		Status string `json:"status"`
	}
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "body tidak valid")
	}
	if !statusInquirySah[req.Status] {
		return fiber.NewError(fiber.StatusUnprocessableEntity, "status tidak dikenal")
	}

	err := h.admin.SetInquiryStatus(c.Context(), c.Params("id"), req.Status)
	if errors.Is(err, repository.ErrNotFound) {
		return fiber.NewError(fiber.StatusNotFound, "pesan tidak ditemukan")
	}
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{"data": fiber.Map{"updated": true}})
}

// periksaInput menegakkan aturan yang tidak bisa dijaga tipe data: nilai enum
// harus dikenal, dan slug harus berbentuk yang aman dipakai di URL.
func periksaInput(in *model.ProjectInput, baru bool) error {
	if baru && (in.Slug == nil || in.Title == nil) {
		return fiber.NewError(fiber.StatusUnprocessableEntity, "slug dan judul wajib diisi")
	}
	if in.Category != nil && !validCategories[*in.Category] {
		return fiber.NewError(fiber.StatusUnprocessableEntity, "kategori tidak dikenal")
	}
	if in.Status != nil && !statusProyekSah[*in.Status] {
		return fiber.NewError(fiber.StatusUnprocessableEntity, "status tidak dikenal")
	}
	if in.Slug != nil && !slugSah(*in.Slug) {
		return fiber.NewError(fiber.StatusUnprocessableEntity,
			"slug hanya boleh huruf kecil, angka, dan tanda hubung")
	}
	if in.Year != nil && (*in.Year < 1900 || *in.Year > 2100) {
		return fiber.NewError(fiber.StatusUnprocessableEntity, "tahun di luar rentang wajar")
	}
	return nil
}

func slugSah(s string) bool {
	if s == "" || len(s) > 120 || s[0] == '-' || s[len(s)-1] == '-' {
		return false
	}
	for _, r := range s {
		if !(r >= 'a' && r <= 'z' || r >= '0' && r <= '9' || r == '-') {
			return false
		}
	}
	return true
}
