#!/usr/bin/env pwsh
# ==============================================================================
# generate.ps1 — Genera codigo gRPC, Gateway y OpenAPI (Swagger) desde .proto
# Equivalente PowerShell de 'make deps generate' para entorno Windows.
# ==============================================================================

$ErrorActionPreference = "Stop"

$PROTO_DIR     = "api/proto"
$OUT_DIR       = "internal/api/pb"
$OPENAPI_DIR   = "api/openapi"
$THIRD_PARTY   = "third_party"
$GOOGLE_API    = "$THIRD_PARTY/google/api"

Write-Host "`n=== Generando codigo gRPC, Gateway y OpenAPI ===" -ForegroundColor Cyan

# ---------------------------------------------------------------------------
# 1. Descargar protos de google/api (si no existen)
# ---------------------------------------------------------------------------
Write-Host "`n  Verificando protos de google/api..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path $GOOGLE_API -Force | Out-Null

$googleProtos = @(
    @{ File = "annotations.proto"; Url = "https://raw.githubusercontent.com/googleapis/googleapis/master/google/api/annotations.proto" },
    @{ File = "http.proto";        Url = "https://raw.githubusercontent.com/googleapis/googleapis/master/google/api/http.proto" }
)

foreach ($proto in $googleProtos) {
    $dest = "$GOOGLE_API/$($proto.File)"
    if (-not (Test-Path $dest)) {
        Write-Host "    Descargando $($proto.File)..." -ForegroundColor Yellow
        Invoke-WebRequest -Uri $proto.Url -OutFile $dest -UseBasicParsing
    } else {
        Write-Host "    OK: $($proto.File) ya existe" -ForegroundColor Green
    }
}

# ---------------------------------------------------------------------------
# 2. Crear directorios de salida
# ---------------------------------------------------------------------------
Write-Host "`n  Creando directorios de salida..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path "$OUT_DIR/publication" -Force | Out-Null
New-Item -ItemType Directory -Path "$OUT_DIR/auth"        -Force | Out-Null
New-Item -ItemType Directory -Path $OPENAPI_DIR           -Force | Out-Null

# ---------------------------------------------------------------------------
# 3. Compilar publication.proto
# ---------------------------------------------------------------------------
Write-Host "`n  Compilando publication.proto..." -ForegroundColor Yellow
protoc "-I=$PROTO_DIR" "-I=$THIRD_PARTY" `
    "--go_out=$OUT_DIR/publication"           "--go_opt=paths=source_relative" `
    "--go-grpc_out=$OUT_DIR/publication"      "--go-grpc_opt=paths=source_relative" `
    "--grpc-gateway_out=$OUT_DIR/publication"  "--grpc-gateway_opt=paths=source_relative" `
    "--openapiv2_out=$OPENAPI_DIR"            "--openapiv2_opt=logtostderr=true" `
    "$PROTO_DIR/publication.proto"

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: Fallo la compilacion de publication.proto" -ForegroundColor Red
    exit 1
}
Write-Host "    OK" -ForegroundColor Green

# ---------------------------------------------------------------------------
# 4. Compilar auth.proto
# ---------------------------------------------------------------------------
Write-Host "  Compilando auth.proto..." -ForegroundColor Yellow
protoc "-I=$PROTO_DIR" "-I=$THIRD_PARTY" `
    "--go_out=$OUT_DIR/auth"           "--go_opt=paths=source_relative" `
    "--go-grpc_out=$OUT_DIR/auth"      "--go-grpc_opt=paths=source_relative" `
    "--grpc-gateway_out=$OUT_DIR/auth"  "--grpc-gateway_opt=paths=source_relative" `
    "--openapiv2_out=$OPENAPI_DIR"      "--openapiv2_opt=logtostderr=true" `
    "$PROTO_DIR/auth.proto"

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: Fallo la compilacion de auth.proto" -ForegroundColor Red
    exit 1
}
Write-Host "    OK" -ForegroundColor Green

# ---------------------------------------------------------------------------
# 5. Resumen de archivos generados
# ---------------------------------------------------------------------------
Write-Host "`n=== Generacion completada exitosamente ===" -ForegroundColor Green

Write-Host "`n  Archivos gRPC/Gateway generados en $OUT_DIR/:" -ForegroundColor Cyan
Get-ChildItem -Path $OUT_DIR -Recurse -File | ForEach-Object {
    $relativePath = $_.FullName.Substring((Resolve-Path .).Path.Length + 1)
    Write-Host "    $relativePath" -ForegroundColor White
}

Write-Host "`n  Archivos OpenAPI (Swagger) generados en $OPENAPI_DIR/:" -ForegroundColor Cyan
Get-ChildItem -Path $OPENAPI_DIR -File -Filter "*.json" | ForEach-Object {
    Write-Host "    $($_.Name)" -ForegroundColor White
}
