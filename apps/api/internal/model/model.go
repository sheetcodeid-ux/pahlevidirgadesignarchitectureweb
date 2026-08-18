// Package model berisi tipe domain yang dipakai bersama oleh repository dan
// handler. Tag json menentukan bentuk respons API.
package model

import "time"

type Project struct {
	ID             string     `json:"id"`
	Slug           string     `json:"slug"`
	Title          string     `json:"title"`
	Subtitle       *string    `json:"subtitle,omitempty"`
	Summary        *string    `json:"summary,omitempty"`
	Description    *string    `json:"description,omitempty"`
	Category       string     `json:"category"`
	Location       *string    `json:"location,omitempty"`
	City           *string    `json:"city,omitempty"`
	Year           *int16     `json:"year,omitempty"`
	Client         *string    `json:"client,omitempty"`
	AreaSqm        *float64   `json:"areaSqm,omitempty"`
	LeadArchitect  *string    `json:"leadArchitect,omitempty"`
	CoverImageURL  *string    `json:"coverImageUrl,omitempty"`
	IsFeatured     bool       `json:"isFeatured"`
	SEOTitle       *string    `json:"seoTitle,omitempty"`
	SEODescription *string    `json:"seoDescription,omitempty"`
	PublishedAt    *time.Time `json:"publishedAt,omitempty"`
	Images         []Image    `json:"images,omitempty"`
}

type Image struct {
	ID          string  `json:"id"`
	URL         string  `json:"url"`
	AltText     *string `json:"altText,omitempty"`
	Caption     *string `json:"caption,omitempty"`
	Width       *int32  `json:"width,omitempty"`
	Height      *int32  `json:"height,omitempty"`
	BlurDataURL *string `json:"blurDataUrl,omitempty"`
	SortOrder   int32   `json:"sortOrder"`
}

// ProjectFilter membatasi query daftar proyek. Limit/Offset selalu diisi
// pemanggil setelah di-clamp di layer handler.
type ProjectFilter struct {
	Category string
	Featured bool
	Limit    int
	Offset   int
}

type Inquiry struct {
	Name        string
	Email       string
	Phone       *string
	ProjectType *string
	BudgetRange *string
	Message     string
	Source      *string
	IPHash      string
	UserAgent   string
}
