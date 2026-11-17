'use client';

import { useEffect, useRef, useState } from 'react';
import { uploadMedia, MediaUploadError, type MediaType } from '@/services/mediaService';

export default function TestMedia() {
  const [tipo, setTipo] = useState<MediaType>('PERFIL');
  const controller = useRef<AbortController | null>(null);
  const [pending, setPending] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState('');
  const [url, setUrl] = useState('');
  const [dims, setDims] = useState('');

  useEffect(() => () => controller.current?.abort(), []);

  async function subir() {
    if (controller.current) return;
    setUrl('');
    setDims('');
    if (!file) {
      setResult('Elige un archivo');
      return;
    }
    controller.current = new AbortController();
    setPending(true);
    try {
      const data = await uploadMedia(file, tipo, controller.current.signal);
      setResult(`HTTP 201\n${JSON.stringify(data, null, 2)}`);
      setUrl(data.url);
    } catch (e) {
      setResult(
        e instanceof MediaUploadError
          ? `${e.kind} (${e.status ?? '-'}): ${e.message}`
          : 'Error inesperado',
      );
    } finally {
      controller.current = null;
      setPending(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 700 }}>
      <h1>Prueba temporal de Media</h1>
      <p>Inicia sesion en la aplicacion. Se utiliza el cliente autenticado, sin pegar tokens.</p>
      <p>
        Tipo:{' '}
        <select
          disabled={pending}
          value={tipo}
          onChange={(e) => setTipo(e.target.value as MediaType)}
        >
          <option>PERFIL</option>
          <option>PORTADA</option>
        </select>
      </p>
      <input
        disabled={pending}
        type="file"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <p>
        <button disabled={pending} onClick={subir}>
          Subir
        </button>
        {pending && <button onClick={() => controller.current?.abort()}>Cancelar</button>}
      </p>
      <pre style={{ whiteSpace: 'pre-wrap' }}>{result}</pre>
      {url && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="subida"
            style={{ maxWidth: 300 }}
            onLoad={(e) =>
              setDims(`${e.currentTarget.naturalWidth} x ${e.currentTarget.naturalHeight} px`)
            }
          />
          <p>
            <b>Dimensiones reales: {dims}</b>
          </p>
        </>
      )}
    </div>
  );
}
