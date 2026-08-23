package handler

import (
	"testing"

	"github.com/pahlevidirga/architecture-web/apps/api/internal/model"
)

func ptr[T any](v T) *T { return &v }

func TestSlugSah(t *testing.T) {
	sah := []string{"rumah-tepi-sawah", "vila2024", "a", "kantor-kayu-bandung-2"}
	for _, s := range sah {
		if !slugSah(s) {
			t.Errorf("slugSah(%q) = false, mau true", s)
		}
	}

	tidak := map[string]string{
		"kosong":          "",
		"ada spasi":       "rumah tepi sawah",
		"huruf besar":     "Rumah-Tepi",
		"diawali hubung":  "-rumah",
		"diakhiri hubung": "rumah-",
		"garis bawah":     "rumah_tepi",
		"karakter aneh":   "rumah/../etc",
		"terlalu panjang": string(make([]byte, 130)),
	}
	for nama, s := range tidak {
		if slugSah(s) {
			t.Errorf("%s: slugSah(%q) = true, mau false", nama, s)
		}
	}
}

func TestPeriksaInput(t *testing.T) {
	t.Run("proyek baru wajib slug dan judul", func(t *testing.T) {
		if err := periksaInput(&model.ProjectInput{Slug: ptr("abc")}, true); err == nil {
			t.Error("mau error karena judul kosong")
		}
		if err := periksaInput(&model.ProjectInput{Slug: ptr("abc"), Title: ptr("ABC")}, true); err != nil {
			t.Errorf("mau nil, dapat %v", err)
		}
	})

	t.Run("pembaruan sebagian tidak wajib apa-apa", func(t *testing.T) {
		if err := periksaInput(&model.ProjectInput{City: ptr("Pontianak")}, false); err != nil {
			t.Errorf("mau nil, dapat %v", err)
		}
	})

	tolak := map[string]model.ProjectInput{
		"kategori karangan": {Category: ptr("kastil")},
		"status karangan":   {Status: ptr("terbit")},
		"tahun terlalu tua": {Year: ptr(int16(1800))},
		"tahun masa depan":  {Year: ptr(int16(2200))},
		"slug berspasi":     {Slug: ptr("rumah tepi")},
	}
	for nama, in := range tolak {
		t.Run(nama, func(t *testing.T) {
			if err := periksaInput(&in, false); err == nil {
				t.Error("mau error, dapat nil")
			}
		})
	}
}
