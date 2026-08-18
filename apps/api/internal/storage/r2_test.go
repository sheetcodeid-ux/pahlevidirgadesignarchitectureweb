package storage

import "testing"

func TestSanitizeSlug(t *testing.T) {
	cases := map[string]string{
		"Villa Ubud":             "villa-ubud",
		"rumah/../../etc/passwd": "rumah-------etc-passwd",
		"  ---  ":                "untitled",
		"":                       "untitled",
		"Kantor_Bandung 2026":    "kantor-bandung-2026",
	}

	for input, want := range cases {
		if got := sanitizeSlug(input); got != want {
			t.Errorf("sanitizeSlug(%q) = %q, mau %q", input, got, want)
		}
	}
}

func TestSanitizeSlugDibatasiPanjangnya(t *testing.T) {
	long := make([]byte, 200)
	for i := range long {
		long[i] = 'a'
	}
	if got := sanitizeSlug(string(long)); len(got) != 80 {
		t.Errorf("panjang slug = %d, mau 80", len(got))
	}
}
