package middleware

import (
	"context"
	"log/slog"

	"github.com/gofiber/fiber/v2"
)

// StaffChecker dipenuhi oleh repository.ProfileRepository.
type StaffChecker interface {
	IsStaff(ctx context.Context, userID string) (bool, error)
}

// RequireStaff menolak user yang tokennya sah tapi bukan staf studio.
//
// Harus dipasang SETELAH RequireSupabaseAuth. Token Supabase yang valid hanya
// membuktikan "orang ini punya akun di project ini" — dan itu belum tentu
// berarti berhak mengelola konten. Kalau nanti website punya login untuk klien,
// mereka akan memegang token yang sama sahnya.
func RequireStaff(checker StaffChecker) fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID, _ := c.Locals(ContextUserID).(string)
		if userID == "" {
			return fiber.NewError(fiber.StatusUnauthorized, "token tidak ada")
		}

		staf, err := checker.IsStaff(c.Context(), userID)
		if err != nil {
			return err
		}
		if !staf {
			slog.Warn("akses admin ditolak untuk non-staf",
				"user_id", userID, "path", c.Path())
			return fiber.NewError(fiber.StatusForbidden, "akun ini tidak berhak mengelola konten")
		}

		return c.Next()
	}
}
