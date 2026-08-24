# Image netral: jalan sama saja di Cloud Run, Render, atau Fly —
# yang dibutuhkan cuma menghormati environment variable PORT.

FROM golang:1.25-alpine AS build
WORKDIR /src

# Layer dependency terpisah supaya cache tidak invalid tiap kali kode berubah.
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build \
    -trimpath -ldflags="-s -w" \
    -o /out/server ./cmd/server

FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app

# Sertifikat CA dibutuhkan untuk panggilan TLS ke Supabase, R2, dan Resend.
COPY --from=build /out/server /app/server

USER nonroot:nonroot
EXPOSE 8080
ENV PORT=8080

ENTRYPOINT ["/app/server"]
