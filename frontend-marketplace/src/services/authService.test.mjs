import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function loadModule(file, dependencies = {}) {
  const source = fs.readFileSync(new URL(file, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const compiledModule = { exports: {} };
  const run = vm.runInThisContext(`(function(require, module, exports) { ${compiled}\n})`);
  run(
    (name) => {
      assert.ok(Object.hasOwn(dependencies, name), `Importación no prevista: ${name}`);
      return dependencies[name];
    },
    compiledModule,
    compiledModule.exports,
  );
  return compiledModule.exports;
}

const mapper = loadModule('../lib/mappers/auth.ts');
const setup = (apiClient) =>
  loadModule('authService.ts', {
    '@/lib/apiClient': { apiClient },
    '@/lib/authCookies': {},
    '@/store/useAuthStore': {},
    '@/lib/mappers/auth': mapper,
  });

const form = {
  firstName: 'Ana',
  lastName: 'Prueba',
  email: 'ana@example.com',
  phone: '',
  city: 'Temuco',
  region: 'Araucanía',
  bio: '',
};

test('lee el perfil privado y conserva los campos vacíos devueltos por IAM', async () => {
  const controller = new AbortController();
  const response = {
    user_id: '23',
    first_name: 'Ana María',
    last_name: 'Prueba',
    telefono: '',
    bio_experiencia: '',
    ciudad: 'Temuco',
    habilidades: 'Cerámica',
  };
  const service = setup({
    get: async (url, options) => {
      assert.equal(url, '/v1/auth/profile');
      assert.equal(options.signal, controller.signal);
      return { data: response };
    },
  });

  const profile = mapper.mapPrivateProfile(await service.getPrivateProfile(controller.signal));
  assert.equal(profile.id, 23);
  assert.equal(profile.firstName, 'Ana María');
  assert.equal(profile.phone, '');
  assert.equal(profile.bio, '');
  assert.equal(profile.habilidades, 'Cerámica');
});

test('envía los textos editables y conserva habilidades en el PUT', async () => {
  const response = { userId: '23', ciudad: 'Temuco', telefono: '', bioExperiencia: '' };
  const service = setup({
    put: async (url, body) => {
      assert.equal(url, '/v1/auth/profile');
      assert.deepEqual(body, {
        telefono: '',
        ciudad: 'Temuco',
        region: 'Araucanía',
        bioExperiencia: '',
        habilidades: 'Cerámica',
      });
      return { data: response };
    },
  });

  assert.equal(await service.updatePrivateProfile(form, 'Cerámica'), response);
});

test('propaga el rechazo de IAM al formulario', async () => {
  const error = new Error('Teléfono inválido');
  const service = setup({
    put: async () => {
      throw error;
    },
  });

  await assert.rejects(
    service.updatePrivateProfile(form, 'Cerámica'),
    (actual) => actual === error,
  );
});
