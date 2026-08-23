.PHONY: run build test lint tidy docker verify-r2

run:
	go run ./cmd/server

build:
	go build -o bin/server ./cmd/server

test:
	go test ./... -race

lint:
	go vet ./...
	gofmt -l .

tidy:
	go mod tidy

docker:
	docker build -t pahlevidirga-api .

# Memeriksa penyimpanan R2 memakai kredensial dan SDK yang sama dengan server.
verify-r2:
	go run ./cmd/verifyr2
