import http from 'k6/http';
import { sleep, check } from 'k6';

// Configuración de la prueba: 100 usuarios simultáneos durante 30 segundos
export const options = {
  vus: 100,
  duration: '30s',
};

// Lo que hace cada usuario virtual
export default function () {
  // Petición al microservicio de Catálogo (gRPC-Gateway)
  const res = http.get('http://localhost:8082/v1/publications');
  
  // Validar que el servidor responda correctamente (Código 200 OK)
  check(res, {
    'estado es 200': (r) => r.status === 200,
  });
  
  // Esperar 1 segundo antes de la siguiente petición
  sleep(1);
}
