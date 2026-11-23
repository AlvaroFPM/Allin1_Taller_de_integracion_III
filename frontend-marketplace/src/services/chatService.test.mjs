import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('./chatService.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
}).outputText;

function setup(api) {
  const moduleObject = { exports: {} };

  vm.runInThisContext(`(function(require,module,exports){${compiled}\n})`)(
    (name) => {
      assert.equal(name, '@/lib/axios');
      return { __esModule: true, default: api };
    },
    moduleObject,
    moduleObject.exports,
  );

  return moduleObject.exports.chatService;
}

const sala = {
  idSala: 1,
  compradorId: 101,
  vendedorId: 202,
};

const mensaje = {
  idMensaje: 10,
  salaId: 1,
  remitenteId: 101,
  destinatarioId: 202,
  contenido: 'Mensaje de prueba',
};

const operaciones = [
  {
    nombre: 'crear o recuperar sala',
    metodo: 'post',
    ruta: '/v1/chat/rooms',
    request: { vendedorId: 202, publicacionId: 184 },
    respuesta: { sala },
    ejecutar: (service, signal) =>
      service.getOrCreateRoom({ vendedorId: 202, publicacionId: 184 }, signal),
  },
  {
    nombre: 'listar salas',
    metodo: 'get',
    ruta: '/v1/chat/rooms',
    respuesta: { salas: [sala] },
    ejecutar: (service, signal) => service.listRooms(signal),
  },
  {
    nombre: 'enviar mensaje',
    metodo: 'post',
    ruta: '/v1/chat/messages',
    request: { salaId: 1, destinatarioId: 202, contenido: 'Mensaje de prueba' },
    respuesta: { mensaje },
    ejecutar: (service, signal) =>
      service.sendMessage(
        { salaId: 1, destinatarioId: 202, contenido: 'Mensaje de prueba' },
        signal,
      ),
  },
  {
    nombre: 'consultar historial',
    metodo: 'get',
    ruta: '/v1/chat/rooms/1/messages',
    params: { limit: 2, offset: 4 },
    respuesta: { mensajes: [mensaje], total: 5 },
    ejecutar: (service, signal) => service.getMessages({ salaId: 1, limit: 2, offset: 4 }, signal),
  },
];

for (const caso of operaciones) {
  test(`${caso.nombre}: conserva ruta, datos y signal`, async () => {
    const controller = new AbortController();
    let llamadas = 0;

    const service = setup({
      [caso.metodo]: async (url, bodyOrOptions, options) => {
        llamadas++;
        const parsed = new URL(url);
        assert.equal(parsed.pathname, caso.ruta);

        const config = caso.metodo === 'post' ? options : bodyOrOptions;
        assert.equal(config.signal, controller.signal);

        if (caso.request) {
          assert.deepEqual(bodyOrOptions, caso.request);
          assert.equal(Object.hasOwn(bodyOrOptions, 'remitenteId'), false);
        }
        if (caso.params) {
          assert.deepEqual(config.params, caso.params);
        }

        return { data: caso.respuesta };
      },
    });

    assert.deepEqual(await caso.ejecutar(service, controller.signal), caso.respuesta);
    assert.equal(llamadas, 1);
  });

  for (const estado of [401, 403, 404, 500, undefined]) {
    test(`${caso.nombre}: propaga ${estado ?? 'error de red'} sin reintentar`, async () => {
      let llamadas = 0;
      const error = new Error('Error sintetico');
      if (estado !== undefined) {
        error.response = { status: estado };
      }

      const service = setup({
        [caso.metodo]: async () => {
          llamadas++;
          throw error;
        },
      });

      await assert.rejects(caso.ejecutar(service), (actual) => actual === error);
      assert.equal(llamadas, 1);
    });
  }
}

test('acepta listas e historial vacios confirmados por la API', async () => {
  const service = setup({
    get: async (url) => ({
      data: url.endsWith('/messages') ? { mensajes: [], total: 0 } : { salas: [] },
    }),
  });

  assert.deepEqual(await service.listRooms(), { salas: [] });
  assert.deepEqual(await service.getMessages({ salaId: 1 }), {
    mensajes: [],
    total: 0,
  });
});

test('rechaza salas y envios sin confirmacion valida', async () => {
  for (const data of [null, {}, { sala: {} }]) {
    const service = setup({ post: async () => ({ data }) });
    await assert.rejects(service.getOrCreateRoom({ vendedorId: 202 }), /sala válida/);
  }

  for (const data of [
    null,
    {},
    { mensaje: { ...mensaje, idMensaje: 0 } },
    { mensaje: { ...mensaje, salaId: 99 } },
    { mensaje: { ...mensaje, destinatarioId: 303 } },
  ]) {
    const service = setup({ post: async () => ({ data }) });
    await assert.rejects(
      service.sendMessage({
        salaId: 1,
        destinatarioId: 202,
        contenido: 'Mensaje de prueba',
      }),
      /no confirmó/,
    );
  }
});

test('rechaza listados e historiales con estructura incorrecta', async () => {
  for (const data of [null, {}, { salas: null }]) {
    const service = setup({ get: async () => ({ data }) });
    await assert.rejects(service.listRooms(), /lista de salas válida/);
  }

  for (const data of [
    null,
    {},
    { mensajes: [], total: -1 },
    { mensajes: [], total: 1.5 },
    { mensajes: [], total: '5' },
    { mensajes: [{ ...mensaje, salaId: 99 }], total: 1 },
  ]) {
    const service = setup({ get: async () => ({ data }) });
    await assert.rejects(service.getMessages({ salaId: 1 }), /historial válido/);
  }
});
