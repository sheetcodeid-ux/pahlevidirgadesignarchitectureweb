.PHONY: run build test lint tidy docker

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
