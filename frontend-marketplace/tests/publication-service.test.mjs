import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');

function setup(getImpl, postImpl) {
  const source = fs.readFileSync(
    new URL('../src/services/publicationService.ts', import.meta.url),
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
      if (name === 'axios') {
        const realAxios = require('axios');
        return {
          ...realAxios,
          default: { ...realAxios, get: getImpl },
          get: getImpl,
        };
      }
      if (name === '@/lib/axios') {
        return {
          __esModule: true,
          default: {
            get: getImpl,
            post:
              postImpl ??
              (async () => {
                throw new Error('post no esperado en pruebas de lectura');
              }),
          },
        };
      }
      if (name === '@/lib/dateUtils') {
        return {
          formatRelativeTime: (val) => (val ? `ISO:${String(val)}` : 'Fecha desconocida'),
        };
      }
      throw new Error(`Importacion inesperada: ${name}`);
    },
    moduleObject,
    moduleObject.exports,
  );

  return moduleObject.exports.publicationService;
}

test('portada: envia imagenes_urls y conserva la URL confirmada en crear, detalle y lista', async () => {
  const images = Array.from(
    { length: 5 },
    (_, i) => `https://res.cloudinary.com/demo/image/upload/photo-${i}.jpg`,
  );
  const raw = { idPublicacion: 42, imagenesUrls: images };
  const service = setup(
    async (url) => ({
      data: url.endsWith('/42')
        ? { publication: raw }
        : { publications: [{ id_publicacion: 42, imagenes_urls: images }] },
    }),
    async (_url, payload) => {
      assert.deepEqual(payload.imagenes_urls, images);
      return { data: { publication: raw } };
    },
  );
  const created = await service.createPublication({
    title: 'Prueba',
    description: 'Prueba',
    price: 100,
    currency: 'CLP',
    type: 'OFERTA',
    sellerId: 1,
    categoryId: 1,
    images,
  });
  assert.deepEqual(created.images, images);
  assert.deepEqual((await service.getPublicationById('42')).images, images);
  assert.deepEqual((await service.getPublications()).publications[0].images, images);
});

test('portada: no inventa confirmacion si Catalog no devuelve las imagenes', async () => {
  const service = setup(
    async () => ({ data: { publication: { idPublicacion: 1 } } }),
    async () => ({ data: { publication: { idPublicacion: 1 } } }),
  );
  const created = await service.createPublication({
    title: 'Prueba',
    description: 'Prueba',
    price: 100,
    currency: 'CLP',
    type: 'OFERTA',
    sellerId: 1,
    categoryId: 1,
    images: ['https://example.com/a.jpg'],
  });
  assert.deepEqual(created.images, []);
  assert.deepEqual((await service.getPublicationById('1')).images, []);
});

// 1. CASO NOMINAL (payloads reales capturados desde GET /v1/categories, /v1/publications/1 y /v1/publications?limit=2)
test('nominal: getCategories conserva id numerico, nombre, slug e iconoUrl real', async () => {
  const service = setup(async (url) => {
    assert.ok(url.endsWith('/v1/categories'));
    return {
      data: {
        categories: [
          {
            idCategoria: 1,
            nombre: 'Gasfitería',
            slug: 'gasfiteria',
            iconoUrl: 'https://placehold.co/64x64/png?text=Gas',
          },
          {
            idCategoria: 10,
            nombre: 'Clases y reparaciones',
            slug: 'clases-y-reparaciones',
            iconoUrl: 'https://placehold.co/64x64/png?text=Clases',
          },
        ],
      },
    };
  });

  const result = await service.getCategories();
  assert.equal(result.length, 2);
  assert.deepEqual(result[0], {
    id: 1,
    nombre: 'Gasfitería',
    slug: 'gasfiteria',
    icono: 'https://placehold.co/64x64/png?text=Gas',
  });
  assert.equal(typeof result[0].id, 'number');
});

test('nominal: getPublicationById convierte precioBase int64 string "25000" a 25000 sin perdida y conserva IDs', async () => {
  const service = setup(async (url) => {
    assert.ok(url.endsWith('/v1/publications/1'));
    return {
      data: {
        publication: {
          idPublicacion: 1,
          idUsuarioVendedor: 991,
          categoriaId: 1,
          titulo: 'Reparación de fugas de agua en cañerías y llaves',
          descripcion: 'Detecto y reparo filtraciones en cañerías, llaves y flexibles.',
          tipoServicio: 'OFERTA',
          precioBase: '25000',
          ciudad: 'Temuco',
          region: 'La Araucanía',
          estado: 'ACTIVO',
          imagenesUrls: [],
          categoria: {
            idCategoria: 1,
            nombre: 'Gasfitería',
            slug: 'gasfiteria',
            iconoUrl: 'https://placehold.co/64x64/png?text=Gas',
          },
          createdAt: '2026-10-02T20:33:14.521Z',
        },
        vendedor: {
          idUsuario: 991,
          nombre: '',
          calificacionPromedio: 0,
        },
      },
    };
  });

  const pub = await service.getPublicationById('1');
  assert.equal(pub.id, 1);
  assert.equal(pub.sellerId, 991);
  assert.equal(pub.categoryId, 1);
  assert.equal(pub.categoryName, 'Gasfitería');
  assert.equal(pub.categorySlug, 'gasfiteria');
  assert.equal(pub.price, 25000);
  assert.equal(typeof pub.price, 'number');
  assert.equal(pub.type, 'OFERTA');
  assert.equal(pub.sellerName, undefined);
});

test('nominal: getPublications convierte totalRecords string "50" y preserva DEMANDA y OFERTA', async () => {
  const service = setup(async () => ({
    data: {
      publications: [
        {
          idPublicacion: 50,
          idUsuarioVendedor: 992,
          categoriaId: 10,
          titulo: 'Busco profesor de guitarra para principiante',
          descripcion: 'Quiero aprender guitarra desde cero.',
          tipoServicio: 'DEMANDA',
          precioBase: '20000',
          categoria: {
            idCategoria: 10,
            nombre: 'Clases y reparaciones',
            slug: 'clases-y-reparaciones',
          },
          createdAt: '2026-10-02T20:33:14.536Z',
        },
      ],
      meta: { totalRecords: '50', currentPage: 1, totalPages: 25, limit: 2 },
    },
  }));

  const res = await service.getPublications({ limit: 2 });
  assert.equal(res.total, 50);
  assert.equal(res.totalPages, 25);
  assert.equal(res.currentPage, 1);
  assert.equal(res.publications[0].type, 'DEMANDA');
  assert.equal(res.publications[0].price, 20000);
});

// 2. CASO OPCIONAL AUSENTE (iconoUrl omitido en BD / categoria ausente en payload)
test('opcional ausente: categoria sin iconoUrl usa fallback "📌" y publicacion sin categoria usa "General"', async () => {
  const service = setup(async (url) => {
    if (url.endsWith('/v1/categories')) {
      return {
        data: {
          categories: [{ idCategoria: 192, nombre: 'TMP ALL181', slug: 'tmp-all181' }],
        },
      };
    }
    return {
      data: {
        publication: {
          idPublicacion: 7,
          idUsuarioVendedor: 991,
          categoriaId: 7,
          titulo: 'Servicio sin objeto categoria anidado',
          descripcion:
            'Fixture sintetico para caracterizar fallback cuando categoria no viene en respuesta.',
          tipoServicio: 'OFERTA',
          precioBase: '15000',
        },
      },
    };
  });

  const cats = await service.getCategories();
  assert.equal(cats[0].icono, '📌');

  const pub = await service.getPublicationById('7');
  assert.equal(pub.categoryId, 7);
  assert.equal(pub.categoryName, 'General');
  assert.equal(pub.categorySlug, 'general');
});

// 3. CASO RESPUESTA INVALIDA (caracterizacion del comportamiento permisivo actual)
test('respuesta invalida: caracterizacion de conversiones permisivas y fallos HTTP', async () => {
  const service = setup(async (url) => {
    if (url.endsWith('/v1/categories')) {
      throw new Error('Network Error: Catalog unreachable');
    }
    if (url.endsWith('/v1/publications/999999')) {
      return { data: {} };
    }
    return {
      data: {
        publication: {
          idPublicacion: 88,
          idUsuarioVendedor: 991,
          categoriaId: 1,
          titulo: 'Payload con tipo desconocido y precio no numerico',
          descripcion: 'Fixture sintetico para documentar el comportamiento actual del mapper.',
          tipoServicio: 'TIPO_SERVICIO_UNSPECIFIED',
          precioBase: 'abc',
        },
      },
    };
  });

  // Fallo de red en getCategories devuelve [] sin propagar error
  const cats = await service.getCategories();
  assert.deepEqual(cats, []);

  // Respuesta vacia en getPublicationById lanza error explicito
  await assert.rejects(
    () => service.getPublicationById('999999'),
    /La API no devolvió la publicación/,
  );

  // TIPO_SERVICIO_UNSPECIFIED cae silenciosamente a 'OFERTA' y precio no numerico produce NaN
  const malformed = await service.getPublicationById('88');
  assert.equal(malformed.type, 'OFERTA');
  assert.ok(Number.isNaN(malformed.price));
});
