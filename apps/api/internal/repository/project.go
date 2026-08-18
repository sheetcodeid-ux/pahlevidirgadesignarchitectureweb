package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/pahlevidirga/architecture-web/apps/api/internal/model"
)

// ErrNotFound dikembalikan saat slug proyek tidak ada atau belum published.
var ErrNotFound = errors.New("resource tidak ditemukan")

type ProjectRepository struct {
	pool      *pgxpool.Pool
	assetBase string
}

func NewProjectRepository(pool *pgxpool.Pool, assetBase string) *ProjectRepository {
	return &ProjectRepository{pool: pool, assetBase: strings.TrimSuffix(assetBase, "/")}
}

// url menyusun URL publik dari storage key. Key disimpan tanpa domain supaya
// pindah CDN cukup mengganti satu environment variable.
func (r *ProjectRepository) url(key string) string {
	if key == "" {
		return ""
	}
	return r.assetBase + "/" + strings.TrimPrefix(key, "/")
}

const projectColumns = `
	p.id, p.slug, p.title, p.subtitle, p.summary, p.category,
	p.location, p.city, p.year, p.client, p.area_sqm, p.lead_architect,
	p.cover_image_key, p.is_featured, p.published_at`

// List mengembalikan proyek published untuk grid portfolio. Description
// sengaja tidak ikut supaya payload listing tetap ringan.
func (r *ProjectRepository) List(ctx context.Context, f model.ProjectFilter) ([]model.Project, error) {
	query := `select` + projectColumns + `
		from public.projects p
		where p.status = 'published'
		  and ($1::text = '' or p.category::text = $1::text)
		  and (not $2::boolean or p.is_featured)
		order by p.is_featured desc, p.sort_order, p.published_at desc nulls last
		limit $3 offset $4`

	rows, err := r.pool.Query(ctx, query, f.Category, f.Featured, f.Limit, f.Offset)
	if err != nil {
		return nil, fmt.Errorf("query daftar proyek: %w", err)
	}
	defer rows.Close()

	projects := make([]model.Project, 0, f.Limit)
	for rows.Next() {
		p, err := scanProject(rows, r)
		if err != nil {
			return nil, err
		}
		projects = append(projects, p)
	}
	return projects, rows.Err()
}

// GetBySlug mengambil satu proyek published lengkap dengan galerinya.
func (r *ProjectRepository) GetBySlug(ctx context.Context, slug string) (*model.Project, error) {
	query := `select` + projectColumns + `, p.description, p.seo_title, p.seo_description
		from public.projects p
		where p.status = 'published' and p.slug = $1`

	row := r.pool.QueryRow(ctx, query, slug)

	var p model.Project
	var coverKey *string
	err := row.Scan(
		&p.ID, &p.Slug, &p.Title, &p.Subtitle, &p.Summary, &p.Category,
		&p.Location, &p.City, &p.Year, &p.Client, &p.AreaSqm, &p.LeadArchitect,
		&coverKey, &p.IsFeatured, &p.PublishedAt,
		&p.Description, &p.SEOTitle, &p.SEODescription,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("query proyek %q: %w", slug, err)
	}
	if coverKey != nil {
		u := r.url(*coverKey)
		p.CoverImageURL = &u
	}

	images, err := r.imagesFor(ctx, p.ID)
	if err != nil {
		return nil, err
	}
	p.Images = images

	return &p, nil
}

func (r *ProjectRepository) imagesFor(ctx context.Context, projectID string) ([]model.Image, error) {
	rows, err := r.pool.Query(ctx, `
		select id, storage_key, alt_text, caption, width, height, blur_data_url, sort_order
		from public.project_images
		where project_id = $1
		order by sort_order, created_at`, projectID)
	if err != nil {
		return nil, fmt.Errorf("query gambar proyek: %w", err)
	}
	defer rows.Close()

	var images []model.Image
	for rows.Next() {
		var img model.Image
		var key string
		if err := rows.Scan(&img.ID, &key, &img.AltText, &img.Caption,
			&img.Width, &img.Height, &img.BlurDataURL, &img.SortOrder); err != nil {
			return nil, fmt.Errorf("scan gambar proyek: %w", err)
		}
		img.URL = r.url(key)
		images = append(images, img)
	}
	return images, rows.Err()
}

func scanProject(rows pgx.Rows, r *ProjectRepository) (model.Project, error) {
	var p model.Project
	var coverKey *string
	if err := rows.Scan(
		&p.ID, &p.Slug, &p.Title, &p.Subtitle, &p.Summary, &p.Category,
		&p.Location, &p.City, &p.Year, &p.Client, &p.AreaSqm, &p.LeadArchitect,
		&coverKey, &p.IsFeatured, &p.PublishedAt,
	); err != nil {
		return p, fmt.Errorf("scan proyek: %w", err)
	}
	if coverKey != nil {
		u := r.url(*coverKey)
		p.CoverImageURL = &u
	}
	return p, nil
}
