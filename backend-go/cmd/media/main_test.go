package main

import (
	"context"
	"os"
	"os/exec"
	"strings"
	"testing"
	"time"
)

// Ejecutar main en otro proceso permite comprobar log.Fatal sin cerrar el test.
func TestStartupRejectsInvalidConfiguration(t *testing.T) {
	if os.Getenv("MEDIA_STARTUP_TEST") == "1" {
		main()
		return
	}
	for _, tc := range []struct{ name, jwt, want string }{
		{"missing JWT", "", "Configuracion requerida ausente: JWT_SECRET"},
		{"unavailable database", "test-only-not-a-real-secret", "Media no puede iniciar sin persistencia"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
			defer cancel()
			cmd := exec.CommandContext(ctx, os.Args[0], "-test.run=^TestStartupRejectsInvalidConfiguration$")
			// No cargar archivos .env ni credenciales del desarrollador.
			cmd.Dir = t.TempDir()
			for _, entry := range os.Environ() {
				key := strings.ToUpper(strings.SplitN(entry, "=", 2)[0])
				if !strings.HasPrefix(key, "DB_") && !strings.HasPrefix(key, "CLOUDINARY_") && key != "JWT_SECRET" && key != "MEDIA_STARTUP_TEST" {
					cmd.Env = append(cmd.Env, entry)
				}
			}
			cmd.Env = append(cmd.Env, "MEDIA_STARTUP_TEST=1", "JWT_SECRET="+tc.jwt,
				"DB_HOST=127.0.0.1", "DB_PORT=1", "DB_USER=test", "DB_PASSWORD=test", "DB_NAME=test",
				"CLOUDINARY_CLOUD_NAME=test", "CLOUDINARY_API_KEY=test", "CLOUDINARY_API_SECRET=test")
			out, err := cmd.CombinedOutput()
			if ctx.Err() != nil || err == nil || !strings.Contains(string(out), tc.want) {
				t.Fatalf("arranque: err=%v timeout=%v salida=%s", err, ctx.Err(), out)
			}
		})
	}
}
