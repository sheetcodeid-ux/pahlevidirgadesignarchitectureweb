// Package storage membungkus Cloudflare R2 lewat API S3-compatible.
//
// Gambar tidak pernah melewati backend Go: klien admin meminta presigned URL,
// lalu upload langsung ke R2. Itu menjaga instance Cloud Run tetap kecil dan
// bandwidth-nya tidak terpakai untuk file 10 MB.
package storage

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"path"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// allowedContentTypes membatasi apa yang boleh masuk bucket. Presigned URL
// mengunci Content-Type, jadi klien tidak bisa menaruh tipe lain.
var allowedContentTypes = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
	"image/avif": ".avif",
}

type R2 struct {
	presign *s3.PresignClient
	bucket  string
}

func NewR2(ctx context.Context, accountID, accessKeyID, secretAccessKey, bucket string) (*R2, error) {
	endpoint := fmt.Sprintf("https://%s.r2.cloudflarestorage.com", accountID)

	client := s3.New(s3.Options{
		Region:       "auto",
		BaseEndpoint: aws.String(endpoint),
		Credentials: credentials.NewStaticCredentialsProvider(
			accessKeyID, secretAccessKey, "",
		),
	})

	return &R2{presign: s3.NewPresignClient(client), bucket: bucket}, nil
}

type UploadTarget struct {
	Key       string    `json:"key"`
	UploadURL string    `json:"uploadUrl"`
	ExpiresAt time.Time `json:"expiresAt"`
}

// PresignUpload membuat URL PUT berumur pendek untuk satu file.
//
// Key dibentuk server-side dari slug proyek + suffix acak, bukan dari nama
// file kiriman klien, supaya tidak ada path traversal dan tidak ada file yang
// saling menimpa saat dua orang meng-upload "render-1.jpg".
func (r *R2) PresignUpload(ctx context.Context, projectSlug, contentType string) (*UploadTarget, error) {
	ext, ok := allowedContentTypes[contentType]
	if !ok {
		return nil, fmt.Errorf("tipe file %q tidak diizinkan", contentType)
	}

	suffix := make([]byte, 8)
	if _, err := rand.Read(suffix); err != nil {
		return nil, fmt.Errorf("buat nama file: %w", err)
	}

	key := path.Join("projects", sanitizeSlug(projectSlug), hex.EncodeToString(suffix)+ext)
	expiry := 15 * time.Minute

	req, err := r.presign.PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(r.bucket),
		Key:         aws.String(key),
		ContentType: aws.String(contentType),
	}, s3.WithPresignExpires(expiry))
	if err != nil {
		return nil, fmt.Errorf("presign upload: %w", err)
	}

	return &UploadTarget{
		Key:       key,
		UploadURL: req.URL,
		ExpiresAt: time.Now().Add(expiry),
	}, nil
}

func sanitizeSlug(slug string) string {
	cleaned := strings.Map(func(r rune) rune {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9', r == '-':
			return r
		case r >= 'A' && r <= 'Z':
			return r + ('a' - 'A')
		default:
			return '-'
		}
	}, slug)

	cleaned = strings.Trim(cleaned, "-")
	if cleaned == "" {
		return "untitled"
	}
	if len(cleaned) > 80 {
		cleaned = cleaned[:80]
	}
	return cleaned
}
