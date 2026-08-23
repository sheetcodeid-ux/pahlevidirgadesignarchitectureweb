package repository

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/pahlevidirga/architecture-web/apps/api/internal/model"
)

// AdminRepository melayani panel admin. Berbeda dari ProjectRepository yang
// hanya menyajikan konten published untuk pengunjung, di sini draft ikut
// terlihat dan penulisan diizinkan.
type AdminRepository struct {
	pool      *pgxpool.Pool
	assetBase string
}

func NewAdminRepository(pool *pgxpool.Pool, assetBase string) *AdminRepository {
	return &AdminRepository{pool: pool, assetBase: strings.TrimSuffix(assetBase, "/")}
}

func (r *AdminRepository) url(key string) string {
	if key == "" {
		return ""
	}
	return r.assetBase + "/" + strings.TrimPrefix(key, "/")
}

// kolomBoleh membatasi field yang bisa ditulis lewat API. Daftar putih, bukan
// daftar hitam: kolom baru harus didaftarkan secara sadar sebelum bisa
// disunting dari luar.
var kolomBoleh = map[string]func(*model.ProjectInput) any{
	"slug":            func(i *model.ProjectInput) any { return i.Slug },
	"title":           func(i *model.ProjectInput) any { return i.Title },
	"subtitle":        func(i *model.ProjectInput) any { return i.Subtitle },
	"summary":         func(i *model.ProjectInput) any { return i.Summary },
	"description":     func(i *model.ProjectInput) any { return i.Description },
	"category":        func(i *model.ProjectInput) any { return i.Category },
	"status":          func(i *model.ProjectInput) any { return i.Status },
	"location":        func(i *model.ProjectInput) any { return i.Location },
	"city":            func(i *model.ProjectInput) any { return i.City },
	"year":            func(i *model.ProjectInput) any { return i.Year },
	"client":          func(i *model.ProjectInput) any { return i.Client },
	"area_sqm":        func(i *model.ProjectInput) any { return i.AreaSqm },
	"lead_architect":  func(i *model.ProjectInput) any { return i.LeadArchitect },
	"cover_image_key": func(i *model.ProjectInput) any { return i.CoverImageKey },
	"is_featured":     func(i *model.ProjectInput) any { return i.IsFeatured },
	"seo_title":       func(i *model.ProjectInput) any { return i.SEOTitle },
	"seo_description": func(i *model.ProjectInput) any { return i.SEODescription },
}

// Kolom bertipe enum perlu cast eksplisit karena parameter dikirim sebagai teks.
var castKolom = map[string]string{"category": "::public.project_category", "status": "::public.project_status"}

func kosong(v any) bool {
	switch t := v.(type) {
	case *string:
		return t == nil
	case *int16:
		return t == nil
	case *float64:
		return t == nil
	case *bool:
		return t == nil
	}
	return true
}

const adminKolom = `
	p.id, p.slug, p.title, p.subtitle, p.summary, p.description, p.category, p.status,
	p.location, p.city, p.year, p.client, p.area_sqm, p.lead_architect,
	p.cover_image_key, p.is_featured, p.seo_title, p.seo_description, p.published_at`

// ListAll mengembalikan seluruh proyek, termasuk draft dan arsip.
func (r *AdminRepository) ListAll(ctx context.Context) ([]model.Project, error) {
	rows, err := r.pool.Query(ctx, `select`+adminKolom+`
		from public.projects p
		order by p.sort_order, p.created_at desc`)
	if err != nil {
		return nil, fmt.Errorf("query proyek admin: %w", err)
	}
	defer rows.Close()

	out := []model.Project{}
	for rows.Next() {
		var p model.Project
		var cover *string
		if err := rows.Scan(
			&p.ID, &p.Slug, &p.Title, &p.Subtitle, &p.Summary, &p.Description, &p.Category, &p.Status,
			&p.Location, &p.City, &p.Year, &p.Client, &p.AreaSqm, &p.LeadArchitect,
			&cover, &p.IsFeatured, &p.SEOTitle, &p.SEODescription, &p.PublishedAt,
		); err != nil {
			return nil, fmt.Errorf("scan proyek admin: %w", err)
		}
		if cover != nil {
			u := r.url(*cover)
			p.CoverImageURL = &u
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// Create membuat proyek baru. Slug dan judul wajib; sisanya menyusul saat
// disunting.
func (r *AdminRepository) Create(ctx context.Context, in model.ProjectInput) (string, error) {
	if in.Slug == nil || in.Title == nil {
		return "", fmt.Errorf("slug dan judul wajib diisi")
	}

	var id string
	err := r.pool.QueryRow(ctx, `
		insert into public.projects (slug, title, category, status)
		values ($1, $2, coalesce($3, 'residential')::public.project_category, 'draft')
		returning id`, *in.Slug, *in.Title, in.Category).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("buat proyek: %w", err)
	}
	return id, nil
}

// Update menulis hanya field yang dikirim. published_at diisi otomatis saat
// proyek pertama kali diterbitkan, dan tidak pernah dimundurkan.
func (r *AdminRepository) Update(ctx context.Context, id string, in model.ProjectInput) error {
	set := make([]string, 0, len(kolomBoleh))
	args := []any{id}

	for kolom, ambil := range kolomBoleh {
		v := ambil(&in)
		if kosong(v) {
			continue
		}
		args = append(args, v)
		set = append(set, fmt.Sprintf("%s = $%d%s", kolom, len(args), castKolom[kolom]))
	}

	if len(set) == 0 {
		return nil
	}

	if in.Status != nil && *in.Status == "published" {
		set = append(set, "published_at = coalesce(published_at, now())")
	}

	sql := fmt.Sprintf("update public.projects set %s where id = $1::uuid", strings.Join(set, ", "))
	tag, err := r.pool.Exec(ctx, sql, args...)
	if err != nil {
		return fmt.Errorf("perbarui proyek: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *AdminRepository) Delete(ctx context.Context, id string) error {
	tag, err := r.pool.Exec(ctx, `delete from public.projects where id = $1::uuid`, id)
	if err != nil {
		return fmt.Errorf("hapus proyek: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// AddImage mencatat gambar yang berkasnya sudah sampai di R2.
func (r *AdminRepository) AddImage(ctx context.Context, projectID string, in model.ImageInput) (string, error) {
	var id string
	err := r.pool.QueryRow(ctx, `
		insert into public.project_images (project_id, storage_key, alt_text, caption, width, height, sort_order)
		values ($1::uuid, $2, $3, $4, $5, $6, $7)
		returning id`,
		projectID, in.StorageKey, in.AltText, in.Caption, in.Width, in.Height, in.SortOrder,
	).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("catat gambar: %w", err)
	}
	return id, nil
}

func (r *AdminRepository) DeleteImage(ctx context.Context, id string) error {
	tag, err := r.pool.Exec(ctx, `delete from public.project_images where id = $1::uuid`, id)
	if err != nil {
		return fmt.Errorf("hapus gambar: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ListInquiries mengembalikan pesan masuk, terbaru lebih dulu.
func (r *AdminRepository) ListInquiries(ctx context.Context, status string) ([]model.InquiryRecord, error) {
	rows, err := r.pool.Query(ctx, `
		select id, name, email, phone, project_type, budget_range, message, status, created_at
		from public.inquiries
		where ($1::text = '' or status::text = $1::text)
		order by created_at desc
		limit 200`, status)
	if err != nil {
		return nil, fmt.Errorf("query inquiry: %w", err)
	}
	defer rows.Close()

	out := []model.InquiryRecord{}
	for rows.Next() {
		var q model.InquiryRecord
		if err := rows.Scan(&q.ID, &q.Name, &q.Email, &q.Phone, &q.ProjectType,
			&q.BudgetRange, &q.Message, &q.Status, &q.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan inquiry: %w", err)
		}
		out = append(out, q)
	}
	return out, rows.Err()
}

func (r *AdminRepository) SetInquiryStatus(ctx context.Context, id, status string) error {
	tag, err := r.pool.Exec(ctx,
		`update public.inquiries set status = $2::public.inquiry_status where id = $1::uuid`, id, status)
	if err != nil {
		return fmt.Errorf("ubah status inquiry: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
