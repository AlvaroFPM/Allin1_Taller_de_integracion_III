import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');

async function setup(options = {}) {
  const publication = {
    id: 10,
    title: 'Oferta de prueba',
    description: 'Solo para pruebas aisladas',
    price: 30000,
    currency: 'CLP',
    type: 'OFERTA',
    sellerId: 1,
    createdAtRelative: '',
    ...options.publication,
  };
  const routeId = options.id ?? String(publication.id);

  let calls = 0;
  const slots = [];
  const effects = [];
  let cursor = 0;

  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) {
        slots[index] = typeof initial === 'function' ? initial() : initial;
      }
      return [
        slots[index],
        (value) => {
          slots[index] = typeof value === 'function' ? value(slots[index]) : value;
        },
      ];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useEffect(effect) {
      const index = cursor++;
      if (!(index in slots)) {
        slots[index] = true;
        effects.push(effect);
      }
    },
  };

  const element = (type, props, key) => ({ type, props, key });
  const mocks = {
    react,
    'react/jsx-runtime': {
      jsx: element,
      jsxs: element,
      Fragment: 'Fragment',
    },
    'next/link': { __esModule: true, default: 'Link' },
    'next/navigation': { useParams: () => ({ id: routeId }) },
    '@/components/shared': {
      PublicationDetailHero: 'Hero',
      PublicationDetailContact: 'Contact',
      PublicationDetailSidebar: 'Sidebar',
    },
    '@/components/shared/purchase-confirmation-modal': {
      PurchaseConfirmationModal: 'PurchaseModal',
    },
    '@/services/publicationService': {
      publicationService: {
        getPublicationById: async (id) => {
          assert.equal(id, routeId);
          return publication;
        },
      },
    },
    '@/services/authService': {
      getPublicProfile: async (userId, signal) => {
        if (typeof options.getPublicProfile === 'function') {
          return options.getPublicProfile(userId, signal);
        }
        return null;
      },
    },
    '@/store/useAuthStore': {
      useAuthStore: {
        getState: () => ({
          user: { id: options.userId ?? 2 },
          isAuthenticated: options.authenticated ?? true,
        }),
      },
    },
    '@/lib/authCookies': {
      getAccessToken: () => (options.authenticated === false ? undefined : 'isolated-test-token'),
    },
    '@/services/orderService': {
      orderService: {
        createOrder: async (payload) => {
          calls++;
          assert.deepEqual(payload, {
            idUsuarioVendedor: publication.sellerId,
            idPublicacion: publication.id,
            precio: String(publication.price),
          });
          return options.submit ? options.submit() : { order: { idOrden: 90 } };
        },
      },
    },
  };

  const source = fs.readFileSync(
    new URL('../src/app/publicaciones/[id]/page.tsx', import.meta.url),
    'utf8',
  );

  // Expone la función privada solo en la compilación en memoria.
  const compiled = ts.transpileModule(`${source}\nexport { PublicationDetail as TestDetail };`, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;

  const moduleObject = { exports: {} };
  const wrapper = vm.runInThisContext(`(function(require, module, exports) { ${compiled}\n})`);

  wrapper(
    (name) => (Object.hasOwn(mocks, name) ? mocks[name] : require(name)),
    moduleObject,
    moduleObject.exports,
  );

  function render() {
    cursor = 0;
    return moduleObject.exports.TestDetail({ id: routeId });
  }

  render();
  for (const effect of effects) effect();
  for (let i = 0; i < 10; i++) await Promise.resolve();

  return {
    render,
    renderPage: () => moduleObject.exports.default(),
    calls: () => calls,
  };
}

function find(node, predicate) {
  if (!node || typeof node !== 'object') return undefined;
  if (Array.isArray(node)) {
    for (const child of node) {
      const result = find(child, predicate);
      if (result) return result;
    }
    return undefined;
  }
  if (predicate(node)) return node;
  return find(node.props?.children, predicate);
}

const byType = (tree, type) => find(tree, (node) => node.type === type);
const alert = (tree) => find(tree, (node) => node.props?.role === 'alert');

test('sin sesión: no abre el modal ni llama al POST', async () => {
  const app = await setup({ authenticated: false });
  byType(app.render(), 'Sidebar').props.onAction();

  assert.ok(alert(app.render()));
  assert.equal(byType(app.render(), 'PurchaseModal'), undefined);
  assert.equal(app.calls(), 0);
});

test('publicación propia: bloquea la contratación', async () => {
  const app = await setup({ userId: 1 });
  byType(app.render(), 'Sidebar').props.onAction();

  assert.ok(alert(app.render()));
  assert.equal(byType(app.render(), 'PurchaseModal'), undefined);
  assert.equal(app.calls(), 0);
});

test('abrir y cancelar no envía un POST', async () => {
  const app = await setup();
  byType(app.render(), 'Sidebar').props.onAction();

  const modal = byType(app.render(), 'PurchaseModal');
  assert.equal(modal.props.item.price, 30000);
  assert.equal(modal.props.item.id, 10);

  modal.props.onClose();

  assert.equal(byType(app.render(), 'PurchaseModal'), undefined);
  assert.equal(app.calls(), 0);
});

test('confirmación: payload correcto, un solo envío y éxito', async () => {
  let resolve;
  const pending = new Promise((done) => {
    resolve = done;
  });

  const app = await setup({ submit: () => pending });
  byType(app.render(), 'Sidebar').props.onAction();
  const modal = byType(app.render(), 'PurchaseModal');
  const ordersLink = (tree) =>
    find(tree, (node) => node.type === 'Link' && node.props?.href === '/ordenes');

  assert.equal(ordersLink(app.render()), undefined);

  const first = modal.props.onConfirm();
  const second = modal.props.onConfirm();

  assert.equal(app.calls(), 1);
  assert.equal(byType(app.render(), 'PurchaseModal').props.isLoading, true);

  modal.props.onClose();
  assert.ok(byType(app.render(), 'PurchaseModal'));

  resolve({ order: { idOrden: 90 } });
  await Promise.all([first, second]);

  assert.equal(byType(app.render(), 'PurchaseModal'), undefined);
  assert.ok(find(app.render(), (node) => node.props?.role === 'status'));
  assert.equal(ordersLink(app.render())?.props.children, 'Ver mis compras');
  assert.equal(byType(app.render(), 'Sidebar').props.onAction, undefined);
});

test('navegar durante una confirmación mantiene aislados publicación y resultado', async () => {
  let finishFirst;
  const firstPending = new Promise((resolve) => {
    finishFirst = resolve;
  });
  const first = await setup({ submit: () => firstPending });
  assert.equal(first.renderPage().key, '10');
  byType(first.render(), 'Sidebar').props.onAction();
  const oldRequest = byType(first.render(), 'PurchaseModal').props.onConfirm();

  // Un cambio de ID remonta PublicationDetail gracias al key de la ruta.
  const second = await setup({
    publication: { id: 11, sellerId: 3, price: 45000, title: 'Otra oferta' },
    submit: async () => ({ order: { idOrden: 91 } }),
  });
  assert.equal(second.renderPage().key, '11');
  assert.equal(byType(second.render(), 'Sidebar').props.onAction !== undefined, true);
  byType(second.render(), 'Sidebar').props.onAction();
  const currentModal = byType(second.render(), 'PurchaseModal');
  assert.equal(currentModal.props.item.id, 11);
  assert.equal(currentModal.props.item.seller.id, 3);
  assert.equal(currentModal.props.item.price, 45000);
  await currentModal.props.onConfirm();
  assert.equal(second.calls(), 1);
  assert.match(
    find(second.render(), (node) => node.props?.role === 'status').props.children.join(''),
    /91/,
  );

  finishFirst({ order: { idOrden: 90 } });
  await oldRequest;
  assert.equal(first.calls(), 1);
  assert.match(
    find(second.render(), (node) => node.props?.role === 'status').props.children.join(''),
    /91/,
  );
});

for (const status of [400, 401, 403, 409, 500]) {
  test(`HTTP ${status}: conserva el modal y muestra error, sin éxito`, async () => {
    const app = await setup({
      submit: async () => {
        throw { isAxiosError: true, response: { status } };
      },
    });

    byType(app.render(), 'Sidebar').props.onAction();
    await byType(app.render(), 'PurchaseModal').props.onConfirm();

    const modal = byType(app.render(), 'PurchaseModal');
    assert.ok(modal);
    assert.ok(modal.props.errorMessage);
    assert.equal(modal.props.isLoading, false);
    assert.equal(
      find(app.render(), (node) => node.props?.role === 'status'),
      undefined,
    );
    assert.equal(
      find(app.render(), (node) => node.type === 'Link' && node.props?.href === '/ordenes'),
      undefined,
    );
  });
}

test('respuesta sin orden válida: no anuncia éxito', async () => {
  const app = await setup({ submit: async () => ({}) });
  byType(app.render(), 'Sidebar').props.onAction();
  await byType(app.render(), 'PurchaseModal').props.onConfirm();

  assert.ok(byType(app.render(), 'PurchaseModal').props.errorMessage);
  assert.equal(
    find(app.render(), (node) => node.props?.role === 'status'),
    undefined,
  );
});

test('DEMANDA: bloqueo explicito sin modal ni POST', async () => {
  const app = await setup({ publication: { type: 'DEMANDA' } });
  byType(app.render(), 'Sidebar').props.onAction();

  assert.match(alert(app.render()).props.children, /DEMANDA/);
  assert.equal(byType(app.render(), 'PurchaseModal'), undefined);
  assert.equal(app.calls(), 0);
});

test('identidad del vendedor: resuelve nombre real con IAM y mantiene enlace correcto', async () => {
  const app = await setup({
    publication: { id: 10, sellerId: 1 },
    getPublicProfile: async (userId) => {
      assert.equal(userId, 1);
      return {
        userId: 1,
        firstName: 'Francisco',
        lastName: 'Vendedor',
      };
    },
  });

  const contact = byType(app.render(), 'Contact');
  assert.equal(contact.props.sellerId, 1);
  assert.equal(contact.props.sellerName, 'Francisco Vendedor');

  byType(app.render(), 'Sidebar').props.onAction();
  const modal = byType(app.render(), 'PurchaseModal');
  assert.equal(modal.props.item.seller.id, 1);
  assert.equal(modal.props.item.seller.name, 'Francisco Vendedor');
});

test('identidad del vendedor: degradación segura ante 404 o fallo de IAM conserva sellerId y no inventa identidad', async () => {
  const app = await setup({
    publication: { id: 10, sellerId: 7 },
    getPublicProfile: async () => null,
  });

  const contact = byType(app.render(), 'Contact');
  assert.equal(contact.props.sellerId, 7);
  assert.equal(contact.props.sellerName, undefined);

  byType(app.render(), 'Sidebar').props.onAction();
  const modal = byType(app.render(), 'PurchaseModal');
  assert.equal(modal.props.item.seller.id, 7);
  assert.equal(modal.props.item.seller.name, 'Nombre no disponible');
});

test('identidad del vendedor: userId no coincidente no asigna nombre ajeno y conserva sellerId real', async () => {
  const app = await setup({
    publication: { id: 10, sellerId: 3 },
    getPublicProfile: async () => ({
      userId: 99,
      firstName: 'Impostor',
      lastName: 'Invalido',
    }),
  });

  const contact = byType(app.render(), 'Contact');
  assert.equal(contact.props.sellerId, 3);
  assert.equal(contact.props.sellerName, undefined);

  byType(app.render(), 'Sidebar').props.onAction();
  const modal = byType(app.render(), 'PurchaseModal');
  assert.equal(modal.props.item.seller.id, 3);
  assert.equal(modal.props.item.seller.name, 'Nombre no disponible');
});

test('identidad del vendedor: dos publicaciones distintas con dos vendedores no mezclan identidades', async () => {
  const appA = await setup({
    publication: { id: 20, sellerId: 101 },
    getPublicProfile: async (userId) => {
      assert.equal(userId, 101);
      return { userId: 101, firstName: 'Vendedor', lastName: 'A' };
    },
  });

  const appB = await setup({
    publication: { id: 21, sellerId: 102 },
    getPublicProfile: async (userId) => {
      assert.equal(userId, 102);
      return { userId: 102, firstName: 'Vendedor', lastName: 'B' };
    },
  });

  const contactA = byType(appA.render(), 'Contact');
  const contactB = byType(appB.render(), 'Contact');

  assert.equal(contactA.props.sellerId, 101);
  assert.equal(contactA.props.sellerName, 'Vendedor A');

  assert.equal(contactB.props.sellerId, 102);
  assert.equal(contactB.props.sellerName, 'Vendedor B');
});
