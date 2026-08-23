package middleware

import (
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

const rahasiaUji = "rahasia-jwt-untuk-pengujian-saja"

func buatToken(t *testing.T, metode jwt.SigningMethod, kunci any, ubah func(jwt.MapClaims)) string {
	t.Helper()

	claims := jwt.MapClaims{
		"sub":   "aaaa0000-0000-4000-8000-000000000001",
		"email": "staf@pahlevidirga.com",
		"aud":   "authenticated",
		"exp":   time.Now().Add(time.Hour).Unix(),
	}
	if ubah != nil {
		ubah(claims)
	}

	token, err := jwt.NewWithClaims(metode, claims).SignedString(kunci)
	if err != nil {
		t.Fatalf("tanda tangan token: %v", err)
	}
	return token
}

func appAuth() *fiber.App {
	app := fiber.New()
	app.Get("/admin", RequireSupabaseAuth(rahasiaUji), func(c *fiber.Ctx) error {
		return c.SendString(c.Locals(ContextUserID).(string))
	})
	return app
}

func panggil(t *testing.T, header string) int {
	t.Helper()

	req := httptest.NewRequest("GET", "/admin", nil)
	if header != "" {
		req.Header.Set(fiber.HeaderAuthorization, header)
	}

	resp, err := appAuth().Test(req)
	if err != nil {
		t.Fatalf("request gagal: %v", err)
	}
	defer resp.Body.Close()
	return resp.StatusCode
}

func TestRequireSupabaseAuthMenerimaTokenSah(t *testing.T) {
	if got := panggil(t, "Bearer "+buatToken(t, jwt.SigningMethodHS256, []byte(rahasiaUji), nil)); got != fiber.StatusOK {
		t.Errorf("status = %d, mau 200", got)
	}
}

func TestRequireSupabaseAuthMenolak(t *testing.T) {
	kasus := map[string]string{
		"tanpa header":       "",
		"skema bukan bearer": "Basic abc123",
		"token sampah":       "Bearer bukan-token",

		"ditandatangani secret lain": "Bearer " + buatToken(t, jwt.SigningMethodHS256, []byte("secret-yang-salah"), nil),
	}

	for nama, header := range kasus {
		t.Run(nama, func(t *testing.T) {
			if got := panggil(t, header); got != fiber.StatusUnauthorized {
				t.Errorf("status = %d, mau 401", got)
			}
		})
	}
}

func TestRequireSupabaseAuthMenolakClaimBermasalah(t *testing.T) {
	kasus := map[string]func(jwt.MapClaims){
		"sudah kedaluwarsa": func(c jwt.MapClaims) { c["exp"] = time.Now().Add(-time.Minute).Unix() },
		"tanpa exp":         func(c jwt.MapClaims) { delete(c, "exp") },
		"audience lain":     func(c jwt.MapClaims) { c["aud"] = "orang-lain" },
		"tanpa subject":     func(c jwt.MapClaims) { delete(c, "sub") },
	}

	for nama, ubah := range kasus {
		t.Run(nama, func(t *testing.T) {
			token := buatToken(t, jwt.SigningMethodHS256, []byte(rahasiaUji), ubah)
			if got := panggil(t, "Bearer "+token); got != fiber.StatusUnauthorized {
				t.Errorf("status = %d, mau 401", got)
			}
		})
	}
}

// Serangan klasik: token dengan alg "none" yang mengaku sudah terverifikasi.
func TestRequireSupabaseAuthMenolakAlgNone(t *testing.T) {
	token := buatToken(t, jwt.SigningMethodNone, jwt.UnsafeAllowNoneSignatureType, nil)
	if got := panggil(t, "Bearer "+token); got != fiber.StatusUnauthorized {
		t.Errorf("status = %d, mau 401 — token alg=none tidak boleh diterima", got)
	}
}
