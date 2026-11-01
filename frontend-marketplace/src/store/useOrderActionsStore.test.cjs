const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { create } = require('zustand');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setup({ userId = 20, estado = 'PENDIENTE' } = {}) {
  const auth = create(() => ({
    user: { id: userId },
    token: 'token-sintetico',
    isAuthenticated: true,
  }));
  const order = {
    idOrden: 901,
    idUsuarioComprador: 10,
    idUsuarioVendedor: 20,
    estado,
  };
  const calls = [];
  const refreshes = [];
  const list = (orders, page) => ({
    orders,
    meta: { currentPage: page },
    status: 'success',
    error: null,
  });

  const lists = create(() => ({
    purchases: list([], 2),
    sales: list([order], 3),
    loadPurchases: async (params, signal) => {
      refreshes.push({ key: 'purchases', params, signal });
    },
    loadSales: async (params, signal) => {
      refreshes.push({ key: 'sales', params, signal });
    },
  }));

  const mutations = {
    patchStatus: async (id, next, signal) => {
      calls.push({ id, next, signal });
      return { ...order, estado: next };
    },
  };

  const source = fs.readFileSync(path.join(__dirname, 'useOrderActionsStore.ts'), 'utf8');
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
      if (name === '@/store/useAuthStore') return { useAuthStore: auth };
      if (name === '@/store/useOrdersStore') return { useOrdersStore: lists };
      if (name === '@/services/ordersMutationService') {
        return { ordersMutationService: mutations };
      }
      return require(name);
    },
    moduleObject,
    moduleObject.exports,
  );

  return {
    store: moduleObject.exports.useOrderActionsStore,
    auth,
    lists,
    mutations,
    calls,
    refreshes,
    order,
  };
}

for (const scenario of [
  { name: 'vendedor acepta', userId: 20, estado: 'PENDIENTE', next: 'ACEPTADA' },
  { name: 'vendedor completa', userId: 20, estado: 'ACEPTADA', next: 'COMPLETADA' },
  { name: 'comprador completa', userId: 10, estado: 'ACEPTADA', next: 'COMPLETADA' },
]) {
  test(`sintetico: ${scenario.name}`, async () => {
    const ctx = setup(scenario);
    await ctx.store.getState().changeStatus(901, scenario.next);
    assert.equal(ctx.calls.length, 1);
    assert.equal(ctx.store.getState().actions[901].pending, false);
    assert.equal(ctx.store.getState().actions[901].error, null);
    assert.deepEqual(
      ctx.refreshes.map(({ key, params }) => ({ key, params })),
      [
        { key: 'purchases', params: { page: 2 } },
        { key: 'sales', params: { page: 3 } },
      ],
    );
  });
}

test('sintetico: rechaza permisos y transiciones invalidas sin PATCH', async () => {
  for (const scenario of [
    { userId: 10, estado: 'PENDIENTE', next: 'ACEPTADA' },
    { userId: 99, estado: 'ACEPTADA', next: 'COMPLETADA' },
    { userId: 20, estado: 'PENDIENTE', next: 'COMPLETADA' },
    { userId: 20, estado: 'COMPLETADA', next: 'ACEPTADA' },
    { userId: 20, estado: 'CANCELADA', next: 'ACEPTADA' },
    { userId: 20, estado: 'ACEPTADA', next: 'CANCELADA' },
  ]) {
    const ctx = setup(scenario);
    await ctx.store.getState().changeStatus(901, scenario.next);
    assert.equal(ctx.calls.length, 0);
    assert.equal(ctx.refreshes.length, 0);
    assert.ok(ctx.store.getState().actions[901].error);
  }
});

test('sintetico: bloquea doble envio antes de resolver el PATCH', async () => {
  const ctx = setup();
  const pending = deferred();
  let calls = 0;
  ctx.mutations.patchStatus = () => {
    calls++;
    return pending.promise;
  };

  const first = ctx.store.getState().changeStatus(901, 'ACEPTADA');
  assert.equal(ctx.store.getState().actions[901].pending, true);
  await ctx.store.getState().changeStatus(901, 'ACEPTADA');
  assert.equal(calls, 1);
  assert.equal(ctx.refreshes.length, 0);

  pending.resolve({ ...ctx.order, estado: 'ACEPTADA' });
  await first;
  assert.equal(ctx.store.getState().actions[901].pending, false);
});

test('sintetico: fallo PATCH conserva listas y no refresca', async () => {
  const ctx = setup();
  const previous = ctx.lists.getState().sales;
  ctx.mutations.patchStatus = async () => {
    throw new Error('Fallo sintetico');
  };

  await ctx.store.getState().changeStatus(901, 'ACEPTADA');

  assert.equal(ctx.lists.getState().sales, previous);
  assert.equal(ctx.refreshes.length, 0);
  assert.equal(ctx.store.getState().actions[901].pending, false);
  assert.ok(ctx.store.getState().actions[901].error);
});

test('sintetico: cambio de sesion cancela y descarta respuesta tardia', async () => {
  const ctx = setup();
  const pending = deferred();
  let signal;
  ctx.mutations.patchStatus = (id, next, receivedSignal) => {
    signal = receivedSignal;
    return pending.promise;
  };

  const request = ctx.store.getState().changeStatus(901, 'ACEPTADA');
  ctx.auth.setState({ user: { id: 30 }, token: 'otro-token-sintetico' });

  assert.equal(signal.aborted, true);
  assert.deepEqual(ctx.store.getState().actions, {});

  pending.resolve({ ...ctx.order, estado: 'ACEPTADA' });
  await request;

  assert.equal(ctx.refreshes.length, 0);
  assert.deepEqual(ctx.store.getState().actions, {});
});

test('sintetico: distingue PATCH confirmado de refresco fallido', async () => {
  const ctx = setup();
  ctx.lists.setState({
    loadSales: async () => {
      ctx.lists.setState({
        sales: {
          ...ctx.lists.getState().sales,
          status: 'error',
          error: 'Fallo GET sintetico',
        },
      });
    },
  });

  await ctx.store.getState().changeStatus(901, 'ACEPTADA');

  assert.equal(ctx.calls.length, 1);
  assert.match(ctx.store.getState().actions[901].error, /cambio fue confirmado/);
});

test('sintetico: sin sesion no envia PATCH', async () => {
  const ctx = setup();
  ctx.auth.setState({ user: null, token: null, isAuthenticated: false });
  await ctx.store.getState().changeStatus(901, 'ACEPTADA');
  assert.equal(ctx.calls.length, 0);
  assert.equal(ctx.refreshes.length, 0);
  assert.ok(ctx.store.getState().actions[901].error);
});

test('sintetico: datos contradictorios entre listas bloquean PATCH', async () => {
  const ctx = setup();
  ctx.lists.setState({
    purchases: {
      ...ctx.lists.getState().purchases,
      orders: [{ ...ctx.order, estado: 'ACEPTADA' }],
    },
  });
  await ctx.store.getState().changeStatus(901, 'ACEPTADA');
  assert.equal(ctx.calls.length, 0);
  assert.ok(ctx.store.getState().actions[901].error);
});

test('sintetico: limpia errores finalizados al cambiar sesion', async () => {
  const ctx = setup();
  ctx.mutations.patchStatus = async () => {
    throw new Error('Fallo sintetico');
  };
  await ctx.store.getState().changeStatus(901, 'ACEPTADA');
  assert.ok(ctx.store.getState().actions[901].error);

  ctx.auth.setState({ token: 'nuevo-token-sintetico' });
  assert.deepEqual(ctx.store.getState().actions, {});
});

test('sintetico: actualizar perfil sin cambiar identidad conserva acciones', async () => {
  const ctx = setup();
  ctx.mutations.patchStatus = async () => {
    throw new Error('Fallo sintetico');
  };
  await ctx.store.getState().changeStatus(901, 'ACEPTADA');
  const previous = ctx.store.getState().actions;

  ctx.auth.setState({ user: { id: 20, name: 'Perfil sintetico actualizado' } });
  assert.equal(ctx.store.getState().actions, previous);
});

function setupRealOrdersStore() {
  const ctx = setup();
  const queries = {};
  const source = fs.readFileSync(path.join(__dirname, 'useOrdersStore.ts'), 'utf8');
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

  const realLists = moduleObject.exports.useOrdersStore;

  // El store de acciones obtiene ahora estado y metodos del store real.
  ctx.lists.getState = realLists.getState;
  return { ...ctx, realLists, queries };
}

test('stores reales sinteticos: GET antiguo no sobrescribe refresco tras PATCH', async () => {
  const ctx = setupRealOrdersStore();
  const patch = deferred();
  const oldGet = deferred();
  const accepted = { ...ctx.order, estado: 'ACEPTADA' };
  let getCalls = 0;

  ctx.queries.getSales = async () => {
    getCalls++;
    if (getCalls === 1) {
      return { orders: [ctx.order], meta: { currentPage: 3 } };
    }
    if (getCalls === 2) return oldGet.promise;
    return { orders: [accepted], meta: { currentPage: 3 } };
  };
  ctx.mutations.patchStatus = () => patch.promise;

  await ctx.realLists.getState().loadSales({ page: 3 });

  const action = ctx.store.getState().changeStatus(901, 'ACEPTADA');
  const staleRequest = ctx.realLists.getState().loadSales({ page: 3 });

  patch.resolve(accepted);
  await action;
  assert.equal(getCalls, 3);
  assert.equal(ctx.realLists.getState().sales.orders[0].estado, 'ACEPTADA');

  oldGet.resolve({ orders: [ctx.order], meta: { currentPage: 3 } });
  await staleRequest;

  assert.equal(ctx.realLists.getState().sales.orders[0].estado, 'ACEPTADA');
  assert.equal(ctx.store.getState().actions[901].pending, false);
  assert.equal(ctx.store.getState().actions[901].error, null);
});

test('stores reales sinteticos: PATCH confirmado y GET fallido no simulan lista actualizada', async () => {
  const ctx = setupRealOrdersStore();
  ctx.queries.getSales = async () => ({
    orders: [ctx.order],
    meta: { currentPage: 3 },
  });
  await ctx.realLists.getState().loadSales({ page: 3 });

  ctx.queries.getSales = async () => {
    throw new Error('Fallo GET sintetico');
  };

  await ctx.store.getState().changeStatus(901, 'ACEPTADA');

  assert.equal(ctx.calls.length, 1);
  assert.equal(ctx.realLists.getState().sales.status, 'error');
  assert.ok(ctx.realLists.getState().sales.error);
  assert.match(ctx.store.getState().actions[901].error, /cambio fue confirmado/);
});

test('stores reales sinteticos: conserva pagina solicitada durante PATCH', async () => {
  const ctx = setupRealOrdersStore();
  const patch = deferred();
  const oldGet = deferred();
  const accepted = { ...ctx.order, estado: 'ACEPTADA' };
  const received = [];

  ctx.queries.getSales = async (params) => {
    received.push({ ...params });
    if (received.length === 1) {
      return { orders: [ctx.order], meta: { currentPage: 3 } };
    }
    if (received.length === 2) return oldGet.promise;
    return { orders: [accepted], meta: { currentPage: 4 } };
  };
  ctx.mutations.patchStatus = () => patch.promise;

  await ctx.realLists.getState().loadSales({ page: 3 });
  const action = ctx.store.getState().changeStatus(901, 'ACEPTADA');

  const params = { page: 4, limit: 5, estado: 'ACEPTADA' };
  const stale = ctx.realLists.getState().loadSales(params);
  params.page = 99;

  assert.equal(ctx.realLists.getState().sales.meta, null);
  patch.resolve(accepted);
  await action;

  assert.deepEqual(received[2], { page: 4, limit: 5, estado: 'ACEPTADA' });
  assert.equal(ctx.realLists.getState().sales.meta.currentPage, 4);

  oldGet.resolve({ orders: [ctx.order], meta: { currentPage: 4 } });
  await stale;
  assert.equal(ctx.realLists.getState().sales.orders[0].estado, 'ACEPTADA');
});

test('stores reales sinteticos: parametros independientes y limpios tras reset', async () => {
  const ctx = setupRealOrdersStore();
  ctx.queries.getPurchases = async () => ({ orders: [] });
  ctx.queries.getSales = async () => ({ orders: [] });

  await ctx.realLists.getState().loadPurchases({ page: 2, limit: 10 });
  await ctx.realLists.getState().loadSales({ page: 5, estado: 'PENDIENTE' });

  assert.deepEqual(ctx.realLists.getState().purchasesParams, { page: 2, limit: 10 });
  assert.deepEqual(ctx.realLists.getState().salesParams, {
    page: 5,
    estado: 'PENDIENTE',
  });

  ctx.realLists.getState().reset();
  assert.deepEqual(ctx.realLists.getState().purchasesParams, {});
  assert.deepEqual(ctx.realLists.getState().salesParams, {});
});
