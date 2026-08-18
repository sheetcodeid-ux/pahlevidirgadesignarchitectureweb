// Command server menjalankan HTTP API untuk website studio arsitektur.
package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/helmet"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/gofiber/fiber/v2/middleware/requestid"
	"github.com/joho/godotenv"

	"github.com/pahlevidirga/architecture-web/apps/api/internal/config"
	"github.com/pahlevidirga/architecture-web/apps/api/internal/handler"
	"github.com/pahlevidirga/architecture-web/apps/api/internal/mailer"
	"github.com/pahlevidirga/architecture-web/apps/api/internal/middleware"
	"github.com/pahlevidirga/architecture-web/apps/api/internal/repository"
	"github.com/pahlevidirga/architecture-web/apps/api/internal/storage"
)

func main() {
	if err := run(); err != nil {
		slog.Error("server berhenti karena error", "error", err)
		os.Exit(1)
	}
}

func run() error {
	// .env hanya untuk development; di Cloud Run environment sudah di-inject.
	_ = godotenv.Load(".env")

	cfg, err := config.Load()
	if err != nil {
		return err
	}

	slog.SetDefault(newLogger(cfg))

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	pool, err := repository.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	var store *storage.R2
	if cfg.StorageConfigured() {
		store, err = storage.NewR2(ctx, cfg.R2AccountID, cfg.R2AccessKeyID, cfg.R2SecretAccessKey, cfg.R2Bucket)
		if err != nil {
			return err
		}
	} else {
		slog.Warn("R2 belum dikonfigurasi; endpoint upload akan menolak request")
	}

	h := handler.New(
		cfg,
		repository.NewProjectRepository(pool, cfg.R2PublicBaseURL),
		repository.NewInquiryRepository(pool),
		store,
		mailer.NewResend(cfg.ResendAPIKey, cfg.InquiryFrom),
	)

	app := newApp(cfg)
	registerRoutes(app, cfg, h)

	serverErr := make(chan error, 1)
	go func() {
		slog.Info("server siap", "port", cfg.Port, "env", cfg.Env)
		serverErr <- app.Listen(":" + cfg.Port)
	}()

	select {
	case err := <-serverErr:
		return err
	case <-ctx.Done():
		slog.Info("sinyal shutdown diterima, menyelesaikan request berjalan")
		return app.ShutdownWithTimeout(cfg.ShutdownTimeout)
	}
}

func newApp(cfg *config.Config) *fiber.App {
	return fiber.New(fiber.Config{
		AppName:      "pahlevidirga-api",
		ErrorHandler: middleware.ErrorHandler(cfg.IsProduction()),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,

		// Body kecil: gambar tidak lewat sini, melainkan langsung ke R2
		// lewat presigned URL.
		BodyLimit: 1 << 20,

		// Traffic masuk lewat Cloudflare, jadi IP asli ada di CF-Connecting-IP.
		// Header ini hanya dipakai untuk rate limit dan sidik jari abuse —
		// jangan jadikan dasar keputusan otorisasi, karena siapa pun yang tahu
		// URL *.run.app bisa memalsukannya.
		ProxyHeader: "CF-Connecting-IP",

		DisableStartupMessage: cfg.IsProduction(),
	})
}

func registerRoutes(app *fiber.App, cfg *config.Config, h *handler.Handler) {
	app.Use(recover.New())
	app.Use(requestid.New())
	app.Use(helmet.New())
	app.Use(logger.New(logger.Config{
		Format: "${time} ${status} ${method} ${path} ${latency} ${locals:requestid}\n",
		Next: func(c *fiber.Ctx) bool {
			return c.Path() == "/healthz" // jangan penuhi log dengan probe
		},
	}))
	app.Use(cors.New(cors.Config{
		AllowOrigins: strings.Join(cfg.AllowedOrigins, ","),
		AllowMethods: "GET,POST,PATCH,DELETE,OPTIONS",
		AllowHeaders: "Origin,Content-Type,Accept,Authorization",
		MaxAge:       3600,
	}))

	app.Get("/healthz", h.Health)

	v1 := app.Group("/api/v1")

	v1.Get("/projects", h.ListProjects)
	v1.Get("/projects/:slug", h.GetProject)

	// Form kontak dibatasi ketat: 5 submission per IP per jam.
	v1.Post("/inquiries", limiter.New(limiter.Config{
		Max:        5,
		Expiration: time.Hour,
		KeyGenerator: func(c *fiber.Ctx) string {
			return c.IP()
		},
		LimitReached: func(c *fiber.Ctx) error {
			return fiber.NewError(fiber.StatusTooManyRequests,
				"terlalu banyak pengiriman, coba lagi nanti")
		},
	}), h.CreateInquiry)

	admin := v1.Group("/admin", middleware.RequireSupabaseAuth(cfg.SupabaseJWTSecret))
	admin.Get("/me", h.Me)
	admin.Post("/uploads", h.CreateUploadURL)
}

func newLogger(cfg *config.Config) *slog.Logger {
	if cfg.IsProduction() {
		// JSON supaya Cloud Logging bisa mem-parse field-nya.
		return slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	}
	return slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelDebug}))
}
