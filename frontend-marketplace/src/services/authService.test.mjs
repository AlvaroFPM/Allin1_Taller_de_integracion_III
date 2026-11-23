import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function loadModule(file, dependencies = {}) {
  const source = fs.readFileSync(new URL(file, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
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

// Pruebas de logica del modal con hooks simulados, no pruebas de navegador.
function modalHarness(uploadMedia, onSave) {
  const slots = [];
  let cursor = 0;
  let closed = 0;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [
        slots[index],
        (value) => {
          slots[index] = value;
        },
      ];
    },
    useRef(initial) {
      return this.useState({ current: initial })[0];
    },
    useEffect() {},
  };
  const jsx = (type, props) => ({ type, props });
  const { ProfileEditModal } = loadModule('../components/shared/profile-edit-modal.tsx', {
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    axios: { isAxiosError: (error) => error.isAxiosError === true },
    '@/services/mediaService': { uploadMedia, MediaUploadError: Error },
    '@/components/ui/button': { Button: 'button' },
    '@/components/ui/input': { Input: 'input' },
    '@/components/ui/textarea': { Textarea: 'textarea' },
  });
  function find(predicate) {
    cursor = 0;
    const tree = ProfileEditModal({
      isOpen: true,
      initialData: form,
      onSave,
      onClose: () => closed++,
    });
    function visit(node) {
      if (!node || typeof node !== 'object') return undefined;
      if (predicate(node)) return node;
      return [node.props?.children].flat(Infinity).map(visit).find(Boolean);
    }
    return visit(tree);
  }
  return {
    select: (file = new File(['x'], 'test.png')) =>
      find((n) => n.props?.id === 'profile-photo').props.onChange({
        target: { files: [file] },
      }),
    submit: () => find((n) => n.type === 'form').props.onSubmit({ preventDefault() {} }),
    error: () => find((n) => n.props?.role === 'alert')?.props.children,
    filename: () => find((n) => n.props?.id === 'profile-photo-name')?.props.children,
    closed: () => closed,
  };
}

test('modal: rechazo de subida no guarda IAM ni cierra como exito', async () => {
  let saves = 0;
  const modal = modalHarness(
    async () => {
      throw new Error('Formato invalido');
    },
    async () => saves++,
  );
  modal.select();
  await modal.submit();
  assert.equal(saves, 0);
  assert.equal(modal.closed(), 0);
  assert.match(modal.error(), /No se pudo subir la foto/);
});

test('modal: IAM rechaza; reintento reutiliza URL y solo cierra al confirmar', async () => {
  let uploads = 0;
  let saves = 0;
  const modal = modalHarness(
    async () => {
      uploads++;
      return { url: 'https://example.invalid/foto.jpg' };
    },
    async (data) => {
      assert.equal(data.avatarUrl, 'https://example.invalid/foto.jpg');
      if (++saves === 1)
        throw {
          isAxiosError: true,
          response: {
            status: 400,
            data: {
              message:
                'el teléfono debe tener entre 7 y 20 caracteres y solo dígitos, espacios, +, - o paréntesis',
            },
          },
        };
    },
  );
  modal.select();
  await modal.submit();
  assert.match(modal.error(), /Revisa el teléfono/);
  assert.doesNotMatch(modal.error(), /IAM/);
  assert.equal(modal.closed(), 0);
  await modal.submit();
  assert.equal(uploads, 1);
  assert.equal(saves, 2);
  assert.equal(modal.closed(), 1);
});

test('modal: fallo de red al guardar no confirma exito', async () => {
  const modal = modalHarness(
    async () => ({ url: 'https://example.invalid/foto.jpg' }),
    async () => {
      throw new Error('Network error');
    },
  );
  modal.select();
  await modal.submit();
  assert.equal(modal.closed(), 0);
  assert.match(modal.error(), /No se pudo confirmar el guardado del perfil/);
});

test('modal: errores de imagen legibles sin filtrar detalles internos y nombre separado', async () => {
  for (const [content, kind, expected] of [
    ['', 'format', /archivo está vacío/],
    ['texto', 'format', /formato.*no es válido/],
    ['x', 'size', /demasiado grande/],
  ]) {
    const modal = modalHarness(
      async () => {
        throw Object.assign(new Error('media: 0 bytes, detalle interno'), { kind });
      },
      async () => {
        assert.fail('No debe guardar');
      },
    );
    modal.select(new File([content], 'foto.png'));
    assert.equal(modal.filename(), 'foto.png');
    await modal.submit();
    assert.match(modal.error(), expected);
    assert.doesNotMatch(modal.error(), /media:|bytes|detalle interno|IAM/);
  }
});

test('envia la URL de Media a IAM y recupera el avatar confirmado', async () => {
  const avatarUrl = 'https://example.invalid/media/perfil/test.jpg';
  const service = setup({
    put: async (url, body) => {
      assert.equal(url, '/v1/auth/profile');
      assert.equal(body.fotoPerfilUrl, avatarUrl);
      assert.equal(Object.hasOwn(body, 'portadaUrl'), false);
      assert.equal(Object.hasOwn(body, 'userId'), false);
      return { data: { userId: '23', fotoPerfilUrl: avatarUrl } };
    },
  });
  const response = await service.updatePrivateProfile({ ...form, avatarUrl }, '');
  assert.equal(mapper.mapPrivateProfile(response).avatarUrl, avatarUrl);
});

test('sin foto nueva no envia una referencia vacia ni modifica portada', () => {
  for (const avatarUrl of [undefined, '']) {
    const body = mapper.mapProfileUpdate({ ...form, avatarUrl }, '');
    assert.equal(Object.hasOwn(body, 'fotoPerfilUrl'), false);
    assert.equal(Object.hasOwn(body, 'portadaUrl'), false);
  }
});

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
