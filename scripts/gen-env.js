/**
 * scripts/gen-env.js
 * Genera y completa variables de entorno obligatorias en .env de forma segura.
 * Compatible con Node.js 20+ (CommonJS, solo biblioteca estándar).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT_DIR = path.resolve(__dirname, '..');
const ENV_PATH = path.join(ROOT_DIR, '.env');
const ENV_EXAMPLE_PATH = path.join(ROOT_DIR, '.env.example');

// Variables obligatorias requeridas por docker-compose.yml
const REQUIRED_VARS = [
  'JWT_SECRET',
  'POSTGRES_PASSWORD_IAM',
  'POSTGRES_PASSWORD_CATALOG'
];

// Valores reconocidos como placeholders que deben reemplazarse
const PLACEHOLDER_VALUES = ['cambia_esta_password'];

function isPlaceholderOrEmpty(value) {
  if (value === undefined || value === null) return true;
  const trimmed = value.trim();
  if (trimmed === '') return true;
  if (PLACEHOLDER_VALUES.includes(trimmed)) return true;
  if (trimmed.startsWith('REEMPLAZAR')) return true;
  return false;
}

function generateSecret() {
  return crypto.randomBytes(32).toString('hex');
}

function detectLineEnding(content) {
  const crlfCount = (content.match(/\r\n/g) || []).length;
  const lfCount = (content.match(/[^\r]\n/g) || []).length;
  return crlfCount > lfCount ? '\r\n' : '\n';
}

function runCheck() {
  if (!fs.existsSync(ENV_PATH)) {
    console.error('[ERROR] El archivo .env no existe. Ejecuta "make env" para crearlo.');
    process.exit(1);
  }

  const content = fs.readFileSync(ENV_PATH, 'utf8');
  const missing = [];

  for (const varName of REQUIRED_VARS) {
    const regex = new RegExp(`^[ \\t]*${varName}[ \\t]*=(.*)$`, 'm');
    const match = content.match(regex);
    if (!match || isPlaceholderOrEmpty(match[1])) {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    console.error(`[ERROR] Faltan variables obligatorias o tienen placeholders en .env: ${missing.join(', ')}`);
    process.exit(1);
  }

  console.log('[OK] Todas las variables obligatorias en .env están configuradas.');
  process.exit(0);
}

function runGen() {
  let content = '';
  let eol = '\n';

  if (!fs.existsSync(ENV_PATH)) {
    if (!fs.existsSync(ENV_EXAMPLE_PATH)) {
      console.error('[ERROR] No se encontró .env.example para copiar como plantilla.');
      process.exit(1);
    }
    console.log('[INFO] Copiando .env.example a .env...');
    content = fs.readFileSync(ENV_EXAMPLE_PATH, 'utf8');
    eol = detectLineEnding(content);
  } else {
    content = fs.readFileSync(ENV_PATH, 'utf8');
    // Eliminar posible BOM inicial
    if (content.charCodeAt(0) === 0xFEFF) {
      content = content.slice(1);
    }
    eol = detectLineEnding(content);
  }

  const generated = [];

  for (const varName of REQUIRED_VARS) {
    const regex = new RegExp(`^[ \\t]*${varName}[ \\t]*=(.*)$`, 'm');
    const match = content.match(regex);

    if (match) {
      const val = match[1];
      if (isPlaceholderOrEmpty(val)) {
        const secret = generateSecret();
        content = content.replace(regex, `${varName}=${secret}`);
        generated.push(varName);
      }
    } else {
      const secret = generateSecret();
      // Si la variable no existía en el archivo, agregarla al final respetando EOL
      if (!content.endsWith(eol) && content.length > 0) {
        content += eol;
      }
      content += `${varName}=${secret}${eol}`;
      generated.push(varName);
    }
  }

  // Escribir archivo en UTF-8 sin BOM
  fs.writeFileSync(ENV_PATH, content, { encoding: 'utf8' });

  if (generated.length > 0) {
    console.log(`[OK] Secretos generados automáticamente para: ${generated.join(', ')}`);
    console.log('[INFO] (Los valores son aleatorios y seguros; nunca se imprimen en consola).');
  } else {
    console.log('[OK] Todos los secretos en .env ya tienen valores configurados.');
  }
}

// Punto de entrada
const args = process.argv.slice(2);
if (args.includes('--check')) {
  runCheck();
} else {
  runGen();
}
