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

function setupSessionBoundary() {
  const { store, queries } = setup();
  const { create } = require('zustand');

  // Sesión sintética: no usa credenciales ni persistencia reales.
  const auth = create(() => ({
    user: { id: 101, name: 'Usuario sintetico A' },
    token: 'token-sintetico-A',
    isAuthenticated: true,
  }));

  let effect;
  const source = fs.readFileSync(
    path.join(__dirname, '../components/shared/orders-session-boundary.tsx'),
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
      if (name === 'react') {
        return {
          useEffect: (callback) => {
            effect = callback;
          },
        };
      }
      if (name === '@/store/useAuthStore') return { useAuthStore: auth };
      if (name === '@/store/useOrdersStore') return { useOrdersStore: store };
      return require(name);
    },
    moduleObject,
    moduleObject.exports,
  );

  const result = moduleObject.exports.OrdersSessionBoundary();
  assert.equal(result, null);
  assert.equal(typeof effect, 'function');

  return { store, queries, auth, mount: () => effect() };
}

async function seedSyntheticLists(store, queries) {
  queries.getPurchases = async () => ({ orders: [{ idOrden: 901 }] });
  queries.getSales = async () => ({ orders: [{ idOrden: 902 }] });
  await store.getState().loadPurchases();
  await store.getState().loadSales();
}

function assertOrdersReset(store) {
  for (const key of ['purchases', 'sales']) {
    const list = store.getState()[key];
    assert.deepEqual(list.orders, []);
    assert.equal(list.status, 'idle');
    assert.equal(list.meta, null);
    assert.equal(list.error, null);
  }
}

test('sesion: el montaje limpia ambas listas', async () => {
  const { store, queries, mount } = setupSessionBoundary();
  await seedSyntheticLists(store, queries);
  const cleanup = mount();
  try {
    assertOrdersReset(store);
  } finally {
    cleanup();
  }
});

test('sesion: cambiar usuario invalida una respuesta pendiente', async () => {
  const { store, queries, auth, mount } = setupSessionBoundary();
  const cleanup = mount();
  try {
    await seedSyntheticLists(store, queries);
    const pending = deferred();
    queries.getPurchases = () => pending.promise;
    const request = store.getState().loadPurchases();

    auth.setState({ user: { id: 102, name: 'Usuario sintetico B' } });
    assertOrdersReset(store);

    pending.resolve({ orders: [{ idOrden: 903 }] });
    await request;
    assertOrdersReset(store);
  } finally {
    cleanup();
  }
});

test('sesion: cambiar token limpia ambas listas', async () => {
  const { store, queries, auth, mount } = setupSessionBoundary();
  const cleanup = mount();
  try {
    await seedSyntheticLists(store, queries);
    auth.setState({ token: 'token-sintetico-B' });
    assertOrdersReset(store);
  } finally {
    cleanup();
  }
});

test('sesion: cierre de sesion limpia ambas listas', async () => {
  const { store, queries, auth, mount } = setupSessionBoundary();
  const cleanup = mount();
  try {
    await seedSyntheticLists(store, queries);
    auth.setState({ user: null, token: null, isAuthenticated: false });
    assertOrdersReset(store);
  } finally {
    cleanup();
  }
});

test('sesion: cambio de autenticacion sin cambiar identidad limpia listas', async () => {
  const { store, queries, auth, mount } = setupSessionBoundary();
  const cleanup = mount();
  try {
    await seedSyntheticLists(store, queries);
    auth.setState({ isAuthenticated: false });
    assertOrdersReset(store);
  } finally {
    cleanup();
  }
});

test('sesion: actualizar perfil con el mismo ID conserva listas', async () => {
  const { store, queries, auth, mount } = setupSessionBoundary();
  const cleanup = mount();
  try {
    await seedSyntheticLists(store, queries);
    const purchases = store.getState().purchases;
    const sales = store.getState().sales;
    auth.setState({ user: { id: 101, name: 'Perfil sintetico actualizado' } });
    assert.equal(store.getState().purchases, purchases);
    assert.equal(store.getState().sales, sales);
  } finally {
    cleanup();
  }
});

test('sesion: desmontaje limpia y elimina la suscripcion', async () => {
  const { store, queries, auth, mount } = setupSessionBoundary();
  const cleanup = mount();
  await seedSyntheticLists(store, queries);
  cleanup();
  assertOrdersReset(store);

  await seedSyntheticLists(store, queries);
  const purchases = store.getState().purchases;
  const sales = store.getState().sales;
  auth.setState({ token: 'token-sintetico-tras-desmontaje' });
  assert.equal(store.getState().purchases, purchases);
  assert.equal(store.getState().sales, sales);
});

function setupOrdersMapper() {
  const source = fs.readFileSync(path.join(__dirname, '../lib/mappers/orders.ts'), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const moduleObject = { exports: {} };
  const wrapper = vm.runInThisContext(`(function(require, module, exports) { ${compiled}\n})`);
  wrapper(require, moduleObject, moduleObject.exports);
  return moduleObject.exports.toDashboardOrder;
}

test('mapper: conserva estado e int64 sintético sin inventar pagos', () => {
  const result = setupOrdersMapper()(
    { idOrden: 901, estado: 'PENDIENTE', precio: '9007199254740993' },
    'COMPRA',
  );
  assert.equal(result.status, 'PENDIENTE');
  assert.equal(result.price, '9007199254740993');
  assert.equal(result.escrowSecured, null);
  assert.equal(result.type, null);
  assert.equal(result.currency, undefined);
  assert.equal(result.counterpartVerified, undefined);
});

test('mapper: contraparte correcta por lista sintética', () => {
  const map = setupOrdersMapper();
  const order = {
    idOrden: 902,
    idUsuarioComprador: 101,
    idUsuarioVendedor: 102,
    estado: 'ACEPTADA',
  };
  assert.equal(map(order, 'COMPRA').counterpartName, 'Usuario #102');
  assert.equal(map(order, 'VENTA').counterpartName, 'Usuario #101');
  assert.equal(map(order, 'VENTA').status, 'ACEPTADA');
});

test('mapper: rechaza ID ausente y estados no reconocidos', () => {
  const map = setupOrdersMapper();
  assert.throws(() => map({}, 'COMPRA'));
  assert.throws(() => map({ idOrden: 903, estado: 'PAGO_CUSTODIADO' }, 'COMPRA'));
});

test('mapper: monto y estado ausentes no se inventan', () => {
  const result = setupOrdersMapper()({ idOrden: 904 }, 'VENTA');
  assert.equal(result.status, 'ESTADO_ORDEN_UNSPECIFIED');
  assert.equal(result.price, null);
});
