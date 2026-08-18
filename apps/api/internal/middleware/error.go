package middleware

import (
	"errors"
	"log/slog"

	"github.com/gofiber/fiber/v2"
)

// ErrorHandler menyeragamkan bentuk respons error dan menahan detail internal
// agar tidak bocor ke klien di production.
func ErrorHandler(production bool) fiber.ErrorHandler {
	return func(c *fiber.Ctx, err error) error {
		status := fiber.StatusInternalServerError
		message := "terjadi kesalahan pada server"

		var fiberErr *fiber.Error
		if errors.As(err, &fiberErr) {
			status = fiberErr.Code
			message = fiberErr.Message
		}

		if status >= fiber.StatusInternalServerError {
			slog.Error("request gagal",
				"method", c.Method(),
				"path", c.Path(),
				"request_id", c.Locals("requestid"),
				"error", err)

			if !production {
				message = err.Error()
			}
		}

		return c.Status(status).JSON(fiber.Map{
			"error": fiber.Map{
				"status":  status,
				"message": message,
			},
		})
	}
}
