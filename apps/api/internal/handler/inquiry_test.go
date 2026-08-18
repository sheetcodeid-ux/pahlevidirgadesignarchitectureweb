package handler

import "testing"

func TestValidateInquiry(t *testing.T) {
	valid := func() inquiryRequest {
		return inquiryRequest{
			Name:    "Budi Santoso",
			Email:   "budi@example.com",
			Message: "Saya ingin konsultasi desain rumah tinggal dua lantai.",
		}
	}

	t.Run("kiriman valid diterima", func(t *testing.T) {
		req := valid()
		if err := validateInquiry(&req); err != nil {
			t.Fatalf("mau nil, dapat %v", err)
		}
	})

	t.Run("spasi di ujung dipangkas", func(t *testing.T) {
		req := valid()
		req.Name = "  Budi Santoso  "
		if err := validateInquiry(&req); err != nil {
			t.Fatalf("mau nil, dapat %v", err)
		}
		if req.Name != "Budi Santoso" {
			t.Errorf("nama = %q, mau dipangkas", req.Name)
		}
	})

	invalid := map[string]func(*inquiryRequest){
		"nama terlalu pendek":  func(r *inquiryRequest) { r.Name = "B" },
		"email tanpa domain":   func(r *inquiryRequest) { r.Email = "budi@" },
		"email kosong":         func(r *inquiryRequest) { r.Email = "" },
		"pesan terlalu pendek": func(r *inquiryRequest) { r.Message = "halo" },
		"telepon kepanjangan":  func(r *inquiryRequest) { r.Phone = string(make([]byte, 40)) },
	}

	for name, mutate := range invalid {
		t.Run(name, func(t *testing.T) {
			req := valid()
			mutate(&req)
			if err := validateInquiry(&req); err == nil {
				t.Error("mau error, dapat nil")
			}
		})
	}
}
