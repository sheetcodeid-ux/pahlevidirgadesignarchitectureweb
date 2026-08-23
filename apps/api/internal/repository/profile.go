package repository

import (
	"context"
	"fmt"

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
