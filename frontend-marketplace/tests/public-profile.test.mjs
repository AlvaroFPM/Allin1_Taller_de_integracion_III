import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');

function find(tree, predicate) {
  if (!tree || typeof tree !== 'object') return undefined;
  if (predicate(tree)) return tree;
  const children = Array.isArray(tree.props?.children)
    ? tree.props.children
    : [tree.props?.children];
  for (const child of children) {
    const match = find(child, predicate);
    if (match) return match;
  }
  return undefined;
}

function byType(tree, type) {
  return find(tree, (node) => node.type === type);
}

async function setup(options = {}) {
  const routeId = options.id ?? '1';

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
    useMemo(fn) {
      return fn();
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
  const calls = {
    getPublicProfile: [],
    getPublications: [],
  };

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
      PublicProfileHeader: 'Header',
      PublicProfileReputation: 'Reputation',
      PublicProfilePublications: 'Publications',
      PublicProfileReviews: 'Reviews',
    },
    '@/services/authService': {
      getPublicProfile: async (userId, signal) => {
        calls.getPublicProfile.push({ userId, signal });
        if (typeof options.getPublicProfile === 'function') {
          return options.getPublicProfile(userId, signal);
        }
        return null;
      },
    },
    '@/services/publicationService': {
      publicationService: {
        getPublications: async (params) => {
          calls.getPublications.push(params);
          if (typeof options.getPublications === 'function') {
            return options.getPublications(params);
          }
          return { publications: [], total: 0 };
        },
      },
    },
  };

  const source = fs.readFileSync(
    new URL('../src/app/perfil/[id]/page.tsx', import.meta.url),
    'utf8',
  );

  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;

  const moduleObject = { exports: {} };
  const wrapper = vm.runInThisContext(`(function(require, module, exports) { ${compiled}\n})`);
  wrapper(
    (name) => {
      if (name in mocks) return mocks[name];
      return require(name);
    },
    moduleObject,
    moduleObject.exports,
  );

  const Page = moduleObject.exports.default;

  const renderPage = () => {
    cursor = 0;
    return Page();
  };

  const pageTree = renderPage();
  const DetailComponent = pageTree.type;

  const render = () => {
    cursor = 0;
    return DetailComponent({ id: routeId });
  };

  // Initial render creates hooks and registers effects
  render();

  // Run effects
  for (const effect of effects) {
    effect();
  }

  // Allow async promises to resolve
  for (let i = 0; i < 15; i++) {
    await Promise.resolve();
  }

  return {
    render,
    renderPage,
    calls,
  };
}

test('ID inexistente (404) o fallo de API muestra estado Vendedor no encontrado sin mostrar mocks', async () => {
  const app = await setup({
    id: '999',
    getPublicProfile: async () => null,
  });

  const tree = app.render();
  const heading = find(tree, (node) => node.type === 'h1');
  assert.equal(heading?.props?.children, 'Vendedor no encontrado');
  assert.equal(byType(tree, 'Header'), undefined);
  assert.equal(byType(tree, 'Reputation'), undefined);
  assert.equal(byType(tree, 'Reviews'), undefined);
});

test('ID no numérico muestra Vendedor no encontrado sin consultar la API', async () => {
  const app = await setup({
    id: 'invalido-abc',
  });

  assert.equal(app.calls.getPublicProfile.length, 0);
  const tree = app.render();
  const heading = find(tree, (node) => node.type === 'h1');
  assert.equal(heading?.props?.children, 'Vendedor no encontrado');
});

test('perfil real muestra datos auténticos, desactiva reputación simulada y deja reseñas vacías', async () => {
  const app = await setup({
    id: '5',
    getPublicProfile: async (id) => ({
      userId: id,
      firstName: 'Camila',
      lastName: 'Rojas',
      bioExperiencia: 'Carpintería y reparaciones',
      ciudad: 'Temuco',
      region: 'Araucanía',
      fotoPerfilUrl: 'https://img.test/avatar.png',
    }),
    getPublications: async () => ({
      publications: [
        {
          id: 501,
          title: 'Mesa de centro',
          price: 45000,
          categoryName: 'Muebles',
          categorySlug: 'muebles',
        },
      ],
      total: 1,
    }),
  });

  const tree = app.render();
  const header = byType(tree, 'Header');
  assert.ok(header);
  assert.equal(header.props.firstName, 'Camila');
  assert.equal(header.props.lastName, 'Rojas');
  assert.equal(header.props.bio, 'Carpintería y reparaciones');
  assert.equal(header.props.city, 'Temuco, Araucanía');
  assert.equal(header.props.avatarUrl, 'https://img.test/avatar.png');
  assert.equal(header.props.isVerified, false);
  assert.equal(header.props.contactDisabled, true);

  const reputation = byType(tree, 'Reputation');
  assert.ok(reputation);
  assert.equal(reputation.props.available, false);

  const reviews = byType(tree, 'Reviews');
  assert.ok(reviews);
  assert.deepEqual(reviews.props.reviews, []);
  assert.equal(reviews.props.sellerName, 'Camila');

  const publications = byType(tree, 'Publications');
  assert.ok(publications);
  assert.equal(publications.props.sellerName, 'Camila');
  assert.equal(publications.props.publications.length, 1);
  assert.equal(publications.props.publications[0].title, 'Mesa de centro');
});

test('dos vendedores consecutivos no mezclan datos ni publicaciones', async () => {
  const app1 = await setup({
    id: '1',
    getPublicProfile: async () => ({
      userId: 1,
      firstName: 'VendedorUno',
      lastName: 'Pérez',
    }),
    getPublications: async () => ({
      publications: [{ id: 101, title: 'Servicio 1', price: 10000 }],
      total: 1,
    }),
  });

  const tree1 = app1.render();
  assert.equal(byType(tree1, 'Header').props.firstName, 'VendedorUno');
  assert.equal(byType(tree1, 'Publications').props.publications[0].title, 'Servicio 1');

  const app2 = await setup({
    id: '2',
    getPublicProfile: async () => ({
      userId: 2,
      firstName: 'VendedorDos',
      lastName: 'González',
    }),
    getPublications: async () => ({
      publications: [{ id: 201, title: 'Servicio 2', price: 20000 }],
      total: 1,
    }),
  });

  const tree2 = app2.render();
  assert.equal(byType(tree2, 'Header').props.firstName, 'VendedorDos');
  assert.equal(byType(tree2, 'Publications').props.publications[0].title, 'Servicio 2');

  // Verify page key guarantees remount isolation
  assert.equal(app1.renderPage().key, '1');
  assert.equal(app2.renderPage().key, '2');
});
