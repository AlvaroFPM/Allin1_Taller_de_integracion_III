import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import axios from 'axios';

const source = readFileSync(new URL('./mediaService.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
}).outputText;
const valid = {
  id: 1,
  tipo: 'PERFIL',
  url: 'https://example.invalid/image.jpg',
  publicId: 'media/test',
};
const file = new File(['test'], 'image.png', { type: 'image/png' });

function setup(adapter) {
  // Conserva el default JSON y cookies del cliente compartido para detectar regresiones.
  const apiClient = axios.create({
    headers: { 'Content-Type': 'application/json' },
    withCredentials: true,
    adapter,
  });
  const moduleObject = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports){${compiled}\n})`)(
    (name) => {
      if (name === 'axios') return axios;
      if (name === '@/lib/apiClient') return { apiClient };
      throw new Error(`Import inesperado: ${name}`);
    },
    moduleObject,
    moduleObject.exports,
  );
  return moduleObject.exports;
}

test('multipart conserva File/tipo, elimina JSON y cookies, y transmite signal', async () => {
  const controller = new AbortController();
  const { uploadMedia } = setup(async (config) => {
    assert.ok(config.data instanceof FormData);
    assert.equal(config.data.get('file').name, file.name);
    assert.equal(config.data.get('tipo'), 'PERFIL');
    assert.equal(config.withCredentials, false);
    assert.notEqual(config.headers.getContentType(), 'application/json');
    assert.equal(config.signal, controller.signal);
    assert.equal(config.url, '/v1/media/upload');
    return { data: valid, status: 201, headers: {}, config };
  });
  assert.deepEqual(await uploadMedia(file, 'PERFIL', controller.signal), valid);
});

for (const [status, kind] of [
  [400, 'format'],
  [401, 'session'],
  [403, 'session'],
  [413, 'size'],
  [415, 'format'],
  [500, 'server'],
  [undefined, 'network'],
]) {
  test(`clasifica ${status ?? 'sin respuesta'} sin reintentar`, async () => {
    let calls = 0;
    const { uploadMedia } = setup(async (config) => {
      calls++;
      throw new axios.AxiosError(
        'fallo',
        undefined,
        config,
        undefined,
        status ? { status, data: { error: 'detalle sintetico' }, headers: {}, config } : undefined,
      );
    });
    await assert.rejects(
      uploadMedia(file, 'PERFIL'),
      (error) => error.kind === kind && error.status === status,
    );
    assert.equal(calls, 1);
  });
}

test('cancelacion previa no envia solicitud', async () => {
  const { uploadMedia } = setup(() => {
    throw new Error('No debe invocarse');
  });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    uploadMedia(file, 'PERFIL', controller.signal),
    (error) => error.kind === 'cancelled',
  );
});

test('cancelacion durante la solicitud se clasifica sin reintento', async () => {
  const controller = new AbortController();
  let calls = 0;
  const { uploadMedia } = setup(
    (config) =>
      new Promise((_resolve, reject) => {
        calls++;
        config.signal.addEventListener('abort', () => reject(new axios.CanceledError()));
        controller.abort();
      }),
  );
  await assert.rejects(
    uploadMedia(file, 'PERFIL', controller.signal),
    (error) => error.kind === 'cancelled',
  );
  assert.equal(calls, 1);
});

test('rechaza respuestas incompletas o URL insegura sin reintentar', async () => {
  for (const data of [
    null,
    {},
    { ...valid, url: 'javascript:alert(1)' },
    { ...valid, tipo: 'PORTADA' },
  ]) {
    const { uploadMedia } = setup(async (config) => ({ status: 201, data, headers: {}, config }));
    await assert.rejects(uploadMedia(file, 'PERFIL'), (error) => error.kind === 'response');
  }
});
