import { createRequire } from 'module';

function getElectronNet(): { net: any; app: any } | null {
  try {
    if (process.versions?.electron) {
      const req = createRequire(import.meta.url);
      const electron = req('electron');
      const electronModule = electron?.default || electron;
      if (electronModule?.net?.fetch) {
        return { net: electronModule.net, app: electronModule.app };
      }
    }
  } catch {}
  return null;
}

export function normalizeHeaders(headers: any): Record<string, string> {
  const result: Record<string, string> = {};
  if (!headers) return result;
  if (typeof headers.forEach === 'function') {
    headers.forEach((value: string, key: string) => {
      result[key] = value;
    });
  } else if (Array.isArray(headers)) {
    for (const [k, v] of headers) {
      if (k && v !== undefined) result[k] = String(v);
    }
  } else if (typeof headers === 'object') {
    for (const [k, v] of Object.entries(headers)) {
      if (k && v !== undefined) result[k] = String(v);
    }
  }
  return result;
}

export const electronFetch: typeof fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  let url: string;
  let method = init?.method;
  let headers = init?.headers;
  let body = init?.body;

  if (typeof input === 'string') {
    url = input;
  } else if (input instanceof URL) {
    url = input.toString();
  } else {
    url = input.url;
    if (!method) method = input.method;
    if (!headers) headers = input.headers;
  }

  const cleanHeaders = normalizeHeaders(headers);
  const hasAcceptLang = Object.keys(cleanHeaders).some((k) => k.toLowerCase() === 'accept-language');
  if (!hasAcceptLang) {
    cleanHeaders['Accept-Language'] = 'en-US,en;q=0.9';
  }

  const electronApis = getElectronNet();
  if (electronApis) {
    const { app, net } = electronApis;
    if (app && !app.isReady()) {
      await app.whenReady();
    }

    return net.fetch(url, {
      ...init,
      method: method || 'GET',
      headers: cleanHeaders,
      body,
    }) as unknown as Promise<Response>;
  }

  // Fallback for standalone browser or Node environment
  return globalThis.fetch(url, {
    ...init,
    method: method || 'GET',
    headers: cleanHeaders,
    body,
  });
};
