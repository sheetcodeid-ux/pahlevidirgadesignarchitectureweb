package handler

import (
	"errors"

	"github.com/gofiber/fiber/v2"

	"github.com/pahlevidirga/architecture-web/apps/api/internal/model"
	"github.com/pahlevidirga/architecture-web/apps/api/internal/repository"
)

const (
	defaultPageSize = 12
	maxPageSize     = 48
)

var validCategories = map[string]bool{
	"residential": true, "commercial": true, "interior": true,
	"landscape": true, "masterplan": true, "renovation": true,
}

// ListProjects melayani GET /api/v1/projects.
func (h *Handler) ListProjects(c *fiber.Ctx) error {
	category := c.Query("category")
	if category != "" && !validCategories[category] {
		return fiber.NewError(fiber.StatusBadRequest, "kategori tidak dikenal")
	}

	limit := c.QueryInt("limit", defaultPageSize)
	if limit < 1 {
		limit = defaultPageSize
	}
	if limit > maxPageSize {
		limit = maxPageSize
	}

	offset := c.QueryInt("offset", 0)
	if offset < 0 {
		offset = 0
	}

	projects, err := h.projects.List(c.Context(), model.ProjectFilter{
		Category: category,
		Featured: c.QueryBool("featured", false),
		Limit:    limit,
		Offset:   offset,
	})
	if err != nil {
		return err
	}

	// Konten portfolio jarang berubah; biarkan Cloudflare menyimpannya di edge.
	c.Set(fiber.HeaderCacheControl, "public, max-age=60, s-maxage=300, stale-while-revalidate=86400")

	return c.JSON(fiber.Map{
		"data": projects,
		"meta": fiber.Map{"limit": limit, "offset": offset, "count": len(projects)},
	})
}

// GetProject melayani GET /api/v1/projects/:slug.
func (h *Handler) GetProject(c *fiber.Ctx) error {
	project, err := h.projects.GetBySlug(c.Context(), c.Params("slug"))
	if errors.Is(err, repository.ErrNotFound) {
		return fiber.NewError(fiber.StatusNotFound, "proyek tidak ditemukan")
	}
	if err != nil {
		return err
	}

	c.Set(fiber.HeaderCacheControl, "public, max-age=60, s-maxage=300, stale-while-revalidate=86400")
	return c.JSON(fiber.Map{"data": project})
}
