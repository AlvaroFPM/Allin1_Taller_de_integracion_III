# Directorios
PROTO_DIR = api/proto
OUT_DIR = internal/api/pb

# Generar código a partir de los archivos .proto
generate:
	@echo "Generando código gRPC y Gateway..."
	@mkdir -p $(OUT_DIR)
	protoc -I=$(PROTO_DIR) \
		-I=third_party \
		--go_out=$(OUT_DIR) --go_opt=paths=source_relative \
		--go-grpc_out=$(OUT_DIR) --go-grpc_opt=paths=source_relative \
		--grpc-gateway_out=$(OUT_DIR) --grpc-gateway_opt=paths=source_relative \
		$(PROTO_DIR)/*.proto
	@echo "Generación completada."

# Instalar dependencias (requiere tener Go y protoc instalados)
install-deps:
	go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
	go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
	go install github.com/grpc-ecosystem/grpc-gateway/v2/protoc-gen-grpc-gateway@latest
	go install github.com/grpc-ecosystem/grpc-gateway/v2/protoc-gen-openapiv2@latest
	go get google.golang.org/grpc
	go get google.golang.org/protobuf
	go get github.com/grpc-ecosystem/grpc-gateway/v2/runtime

.PHONY: generate install-deps
