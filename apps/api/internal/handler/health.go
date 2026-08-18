package handler

import "github.com/gofiber/fiber/v2"

// Health dipakai Cloud Run / Render untuk startup probe. Sengaja tidak
// menyentuh database supaya container tetap dianggap sehat saat Supabase
// free tier sedang di-resume dari auto-pause.
func (h *Handler) Health(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"status": "ok",
		"env":    h.cfg.Env,
	})
}
