# Variables
PROTO_DIR = api/proto
MODULE = github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go

# Generar código a partir de los archivos .proto
generate:
	@echo "Generando código gRPC y Gateway..."
	protoc -I=$(PROTO_DIR) \
		-I=third_party \
		--go_out=. --go_opt=module=$(MODULE) \
		--go-grpc_out=. --go-grpc_opt=module=$(MODULE) \
		--grpc-gateway_out=. --grpc-gateway_opt=module=$(MODULE) \
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
