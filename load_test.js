import http from 'k6/http';
import { check, sleep } from 'k6';

// Prueba de carga para el HPA de Catalog (ALL-122).
// Constante: k6 run -e BASE_URL=https://student-aalarcon.dev.censei.cl -e USERS=10 -e DURATION=2m load_test.js
// Rampa:     k6 run -e BASE_URL=https://student-aalarcon.dev.censei.cl -e MODE=ramp load_test.js
// Variables: BASE_URL (def. http://localhost:8082), MODE (constant|ramp), USERS, DURATION,
//            LEVELS (def. 1,5,10,20,40), HOLD (def. 90s), ENDPOINT.
// insecureSkipTLSVerify: el clúster usa certificado autofirmado.
const BASE_URL = (__ENV.BASE_URL || 'http://localhost:8082').replace(/\/+$/, '');
const MODE = __ENV.MODE || 'constant';
const USERS = Number(__ENV.USERS || 1);
const DURATION = __ENV.DURATION || '2m';
const LEVELS = (__ENV.LEVELS || '1,5,10,20,40').split(',').map(Number);
const HOLD = __ENV.HOLD || '90s';
// Misma petición que hace /explorar en el frontend.
const ENDPOINT = __ENV.ENDPOINT || '/v1/publications?limit=100';

function rampStages() {
  const stages = [];
  LEVELS.forEach(function (level) {
    stages.push({ duration: '10s', target: level });
    stages.push({ duration: HOLD, target: level });
  });
  stages.push({ duration: '30s', target: 0 });
  return stages;
}

export const options = Object.assign(
  {
    insecureSkipTLSVerify: true,
    thresholds: { http_req_failed: ['rate<0.05'] },
  },
  MODE === 'ramp' ? { stages: rampStages() } : { vus: USERS, duration: DURATION },
);

export function setup() {
  const res = http.get(BASE_URL + ENDPOINT);
  if (res.status !== 200) {
    throw new Error('Preflight fallido: ' + BASE_URL + ENDPOINT + ' respondió ' + res.status + '. Revisa BASE_URL.');
  }
}

export default function () {
  const res = http.get(BASE_URL + ENDPOINT);
  check(res, { 'responde HTTP 200': function (r) { return r.status === 200; } });
  sleep(1);
}
