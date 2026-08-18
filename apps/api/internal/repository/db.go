// Package repository membungkus seluruh akses Postgres (Supabase).
package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// NewPool membuka connection pool ke Supabase.
//
// Supabase free tier punya batas koneksi yang kecil, jadi pool sengaja
// dibatasi. Pakai connection string pooler (port 6543, mode transaction)
// bukan koneksi langsung ke port 5432 — Cloud Run bisa scale ke banyak
// instance dan koneksi langsung akan cepat kehabisan slot.
func NewPool(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("parse DATABASE_URL: %w", err)
	}

	cfg.MaxConns = 4
	cfg.MinConns = 0
	cfg.MaxConnIdleTime = 2 * time.Minute
	cfg.MaxConnLifetime = 30 * time.Minute

	// Pooler Supabase dalam mode transaction tidak mendukung prepared
	// statement bernama; matikan agar query tidak gagal acak.
	cfg.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("buka pool: %w", err)
	}

	pingCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping database: %w", err)
	}

	return pool, nil
}
