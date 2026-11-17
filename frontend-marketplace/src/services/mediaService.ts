import axios from 'axios';
import { apiClient } from '@/lib/apiClient';

export type MediaType = 'PERFIL' | 'PORTADA';
export interface MediaUploadResponse {
  id: number;
  tipo: MediaType;
  url: string;
  publicId: string;
}
export type MediaErrorKind =
  'format' | 'size' | 'session' | 'network' | 'cancelled' | 'server' | 'response';

export class MediaUploadError extends Error {
  constructor(
    public readonly kind: MediaErrorKind,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'MediaUploadError';
  }
}

const MEDIA_URL = process.env.NEXT_PUBLIC_MEDIA_API_URL || 'http://localhost:8083';

export async function uploadMedia(
  file: File,
  tipo: MediaType,
  signal?: AbortSignal,
): Promise<MediaUploadResponse> {
  const body = new FormData();
  body.append('file', file);
  body.append('tipo', tipo);
  try {
    const { data } = await apiClient.post<MediaUploadResponse>('/v1/media/upload', body, {
      baseURL: MEDIA_URL,
      signal,
      // Media autentica con Bearer, no con cookies entre origenes.
      withCredentials: false,
      // Elimina el default JSON; el navegador genera multipart y su boundary.
      headers: { 'Content-Type': undefined },
    });
    if (
      !data ||
      !Number.isSafeInteger(data.id) ||
      data.id <= 0 ||
      data.tipo !== tipo ||
      typeof data.publicId !== 'string' ||
      !data.publicId ||
      typeof data.url !== 'string' ||
      !URL.canParse(data.url) ||
      !['https:', 'http:'].includes(new URL(data.url).protocol)
    ) {
      throw new MediaUploadError(
        'response',
        'Respuesta de subida invalida; no reintentes automaticamente.',
      );
    }
    return data;
  } catch (error) {
    if (error instanceof MediaUploadError) throw error;
    if (axios.isCancel(error)) {
      throw new MediaUploadError(
        'cancelled',
        'Subida cancelada; el servidor podria haberla completado.',
      );
    }
    if (axios.isAxiosError<{ error?: unknown }>(error)) {
      const status = error.response?.status;
      const kind: MediaErrorKind = !error.response
        ? 'network'
        : status === 401 || status === 403
          ? 'session'
          : status === 413
            ? 'size'
            : status === 400 || status === 415
              ? 'format'
              : 'server';
      const detail = error.response?.data?.error;
      throw new MediaUploadError(
        kind,
        typeof detail === 'string' && status !== undefined && status < 500
          ? detail
          : 'No se pudo confirmar la subida. No reintentes automaticamente.',
        status,
      );
    }
    throw error;
  }
}
