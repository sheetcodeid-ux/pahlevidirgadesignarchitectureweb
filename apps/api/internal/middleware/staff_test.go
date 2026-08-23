package middleware

import (
	"context"
	"errors"
	"io"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
)

type checkerPalsu struct {
	staf bool
	err  error
}

func (c checkerPalsu) IsStaff(context.Context, string) (bool, error) { return c.staf, c.err }

// bangunApp menyiapkan rute yang dilindungi, dengan userID sudah terpasang
// seolah-olah RequireSupabaseAuth berhasil lebih dulu.
func bangunApp(userID string, checker StaffChecker) *fiber.App {
	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		if userID != "" {
			c.Locals(ContextUserID, userID)
		}
		return c.Next()
	})
	app.Get("/admin", RequireStaff(checker), func(c *fiber.Ctx) error {
		return c.SendString("rahasia")
	})
	return app
}

func TestRequireStaff(t *testing.T) {
	kasus := []struct {
		nama     string
		userID   string
		checker  checkerPalsu
		harapkan int
	}{
		{"staf terdaftar boleh masuk", "user-1", checkerPalsu{staf: true}, fiber.StatusOK},
		{"token sah tapi bukan staf ditolak", "user-2", checkerPalsu{staf: false}, fiber.StatusForbidden},
		{"tanpa userID ditolak", "", checkerPalsu{staf: true}, fiber.StatusUnauthorized},
		{"database bermasalah bukan berarti lolos", "user-3", checkerPalsu{err: errors.New("koneksi putus")}, fiber.StatusInternalServerError},
	}

	for _, k := range kasus {
		t.Run(k.nama, func(t *testing.T) {
			resp, err := bangunApp(k.userID, k.checker).Test(httptest.NewRequest("GET", "/admin", nil))
			if err != nil {
				t.Fatalf("request gagal: %v", err)
			}
			defer resp.Body.Close()

			if resp.StatusCode != k.harapkan {
				t.Errorf("status = %d, mau %d", resp.StatusCode, k.harapkan)
			}

			// Handler yang dilindungi tidak boleh pernah berjalan saat ditolak.
			if k.harapkan != fiber.StatusOK {
				body, _ := io.ReadAll(resp.Body)
				if string(body) == "rahasia" {
					t.Error("handler terlanjur berjalan padahal akses ditolak")
				}
			}
		})
	}
}
