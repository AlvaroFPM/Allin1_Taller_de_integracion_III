/* eslint-disable no-console -- Script de integracion con resultados sanitizados. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import axios from 'axios';

function loadModule(path, dependencies) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;

  const moduleObject = { exports: {} };

  vm.runInThisContext(`(function(require,module,exports){${compiled}\n})`)(
    (name) => {
      if (!Object.hasOwn(dependencies, name)) {
        throw new Error(`Importacion no prevista: ${name}`);
      }
      return dependencies[name];
    },
    moduleObject,
    moduleObject.exports,
  );

  return moduleObject.exports;
}

async function main() {
  const base = process.env.NEXT_PUBLIC_CHAT_API_URL;
  assert.ok(base, 'Falta NEXT_PUBLIC_CHAT_API_URL');

  const parsed = new URL(base);
  assert.ok(
    ['localhost', '127.0.0.1'].includes(parsed.hostname),
    'Ejecutar solo contra el entorno local de pruebas',
  );

  const cuentas = ['A', 'B', 'C'].map((nombre) => ({
    token: process.env[`CHAT159_TOKEN_${nombre}`],
    id: Number(process.env[`CHAT159_ID_${nombre}`]),
  }));

  for (const cuenta of cuentas) {
    assert.ok(cuenta.token, 'Falta un token de prueba');
    assert.ok(Number.isInteger(cuenta.id) && cuenta.id > 0, 'ID invalido');
  }
  assert.equal(new Set(cuentas.map((cuenta) => cuenta.id)).size, 3);

  // Adaptadores de navegador en memoria. No simulan el servidor HTTP.
  const cookies = new Map();
  const cookieAdapter = {
    get: (key) => cookies.get(key),
    set: (key, value) => cookies.set(key, value),
    remove: (key) => cookies.delete(key),
  };

  const authCookies = loadModule('../lib/authCookies.ts', {
    'js-cookie': { __esModule: true, default: cookieAdapter },
  });

  const shared = loadModule('../lib/axios.ts', {
    axios,
    '@/lib/authCookies': authCookies,
    '@/store/useAuthStore': {
      useAuthStore: {
        getState: () => ({
          clearAuth: () => cookies.clear(),
        }),
      },
    },
  });

  shared.apiClient.defaults.timeout = 10000;

  const { chatService } = loadModule('./chatService.ts', {
    '@/lib/axios': { __esModule: true, default: shared.apiClient },
  });

  const [a, b, c] = cuentas;
  const sesion = (cuenta) => {
    authCookies.removeAuthTokens();
    authCookies.setAuthTokens(cuenta.token);
  };

  sesion(a);
  const primera = await chatService.getOrCreateRoom({ vendedorId: b.id });
  const salaId = primera.sala.idSala;

  const repetida = await chatService.getOrCreateRoom({ vendedorId: b.id });
  assert.equal(repetida.sala.idSala, salaId);
  console.log(`OK crear y recuperar sala ${salaId}`);

  const salas = await chatService.listRooms();
  assert.ok(salas.salas.some((sala) => sala.idSala === salaId));
  console.log('OK listar salas de A');

  const marca = `ALL159-${Date.now()}`;
  const envioA = await chatService.sendMessage({
    salaId,
    destinatarioId: b.id,
    contenido: `${marca}-A`,
  });
  assert.equal(envioA.mensaje.remitenteId, a.id);

  sesion(b);
  const envioB = await chatService.sendMessage({
    salaId,
    destinatarioId: a.id,
    contenido: `${marca}-B`,
  });
  assert.equal(envioB.mensaje.remitenteId, b.id);
  console.log('OK envio confirmado en ambos sentidos');

  for (const cuenta of [a, b]) {
    sesion(cuenta);

    const salasCuenta = await chatService.listRooms();
    assert.ok(salasCuenta.salas.some((sala) => sala.idSala === salaId));

    const historial = await chatService.getMessages({
      salaId,
      limit: 100,
      offset: 0,
    });

    for (const envio of [envioA, envioB]) {
      assert.ok(
        historial.mensajes.some(
          (mensaje) =>
            mensaje.idMensaje === envio.mensaje.idMensaje &&
            mensaje.contenido === envio.mensaje.contenido,
        ),
      );
    }
  }
  console.log('OK A y B recuperan ambos mensajes desde la API');

  sesion(c);

  const salasC = await chatService.listRooms();
  assert.ok(!salasC.salas.some((sala) => sala.idSala === salaId));

  await assert.rejects(
    chatService.getMessages({ salaId }),
    (error) => axios.isAxiosError(error) && error.response?.status === 403,
  );

  const textoRechazado = `${marca}-C-NO-GUARDAR`;
  await assert.rejects(
    chatService.sendMessage({
      salaId,
      destinatarioId: a.id,
      contenido: textoRechazado,
    }),
    (error) => axios.isAxiosError(error) && error.response?.status === 403,
  );
  console.log('OK C no lista la sala ni puede consultar o enviar');

  sesion(a);
  const final = await chatService.getMessages({
    salaId,
    limit: 100,
    offset: 0,
  });
  assert.ok(!final.mensajes.some((mensaje) => mensaje.contenido === textoRechazado));

  authCookies.removeAuthTokens();
  await assert.rejects(
    chatService.listRooms(),
    (error) => axios.isAxiosError(error) && error.response?.status === 401,
  );
  console.log('OK sin sesion se propaga HTTP 401');

  console.log(
    `INTEGRACION OK: sala=${salaId}; mensajes=${envioA.mensaje.idMensaje},${envioB.mensaje.idMensaje}`,
  );
}

main().catch((error) => {
  // No imprimir errores Axios completos: pueden contener Authorization.
  if (axios.isAxiosError(error)) {
    console.error(`INTEGRACION FALLIDA: HTTP ${error.response?.status ?? 'sin respuesta'}`);
  } else {
    console.error(`INTEGRACION FALLIDA: ${error.message}`);
  }
  process.exitCode = 1;
});
