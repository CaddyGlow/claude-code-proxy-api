.PHONY: help install check format build clean dev watch

# Default target
help:
	@echo "Dashboard Makefile - Available targets:"
	@echo "  install  - Install dashboard dependencies"
	@echo "  check    - Run quality checks (TypeScript + Biome)"
	@echo "  format   - Format dashboard code"
	@echo "  build    - Build dashboard for production"
	@echo "  clean    - Clean build artifacts"
	@echo "  dev      - Start development server"
	@echo "  watch    - Start development server with file watching"

# Installation
install:
	@echo "Installing dashboard dependencies..."
	bun install

# Quality checks
check:
	@echo "Running dashboard quality checks..."
	bun run check

# Code formatting
format:
	@echo "Formatting dashboard code..."
	bun run format

# Production build
build: check
	@echo "Building dashboard for production..."
	bun run build:prod
	@echo "✅ Dashboard built and copied to ../ccproxy/static/"

# Clean build artifacts
clean:
	@echo "Cleaning dashboard build artifacts..."
	@if [ -d "build" ]; then rm -rf build; fi
	@if [ -d "node_modules/.cache" ]; then rm -rf node_modules/.cache; fi
	@if [ -d "../ccproxy/static/dashboard" ]; then rm -rf ../ccproxy/static/dashboard; fi

# Development server
dev:
	@echo "Starting dashboard development server..."
	bun run dev

# Development server with file watching
watch:
	@echo "Starting dashboard with file watching..."
	bun run dev --watch
