#!/usr/bin/env pwsh
# ==============================================================================
# install-deps.ps1 — Instala plugins de protoc y dependencias Go
# Equivalente PowerShell del target 'make install-deps' para entorno Windows.
# ==============================================================================

$ErrorActionPreference = "Stop"

Write-Host "`n=== Instalando plugins de protoc y dependencias Go ===" -ForegroundColor Cyan

# ---------------------------------------------------------------------------
# 1. Plugins de protoc (go install)
# ---------------------------------------------------------------------------
$plugins = @(
    @{ Name = "protoc-gen-go";           Package = "google.golang.org/protobuf/cmd/protoc-gen-go@latest" },
    @{ Name = "protoc-gen-go-grpc";      Package = "google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest" },
    @{ Name = "protoc-gen-grpc-gateway"; Package = "github.com/grpc-ecosystem/grpc-gateway/v2/protoc-gen-grpc-gateway@latest" },
    @{ Name = "protoc-gen-openapiv2";    Package = "github.com/grpc-ecosystem/grpc-gateway/v2/protoc-gen-openapiv2@v2.30.0" }
)

foreach ($plugin in $plugins) {
    Write-Host "  Instalando $($plugin.Name)..." -ForegroundColor Yellow
    go install $plugin.Package
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ERROR: No se pudo instalar $($plugin.Name)" -ForegroundColor Red
        exit 1
    }
}

# ---------------------------------------------------------------------------
# 2. Verificación: todos los plugins deben estar accesibles en PATH
# ---------------------------------------------------------------------------
Write-Host "`n=== Verificando plugins en PATH ===" -ForegroundColor Cyan
$allOk = $true

foreach ($plugin in $plugins) {
    $cmd = Get-Command $plugin.Name -ErrorAction SilentlyContinue
    if ($null -eq $cmd) {
        Write-Host "  FALTA: $($plugin.Name) no encontrado en PATH." -ForegroundColor Red
        $allOk = $false
    } else {
        Write-Host "  OK: $($plugin.Name) -> $($cmd.Source)" -ForegroundColor Green
    }
}

if (-not $allOk) {
    Write-Host "`n  ADVERTENCIA: Algunos plugins no se encontraron. Verifica que GOPATH/bin este en tu PATH." -ForegroundColor Red
    Write-Host '  Tip: $env:PATH += ";$(go env GOPATH)\bin"' -ForegroundColor Yellow
    exit 1
}

Write-Host "`n=== Dependencias instaladas correctamente ===" -ForegroundColor Green
