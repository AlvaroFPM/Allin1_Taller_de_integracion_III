const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function setup(patch) {
  const source = fs.readFileSync(path.join(__dirname, 'ordersMutationService.ts'), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;

  const moduleObject = { exports: {} };
  const wrapper = vm.runInThisContext(`(function(require, module, exports) { ${compiled}\n})`);

  wrapper(
    (name) => {
      if (name === '@/lib/axios') return { patch };
      throw new Error(`Importacion no prevista: ${name}`);
    },
    moduleObject,
    moduleObject.exports,
  );

  return moduleObject.exports.ordersMutationService;
}

for (const estado of ['ACEPTADA', 'COMPLETADA']) {
  test(`sintetico: envia PATCH ${estado} y devuelve la orden validada`, async () => {
    const order = { idOrden: 901, estado, precio: '9007199254740993' };
    const controller = new AbortController();
    let calls = 0;
    const service = setup(async (url, body, config) => {
      calls++;
      const base = process.env.NEXT_PUBLIC_ORDERS_API_URL || 'http://localhost:8084';
      assert.equal(url, `${base}/v1/orders/901`);
      assert.deepEqual(body, { nuevoEstado: estado });
      assert.deepEqual(Object.keys(body), ['nuevoEstado']);
      assert.equal(config.signal, controller.signal);
      return { data: { order } };
    });

    assert.equal(await service.patchStatus(901, estado, controller.signal), order);
    assert.equal(calls, 1);
  });
}

test('sintetico: rechaza IDs invalidos sin llamar a Axios', async () => {
  let calls = 0;
  const service = setup(async () => {
    calls++;
  });
  for (const id of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '901']) {
    await assert.rejects(service.patchStatus(id, 'ACEPTADA'), /Identificador/);
  }
  assert.equal(calls, 0);
});

test('sintetico: no permite cancelacion ni otros estados', async () => {
  let calls = 0;
  const service = setup(async () => {
    calls++;
  });
  for (const estado of ['CANCELADA', 'PENDIENTE', 'EN_PROCESO', '', null]) {
    await assert.rejects(service.patchStatus(901, estado), /Accion/);
  }
  assert.equal(calls, 0);
});

test('sintetico: rechaza respuestas sin orden, ID o estado esperado', async () => {
  const responses = [
    undefined,
    null,
    {},
    { message: 'ok' },
    { order: null },
    { order: [] },
    { order: {} },
    { order: { idOrden: 902, estado: 'ACEPTADA' } },
    { order: { idOrden: '901', estado: 'ACEPTADA' } },
    { order: { idOrden: 901, estado: 'PENDIENTE' } },
  ];

  for (const data of responses) {
    const service = setup(async () => ({ data }));
    await assert.rejects(service.patchStatus(901, 'ACEPTADA'), /Respuesta PATCH invalida/);
  }
});

test('sintetico: propaga fallos sin reintento automatico ni exito simulado', async () => {
  for (const status of [401, 403, 404, 409, 500, undefined]) {
    const failure = new Error('Fallo sintetico');
    if (status !== undefined) failure.response = { status };
    let calls = 0;
    const service = setup(async () => {
      calls++;
      throw failure;
    });

    await assert.rejects(service.patchStatus(901, 'COMPLETADA'), (error) => error === failure);
    assert.equal(calls, 1);
  }
});
