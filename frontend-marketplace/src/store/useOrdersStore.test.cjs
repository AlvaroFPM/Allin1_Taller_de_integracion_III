const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function setup() {
  const queries = {};
  const source = fs.readFileSync(path.join(__dirname, 'useOrdersStore.ts'), 'utf8');

  // Compila en memoria el archivo real; no genera archivos de salida.
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
      if (name === '@/services/ordersQueryService') {
        return { ordersQueryService: queries };
      }
      return require(name);
    },
    moduleObject,
    moduleObject.exports,
  );

  return { store: moduleObject.exports.useOrdersStore, queries };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test('compras: loading, datos y metadata; ventas permanece independiente', async () => {
  const { store, queries } = setup();
  const pending = deferred();
  queries.getPurchases = () => pending.promise;

  const request = store.getState().loadPurchases();

  assert.equal(store.getState().purchases.status, 'loading');
  assert.equal(store.getState().sales.status, 'idle');

  pending.resolve({
    orders: [{ idOrden: 1 }],
    meta: { totalRecords: '1' },
  });
  await request;

  assert.equal(store.getState().purchases.status, 'success');
  assert.equal(store.getState().purchases.orders[0].idOrden, 1);
  assert.equal(store.getState().purchases.meta.totalRecords, '1');
});

test('ventas: propaga parámetros y señal al servicio', async () => {
  const { store, queries } = setup();
  const params = { page: 2, limit: 10, estado: 'PENDIENTE' };
  const controller = new AbortController();

  queries.getSales = async (receivedParams, signal) => {
    assert.deepEqual(receivedParams, params);
    assert.equal(signal, controller.signal);
    return {};
  };

  await store.getState().loadSales(params, controller.signal);

  assert.equal(store.getState().sales.status, 'success');
  assert.deepEqual(store.getState().sales.orders, []);
  assert.equal(store.getState().purchases.status, 'idle');
});

test('un error no se convierte en éxito vacío', async () => {
  const { store, queries } = setup();
  queries.getPurchases = async () => {
    throw new Error('Fallo simulado');
  };

  await store.getState().loadPurchases();

  assert.equal(store.getState().purchases.status, 'error');
  assert.ok(store.getState().purchases.error);
  assert.equal(store.getState().sales.status, 'idle');
});

test('descarta una respuesta anterior que llega tarde', async () => {
  const { store, queries } = setup();
  const first = deferred();
  const second = deferred();
  let calls = 0;
  queries.getPurchases = () => (++calls === 1 ? first.promise : second.promise);

  const oldRequest = store.getState().loadPurchases();
  const newRequest = store.getState().loadPurchases();

  second.resolve({ orders: [{ idOrden: 2 }] });
  await newRequest;
  first.resolve({ orders: [{ idOrden: 1 }] });
  await oldRequest;

  assert.equal(store.getState().purchases.orders[0].idOrden, 2);
});

test('reset invalida solicitudes pendientes', async () => {
  const { store, queries } = setup();
  const pending = deferred();
  queries.getSales = () => pending.promise;

  const request = store.getState().loadSales();
  store.getState().reset();
  pending.resolve({ orders: [{ idOrden: 3 }] });
  await request;

  assert.equal(store.getState().sales.status, 'idle');
  assert.deepEqual(store.getState().sales.orders, []);
});

test('una solicitud cancelada vuelve a idle', async () => {
  const { store, queries } = setup();
  const pending = deferred();
  const controller = new AbortController();
  queries.getPurchases = () => pending.promise;

  const request = store.getState().loadPurchases({}, controller.signal);
  controller.abort();
  pending.resolve({ orders: [{ idOrden: 4 }] });
  await request;

  assert.equal(store.getState().purchases.status, 'idle');
  assert.deepEqual(store.getState().purchases.orders, []);
});
