// Command verifyr2 memeriksa apakah penyimpanan R2 benar-benar siap dipakai.
//
// Memakai kredensial dan SDK yang sama persis dengan yang dipakai server,
// sehingga yang diuji adalah jalur sungguhan — bukan tiruannya. Berkas uji
// selalu dihapus lagi di akhir, termasuk saat ada pemeriksaan yang gagal.
//
//	go run ./cmd/verifyr2
package main

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/joho/godotenv"
)

const (
	hijau = "\033[32m"
	merah = "\033[31m"
	redup = "\033[2m"
	reset = "\033[0m"
)

type hasil struct{ lolos, gagal int }

func (h *hasil) ok(label string) { h.lolos++; fmt.Printf("  %s✓%s %s\n", hijau, reset, label) }
func (h *hasil) no(label string, err error) {
	h.gagal++
	fmt.Printf("  %s✗%s %s\n    %s%v%s\n", merah, reset, label, redup, err, reset)
}

func main() {
	_ = godotenv.Load(".env")

	akun := os.Getenv("R2_ACCOUNT_ID")
	kunci := os.Getenv("R2_ACCESS_KEY_ID")
	rahasia := os.Getenv("R2_SECRET_ACCESS_KEY")
	bucket := os.Getenv("R2_BUCKET")
	publik := strings.TrimSuffix(os.Getenv("R2_PUBLIC_BASE_URL"), "/")

	var kurang []string
	for nama, v := range map[string]string{
		"R2_ACCOUNT_ID": akun, "R2_ACCESS_KEY_ID": kunci,
		"R2_SECRET_ACCESS_KEY": rahasia, "R2_BUCKET": bucket,
	} {
		if v == "" {
			kurang = append(kurang, nama)
		}
	}
	if len(kurang) > 0 {
		fmt.Fprintf(os.Stderr, "Environment variable belum diisi: %s\n", strings.Join(kurang, ", "))
		fmt.Fprintln(os.Stderr, "Isi apps/api/.env atau ekspor sebelum menjalankan.")
		os.Exit(2)
	}

	klien := s3.New(s3.Options{
		Region:       "auto",
		BaseEndpoint: aws.String(fmt.Sprintf("https://%s.r2.cloudflarestorage.com", akun)),
		Credentials:  credentials.NewStaticCredentialsProvider(kunci, rahasia, ""),
	})

	ctx, batal := context.WithTimeout(context.Background(), 45*time.Second)
	defer batal()

	h := &hasil{}
	objek := fmt.Sprintf("_verifikasi/%d.txt", time.Now().UnixNano())
	isi := []byte("verifikasi r2 pahlevidirga")

	fmt.Println("\nAkses bucket")
	if _, err := klien.HeadBucket(ctx, &s3.HeadBucketInput{Bucket: &bucket}); err != nil {
		h.no("bucket bisa dijangkau", err)
		// Tanpa akses bucket, sisa pemeriksaan pasti gagal juga.
		selesai(h, publik)
		return
	}
	h.ok("bucket bisa dijangkau")

	fmt.Println("\nTulis, baca, hapus")
	_, err := klien.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      &bucket,
		Key:         &objek,
		Body:        bytes.NewReader(isi),
		ContentType: aws.String("text/plain"),
	})
	if err != nil {
		h.no("token bisa menulis objek", err)
		selesai(h, publik)
		return
	}
	h.ok("token bisa menulis objek")

	// Bersihkan apa pun yang terjadi setelah ini.
	defer func() {
		_, _ = klien.DeleteObject(context.Background(), &s3.DeleteObjectInput{Bucket: &bucket, Key: &objek})
	}()

	get, err := klien.GetObject(ctx, &s3.GetObjectInput{Bucket: &bucket, Key: &objek})
	if err != nil {
		h.no("token bisa membaca objek", err)
	} else {
		terbaca, _ := io.ReadAll(get.Body)
		get.Body.Close()
		if bytes.Equal(terbaca, isi) {
			h.ok("token bisa membaca objek")
		} else {
			h.no("isi objek utuh", fmt.Errorf("isi berbeda dari yang ditulis"))
		}
	}

	fmt.Println("\nDomain publik")
	if publik == "" {
		fmt.Printf("  %s·%s R2_PUBLIC_BASE_URL kosong — dilewati\n", redup, reset)
		fmt.Printf("    %sTanpa custom domain, gambar tidak bisa disajikan ke pengunjung.%s\n", redup, reset)
	} else {
		url := publik + "/" + objek
		req, _ := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		resp, err := (&http.Client{Timeout: 15 * time.Second}).Do(req)
		switch {
		case err != nil:
			h.no("domain publik menyajikan objek", err)
		case resp.StatusCode == http.StatusOK:
			resp.Body.Close()
			h.ok("domain publik menyajikan objek")
		default:
			resp.Body.Close()
			h.no("domain publik menyajikan objek",
				fmt.Errorf("status %d — custom domain mungkin belum tersambung ke bucket ini", resp.StatusCode))
		}
	}

	fmt.Println("\nPresigned upload")
	// Inilah jalur yang dipakai panel admin: browser mengunggah langsung ke R2
	// dengan URL berbatas waktu, tanpa melewati server.
	pre := s3.NewPresignClient(klien)
	target, err := pre.PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket:      &bucket,
		Key:         aws.String(objek + ".presign"),
		ContentType: aws.String("image/webp"),
	}, s3.WithPresignExpires(5*time.Minute))
	if err != nil {
		h.no("presigned URL bisa dibuat", err)
	} else {
		h.ok("presigned URL bisa dibuat")

		req, _ := http.NewRequestWithContext(ctx, http.MethodPut, target.URL, bytes.NewReader(isi))
		req.Header.Set("Content-Type", "image/webp")
		resp, err := (&http.Client{Timeout: 20 * time.Second}).Do(req)
		if err != nil {
			h.no("unggahan lewat presigned URL diterima", err)
		} else {
			resp.Body.Close()
			if resp.StatusCode < 300 {
				h.ok("unggahan lewat presigned URL diterima")
				_, _ = klien.DeleteObject(ctx, &s3.DeleteObjectInput{
					Bucket: &bucket, Key: aws.String(objek + ".presign"),
				})
			} else {
				h.no("unggahan lewat presigned URL diterima", fmt.Errorf("status %d", resp.StatusCode))
			}
		}
	}

	selesai(h, publik)
}

func selesai(h *hasil, publik string) {
	fmt.Println()
	if h.gagal == 0 {
		fmt.Printf("%s%d pemeriksaan lolos.%s Penyimpanan siap.\n\n", hijau, h.lolos, reset)
		if publik == "" {
			fmt.Printf("%sSisa satu langkah: pasang custom domain di bucket, lalu isi R2_PUBLIC_BASE_URL.%s\n\n", redup, reset)
		}
		return
	}
	fmt.Printf("%s%d pemeriksaan gagal%s, %d lolos.\n\n", merah, h.gagal, reset, h.lolos)
	fmt.Printf("%sKalau semuanya gagal, periksa izin token R2 — butuh Object Read & Write.%s\n\n", redup, reset)
	os.Exit(1)
}
