import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const source = fs.readFileSync(new URL('../src/app/login/page.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(`${source}\nexport { LoginContent as TestLoginContent };`, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX,
    esModuleInterop: true,
  },
}).outputText;

function renderLogin(query) {
  const element = (type, props) => ({ type, props });
  const mocks = {
    react: { Suspense: 'Suspense' },
    'react/jsx-runtime': { jsx: element, jsxs: element },
    'next/link': { __esModule: true, default: 'Link' },
    'next/navigation': {
      useRouter: () => ({ push() {} }),
      useSearchParams: () => new URLSearchParams(query),
    },
    '@/components/shared': { LoginCard: 'LoginCard' },
  };
  const moduleObject = { exports: {} };
  const wrapper = vm.runInThisContext(`(function(require, module, exports) { ${compiled}\n})`);
  wrapper(
    (name) => (Object.hasOwn(mocks, name) ? mocks[name] : require(name)),
    moduleObject,
    moduleObject.exports,
  );
  return moduleObject.exports.TestLoginContent();
}

test('la redirección por HTTP 401 conserva el aviso de sesión expirada en login', () => {
  assert.equal(renderLogin('session=expired').props.sessionExpired, true);
  assert.equal(renderLogin('expired=true').props.sessionExpired, true);
  assert.equal(renderLogin('').props.sessionExpired, false);
});
