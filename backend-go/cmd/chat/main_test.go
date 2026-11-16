package main

import (
	"context"
	"os"
	"os/exec"
	"strings"
	"testing"
	"time"
)

func TestChatStopsWhenDatabaseConfigurationIsInvalid(t *testing.T) {
	if os.Getenv("ALL148_CHAT_TEST_CHILD") == "1" {
		main()
		os.Exit(0)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cmd := exec.CommandContext(
		ctx,
		os.Args[0],
		"-test.run=^TestChatStopsWhenDatabaseConfigurationIsInvalid$",
	)
	cmd.Env = append(os.Environ(),
		"ALL148_CHAT_TEST_CHILD=1",
		"DB_HOST=127.0.0.1",
		"DB_PORT=55489",
		"DB_USER=chat_test",
		"DB_PASSWORD=temporary_test_only",
		"DB_NAME=chat_test",
		"DB_SSLMODE=all148_invalid_ssl_mode",
		"HTTP_PORT=18085",
		"GRPC_PORT=15054",
	)

	output, err := cmd.CombinedOutput()
	text := string(output)

	if ctx.Err() != nil {
		t.Fatalf("Chat no termino ante configuracion invalida:\n%s", text)
	}

	exitErr, ok := err.(*exec.ExitError)
	if !ok {
		t.Fatalf("Se esperaba salida 1; error recibido: %v\n%s", err, text)
	}
	if exitErr.ExitCode() != 1 {
		t.Fatalf("Salida esperada 1, recibida %d:\n%s", exitErr.ExitCode(), text)
	}

	if !strings.Contains(text, "se cancela el arranque") {
		t.Fatalf("Falta el mensaje de cancelacion:\n%s", text)
	}
	if strings.Contains(text, "escuchando en el puerto") {
		t.Fatalf("Chat intento iniciar servidores con BD invalida:\n%s", text)
	}
}
