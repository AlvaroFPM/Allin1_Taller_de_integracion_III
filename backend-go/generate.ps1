$PROTO_DIR = "api\proto"
$OUT_DIR = "internal\api\pb"

Write-Host "Generando código gRPC y Gateway para Catálogo..."

# Crear subcarpeta aislada para publicaciones
if (-Not (Test-Path -Path "$OUT_DIR\publication")) {
    New-Item -ItemType Directory -Path "$OUT_DIR\publication" -Force | Out-Null
}
if (-Not (Test-Path -Path "third_party\google\api")) {
    New-Item -ItemType Directory -Path "third_party\google\api" -Force | Out-Null
}

# Descargar dependencias de google/api si faltan
if (-Not (Test-Path -Path "third_party\google\api\annotations.proto")) {
    Invoke-WebRequest -Uri "https://raw.githubusercontent.com/googleapis/googleapis/master/google/api/annotations.proto" -OutFile "third_party\google\api\annotations.proto"
}
if (-Not (Test-Path -Path "third_party\google\api\http.proto")) {
    Invoke-WebRequest -Uri "https://raw.githubusercontent.com/googleapis/googleapis/master/google/api/http.proto" -OutFile "third_party\google\api\http.proto"
}

# Compilar exclusivamente Publicaciones hacia su subcarpeta
protoc -I="api\proto" -I="third_party" `
  --go_out="$OUT_DIR\publication" --go_opt=paths=source_relative `
  --go-grpc_out="$OUT_DIR\publication" --go-grpc_opt=paths=source_relative `
  --grpc-gateway_out="$OUT_DIR\publication" --grpc-gateway_opt=paths=source_relative `
  "api\proto\publication.proto"

Write-Host "Generación de Publicaciones completada exitosamente."
