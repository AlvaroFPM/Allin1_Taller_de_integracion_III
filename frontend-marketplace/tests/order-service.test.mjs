import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');

function setup(post) {
  const source = fs.readFileSync(
    new URL('../src/services/orderService.ts', import.meta.url),
    'utf8',
  );
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
      if (name === '@/lib/axios') return { post };
      throw new Error(`Importacion inesperada: ${name}`);
    },
    moduleObject,
    moduleObject.exports,
  );
  return moduleObject.exports.orderService;
}

const payload = {
  idUsuarioVendedor: 1,
  idPublicacion: 10,
  precio: '30000',
};

test('servicio sintetico: POST correcto mediante cliente compartido', async () => {
  let calls = 0;
  const data = { order: { idOrden: 90 } };
  const service = setup(async (url, body) => {
    calls++;
    const base = process.env.NEXT_PUBLIC_ORDERS_API_URL || 'http://localhost:8084';
    assert.equal(url, `${base}/v1/orders`);
    assert.deepEqual(body, payload);
    return { data };
  });
  assert.equal(await service.createOrder(payload), data);
  assert.equal(calls, 1);
});

test('servicio sintetico: IDs invalidos no envian POST', async () => {
  let calls = 0;
  const service = setup(async () => {
    calls++;
  });
  for (const field of ['idUsuarioVendedor', 'idPublicacion']) {
    for (const value of [0, -1, 1.5, '10', Number.MAX_SAFE_INTEGER + 1]) {
      await assert.rejects(service.createOrder({ ...payload, [field]: value }));
    }
  }
  assert.equal(calls, 0);
});

test('servicio sintetico: precio invalido no envia POST', async () => {
  let calls = 0;
  const service = setup(async () => {
    calls++;
  });
  for (const precio of ['', '0', '000', '-1', '1.5', 'abc']) {
    await assert.rejects(service.createOrder({ ...payload, precio }));
  }
  assert.equal(calls, 0);
});

test('servicio sintetico: respuesta sin ID valido no confirma creacion', async () => {
  for (const data of [
    null,
    {},
    { order: {} },
    { order: { idOrden: 0 } },
    { order: { idOrden: -1 } },
    { order: { idOrden: '90' } },
    { order: { idOrden: 1.5 } },
    { order: { idOrden: Number.MAX_SAFE_INTEGER + 1 } },
  ]) {
    const service = setup(async () => ({ data }));
    await assert.rejects(service.createOrder(payload), /no confirmó/);
  }
});

test('servicio sintetico: propaga errores sin reintento ni exito simulado', async () => {
  for (const status of [400, 401, 403, 409, 500, undefined]) {
    const failure = new Error('Fallo sintetico');
    if (status !== undefined) failure.response = { status };
    let calls = 0;
    const service = setup(async () => {
      calls++;
      throw failure;
    });
    await assert.rejects(service.createOrder(payload), (error) => error === failure);
    assert.equal(calls, 1);
  }
});
