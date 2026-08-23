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
	Status         string     `json:"status,omitempty"`
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

// InquiryRecord adalah satu baris pesan masuk sebagaimana dibaca staf.
type InquiryRecord struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Email       string    `json:"email"`
	Phone       *string   `json:"phone,omitempty"`
	ProjectType *string   `json:"projectType,omitempty"`
	BudgetRange *string   `json:"budgetRange,omitempty"`
	Message     string    `json:"message"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"createdAt"`
}

// ProjectInput menampung field yang boleh disunting staf. Pointer nil berarti
// "jangan diubah", sehingga satu tipe melayani pembuatan dan pembaruan
// sebagian.
type ProjectInput struct {
	Slug           *string  `json:"slug"`
	Title          *string  `json:"title"`
	Subtitle       *string  `json:"subtitle"`
	Summary        *string  `json:"summary"`
	Description    *string  `json:"description"`
	Category       *string  `json:"category"`
	Status         *string  `json:"status"`
	Location       *string  `json:"location"`
	City           *string  `json:"city"`
	Year           *int16   `json:"year"`
	Client         *string  `json:"client"`
	AreaSqm        *float64 `json:"areaSqm"`
	LeadArchitect  *string  `json:"leadArchitect"`
	CoverImageKey  *string  `json:"coverImageKey"`
	IsFeatured     *bool    `json:"isFeatured"`
	SEOTitle       *string  `json:"seoTitle"`
	SEODescription *string  `json:"seoDescription"`
}

// ImageInput adalah metadata gambar yang dicatat setelah berkasnya sampai di R2.
type ImageInput struct {
	StorageKey string  `json:"storageKey"`
	AltText    *string `json:"altText"`
	Caption    *string `json:"caption"`
	Width      *int32  `json:"width"`
	Height     *int32  `json:"height"`
	SortOrder  int32   `json:"sortOrder"`
}
