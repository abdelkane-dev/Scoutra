'use client';

export type ApiError = { code: string; message: string; status: number };
export type ApiResult<T> = { data: T; error: null } | { data: null; error: ApiError };

/**
 * Appel JSON vers /api (même origine, cookie de session HttpOnly envoyé par le navigateur).
 * Les erreurs du serveur ({ error: { code, message } }) sont renvoyées telles quelles, déjà traduites.
 */
export async function apiFetch<T>(
  path: string,
  init: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: unknown;
    signal?: AbortSignal;
  } = {},
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      method: init.method ?? 'GET',
      credentials: 'same-origin',
      headers: init.body !== undefined ? { 'content-type': 'application/json' } : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: init.signal,
    });
    const json = (await res.json().catch(() => null)) as {
      error?: { code?: string; message?: string };
    } | null;
    if (!res.ok) {
      return {
        data: null,
        error: {
          code: json?.error?.code ?? 'internal',
          message: json?.error?.message ?? '',
          status: res.status,
        },
      };
    }
    return { data: json as T, error: null };
  } catch {
    return { data: null, error: { code: 'network', message: '', status: 0 } };
  }
}

/** Mutation JSON ; renvoie le résultat sans lever d'exception. */
export function apiSend<T>(
  path: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body?: unknown,
) {
  return apiFetch<T>(path, { method, body: body ?? {} });
}
