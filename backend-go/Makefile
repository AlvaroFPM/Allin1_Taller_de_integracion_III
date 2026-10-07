.PHONY: generate clean deps install-deps

PROTO_DIR = api/proto
OUT_DIR = internal/api/pb
THIRD_PARTY_DIR = third_party/google/api
OPENAPI_DIR = api/openapi

generate: deps
	@echo "Generando código gRPC, Gateway y OpenAPI para Catálogo e IAM..."
	@mkdir -p $(OUT_DIR)/publication
	@mkdir -p $(OUT_DIR)/auth
	@mkdir -p $(OPENAPI_DIR)
	
	protoc -I=$(PROTO_DIR) -I=third_party \
		--go_out=$(OUT_DIR)/publication --go_opt=paths=source_relative \
		--go-grpc_out=$(OUT_DIR)/publication --go-grpc_opt=paths=source_relative \
		--grpc-gateway_out=$(OUT_DIR)/publication --grpc-gateway_opt=paths=source_relative \
		--openapiv2_out=$(OPENAPI_DIR) --openapiv2_opt=logtostderr=true \
		$(PROTO_DIR)/publication.proto

	protoc -I=$(PROTO_DIR) -I=third_party \
		--go_out=$(OUT_DIR)/auth --go_opt=paths=source_relative \
		--go-grpc_out=$(OUT_DIR)/auth --go-grpc_opt=paths=source_relative \
		--grpc-gateway_out=$(OUT_DIR)/auth --grpc-gateway_opt=paths=source_relative \
		--openapiv2_out=$(OPENAPI_DIR) --openapiv2_opt=logtostderr=true,openapi_configuration=$(OPENAPI_DIR)/auth.config.yaml \
		$(PROTO_DIR)/auth.proto
		
	@echo "Archivos OpenAPI generados:"
	@ls -1 $(OPENAPI_DIR)/*.swagger.json 2>/dev/null || true
	@echo "Generación completada exitosamente."

deps:
	@echo "Verificando dependencias de Google API..."
	@mkdir -p $(THIRD_PARTY_DIR)
	@curl -sSL -z $(THIRD_PARTY_DIR)/annotations.proto -o $(THIRD_PARTY_DIR)/annotations.proto https://raw.githubusercontent.com/googleapis/googleapis/master/google/api/annotations.proto
	@curl -sSL -z $(THIRD_PARTY_DIR)/http.proto -o $(THIRD_PARTY_DIR)/http.proto https://raw.githubusercontent.com/googleapis/googleapis/master/google/api/http.proto

clean:
	@echo "Limpiando archivos generados..."
	rm -rf $(OUT_DIR)/*
	rm -rf $(OPENAPI_DIR)/*.swagger.json

install-deps:
	@echo "Instalando dependencias de Go y plugins para gRPC/Gateway..."
	go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
	go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
	go install github.com/grpc-ecosystem/grpc-gateway/v2/protoc-gen-grpc-gateway@latest
	go install github.com/grpc-ecosystem/grpc-gateway/v2/protoc-gen-openapiv2@v2.30.0
	go get google.golang.org/grpc
	go get google.golang.org/protobuf
	go get github.com/grpc-ecosystem/grpc-gateway/v2/runtime
	@echo "Dependencias instaladas."
