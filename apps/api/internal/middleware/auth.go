// Package middleware berisi middleware Fiber lintas-handler.
package middleware

import (
	"fmt"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

const (
	ContextUserID = "userID"
	ContextEmail  = "userEmail"
)

// RequireSupabaseAuth memverifikasi access token yang diterbitkan Supabase Auth.
//
// Ini mengasumsikan project memakai JWT secret simetris (HS256) — default
// Supabase. Kalau nanti kamu mengaktifkan signing key asimetris (ES256/RS256),
// verifikasi harus diganti ke pengambilan JWKS dari
// {SUPABASE_URL}/auth/v1/.well-known/jwks.json.
func RequireSupabaseAuth(jwtSecret string) fiber.Handler {
	secret := []byte(jwtSecret)

	return func(c *fiber.Ctx) error {
		raw := strings.TrimSpace(c.Get(fiber.HeaderAuthorization))
		if !strings.HasPrefix(strings.ToLower(raw), "bearer ") {
			return fiber.NewError(fiber.StatusUnauthorized, "token tidak ada")
		}

		token, err := jwt.Parse(
			strings.TrimSpace(raw[len("bearer "):]),
			func(t *jwt.Token) (any, error) {
				if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, fmt.Errorf("algoritma tidak didukung: %v", t.Header["alg"])
				}
				return secret, nil
			},
			jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Name}),
			jwt.WithAudience("authenticated"),
			jwt.WithExpirationRequired(),
		)
		if err != nil || !token.Valid {
			return fiber.NewError(fiber.StatusUnauthorized, "token tidak valid")
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			return fiber.NewError(fiber.StatusUnauthorized, "claim token tidak terbaca")
		}

		sub, _ := claims["sub"].(string)
		if sub == "" {
			return fiber.NewError(fiber.StatusUnauthorized, "token tanpa subject")
		}

		c.Locals(ContextUserID, sub)
		if email, ok := claims["email"].(string); ok {
			c.Locals(ContextEmail, email)
		}

		return c.Next()
	}
}
