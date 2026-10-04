/**
 * scripts/wait-ports.js
 * Espera a que una lista de puertos TCP estén escuchando en localhost.
 * Compatible con Node.js 20+ (CommonJS, solo biblioteca estándar: net).
 *
 * Uso: node scripts/wait-ports.js 5433 5434 8081 8082 3000
 */

const net = require('net');

const TIMEOUT_SECONDS = 120;
const POLL_INTERVAL_MS = 3000;

const KNOWN_SERVICES = {
  5433: 'PostgreSQL IAM',
  5434: 'PostgreSQL Catalog',
  8081: 'IAM REST API',
  8082: 'Catalog REST API',
  3000: 'Frontend Marketplace'
};

const rawArgs = process.argv.slice(2);
const ports = rawArgs.map(Number).filter((p) => Number.isInteger(p) && p > 0 && p <= 65535);

if (ports.length === 0) {
  console.error('[ERROR] Debe proporcionar al menos un puerto para verificar.');
  console.error('Uso: node scripts/wait-ports.js <puerto1> <puerto2> ...');
  process.exit(1);
}

function checkPort(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let isResolved = false;

    const cleanup = () => {
      if (!isResolved) {
        isResolved = true;
        socket.destroy();
      }
    };

    socket.setTimeout(2000);

    socket.on('connect', () => {
      cleanup();
      resolve(true);
    });

    socket.on('timeout', () => {
      cleanup();
      resolve(false);
    });

    socket.on('error', () => {
      cleanup();
      resolve(false);
    });

    socket.connect(port, host);
  });
}

async function main() {
  console.log(`[INFO] Esperando hasta ${TIMEOUT_SECONDS}s a que respondan los puertos: ${ports.join(', ')}...`);

  const pendingPorts = new Set(ports);
  const startTime = Date.now();
  let lastProgressLog = 0;

  while (pendingPorts.size > 0) {
    const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);

    if (elapsedSeconds >= TIMEOUT_SECONDS) {
      const remainingList = Array.from(pendingPorts)
        .map((p) => `${p} (${KNOWN_SERVICES[p] || 'Servicio'})`)
        .join(', ');
      console.error(`\n[ERROR] Se agotó el tiempo de espera (${TIMEOUT_SECONDS}s).`);
      console.error(`[ERROR] Los siguientes puertos no respondieron: ${remainingList}`);
      process.exit(1);
    }

    const checkPromises = Array.from(pendingPorts).map(async (port) => {
      const isUp = await checkPort(port);
      return { port, isUp };
    });

    const results = await Promise.all(checkPromises);

    for (const { port, isUp } of results) {
      if (isUp && pendingPorts.has(port)) {
        pendingPorts.delete(port);
        const name = KNOWN_SERVICES[port] ? ` [${KNOWN_SERVICES[port]}]` : '';
        console.log(`[OK]   Puerto ${port}${name} respondiendo.`);
      }
    }

    if (pendingPorts.size === 0) {
      console.log('\n[OK]   Todos los servicios están respondiendo correctamente.');
      process.exit(0);
    }

    if (elapsedSeconds > 0 && elapsedSeconds % 15 === 0 && elapsedSeconds !== lastProgressLog) {
      lastProgressLog = elapsedSeconds;
      console.log(`[INFO] Esperando servicios pendientes (${pendingPorts.size} restantes)... (${elapsedSeconds}/${TIMEOUT_SECONDS}s)`);
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

main().catch((err) => {
  console.error('[ERROR] Error inesperado en wait-ports:', err.message);
  process.exit(1);
});
