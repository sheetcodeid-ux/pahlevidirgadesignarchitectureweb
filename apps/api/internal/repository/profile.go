package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ProfileRepository struct {
	pool *pgxpool.Pool
}

func NewProfileRepository(pool *pgxpool.Pool) *ProfileRepository {
	return &ProfileRepository{pool: pool}
}

// IsStaff menentukan apakah sebuah user berhak mengelola konten.
//
// Backend terhubung ke Postgres dengan kredensial yang melewati RLS, jadi
// policy is_staff() di database TIDAK melindungi endpoint admin — pengecekan
// itu harus diulang di sini.
func (r *ProfileRepository) IsStaff(ctx context.Context, userID string) (bool, error) {
	var ada bool
	err := r.pool.QueryRow(ctx,
		`select exists (select 1 from public.profiles where id = $1::uuid)`,
		userID,
	).Scan(&ada)
	if err != nil {
		return false, fmt.Errorf("periksa status staf: %w", err)
	}
	return ada, nil
}

// Role mengembalikan peran staf: "admin" (master admin) atau "editor".
// Peran kosong berarti user tidak terdaftar sebagai staf.
func (r *ProfileRepository) Role(ctx context.Context, userID string) (string, error) {
	var role string
	err := r.pool.QueryRow(ctx,
		`select role from public.profiles where id = $1::uuid`,
		userID,
	).Scan(&role)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("baca peran staf: %w", err)
	}
	return role, nil
}
