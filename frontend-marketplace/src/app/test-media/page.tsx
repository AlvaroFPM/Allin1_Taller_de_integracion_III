"use client";

import { useEffect, useState } from "react";

const MEDIA_URL = "http://localhost:8083";

export default function TestMedia() {
  const [token, setToken] = useState("");
  const [tipo, setTipo] = useState("PERFIL");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState("");
  const [url, setUrl] = useState("");
  const [dims, setDims] = useState("");

  useEffect(() => {
    const m = document.cookie.match(/(?:^|; )auth_token=([^;]*)/);
    if (m) setToken(decodeURIComponent(m[1]));
  }, []);

  async function subir() {
    setUrl("");
    setDims("");
    if (!file) {
      setResult("Elige un archivo");
      return;
    }
    const fd = new FormData();
    fd.append("tipo", tipo);
    fd.append("file", file);
    try {
      const res = await fetch(`${MEDIA_URL}/v1/media/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const text = await res.text();
      setResult(`HTTP ${res.status}\n${text}`);
      if (res.ok) setUrl(JSON.parse(text).url);
    } catch (e) {
      setResult(`Error de red/CORS: ${String(e)}`);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 700 }}>
      <h1>Prueba temporal de Media</h1>
      <p>Token (se llena solo si iniciaste sesión; si no, pégalo):</p>
      <input style={{ width: "100%" }} value={token} onChange={(e) => setToken(e.target.value)} />
      <p>
        Tipo:{" "}
        <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option>PERFIL</option>
          <option>PORTADA</option>
          <option>OTRO</option>
        </select>
      </p>
      <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <p><button onClick={subir}>Subir</button></p>
      <pre style={{ whiteSpace: "pre-wrap" }}>{result}</pre>
      {url && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="subida"
            style={{ maxWidth: 300 }}
            onLoad={(e) => setDims(`${e.currentTarget.naturalWidth} x ${e.currentTarget.naturalHeight} px`)}
          />
          <p><b>Dimensiones reales: {dims}</b></p>
        </>
      )}
    </div>
  );
}