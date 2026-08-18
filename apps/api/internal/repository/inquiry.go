package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/pahlevidirga/architecture-web/apps/api/internal/model"
)

type InquiryRepository struct {
	pool *pgxpool.Pool
}

func NewInquiryRepository(pool *pgxpool.Pool) *InquiryRepository {
	return &InquiryRepository{pool: pool}
}

// Create menyimpan satu submission form kontak dan mengembalikan id-nya.
func (r *InquiryRepository) Create(ctx context.Context, in model.Inquiry) (string, error) {
	var id string
	err := r.pool.QueryRow(ctx, `
		insert into public.inquiries
			(name, email, phone, project_type, budget_range, message, source, ip_hash, user_agent)
		values ($1, $2, $3, $4::public.project_category, $5, $6, $7, $8, $9)
		returning id`,
		in.Name, in.Email, in.Phone, in.ProjectType, in.BudgetRange,
		in.Message, in.Source, in.IPHash, in.UserAgent,
	).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("simpan inquiry: %w", err)
	}
	return id, nil
}
