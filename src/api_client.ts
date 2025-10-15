import { setTimeout as delay } from 'timers/promises';
import { Logger } from 'homebridge';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface Endpoint {
  uri: string;
  method: HttpMethod;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean>;
}

export interface EndpointWithBody extends Endpoint {
  bodyTemplate?: Record<string, unknown>;
}

export interface AuthConfig {
  headers?: Record<string, string>;
  bearerToken?: string;
}

export interface RequestOptions {
  endpoint: Endpoint | EndpointWithBody;
  timeoutMs: number;
  auth?: AuthConfig;
  variables?: Record<string, string | number | boolean | null | undefined>;
}

export interface FanStatus {
  on: boolean;
  speed?: number; // 1..3
  rotation?: boolean;
}

export class ApiClient {
  private readonly log: Logger;
  
  constructor(log: Logger) {
    this.log = log;
  }

  async call<T = unknown>(opts: RequestOptions): Promise<T | undefined> {
    const url = this.buildUrl(
      opts.endpoint.uri,
      opts.endpoint.query,
      opts.variables,
    );
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(opts.auth?.headers ?? {}),
      ...(opts.endpoint.headers ?? {}),
    };
    if (opts.auth?.bearerToken) {
      headers.Authorization = `Bearer ${opts.auth.bearerToken}`;
    }

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), opts.timeoutMs);

    try {
      const init: RequestInit = {
        method: opts.endpoint.method,
        headers,
        signal: controller.signal,
      };

      const ep = opts.endpoint as EndpointWithBody;
      if (ep.bodyTemplate) {
        const body = this.interpolate(ep.bodyTemplate, opts.variables);
        init.body = JSON.stringify(body);
      }

      this.log.debug('HTTP', init.method, url, init.body ? `body=${init.body}` : '');
      const res = await fetch(url, init);
      if (!res.ok) {
        this.log.warn(`HTTP ${res.status} for ${url}`);
        return undefined;
      }
      const text = await res.text();
      if (!text) {
        return undefined;
      }
      try {
        return JSON.parse(text) as T;
      } catch {
        return undefined;
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') {
        this.log.warn(`HTTP timeout for ${url}`);
      } else if (e instanceof Error) {
        this.log.error('HTTP error', e.message);
      } else {
        this.log.error('HTTP error', String(e));
      }
      return undefined;
    } finally {
      clearTimeout(t);
    }
  }

  private buildUrl(
    base: string,
    query?: Record<string, string | number | boolean>,
    vars?: Record<string, string | number | boolean | null | undefined>,
  ): string {
    const u = new URL(this.interpolateString(base, vars));
    const q: Record<string, string | number | boolean> = { ...(query ?? {}) };
    Object.entries(q).forEach(([k, v]) => {
      const sv = this.interpolateString(String(v), vars);
      u.searchParams.set(k, sv);
    });
    return u.toString();
  }

  private interpolate(
    obj: Record<string, unknown>,
    vars?: Record<string, string | number | boolean | null | undefined>,
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string') {
        out[k] = this.interpolateString(v, vars);
      } else if (v && typeof v === 'object' && !Array.isArray(v)) {
        out[k] = this.interpolate(v as Record<string, unknown>, vars);
      } else {
        out[k] = v;
      }
    }
    return out;
  }

  private interpolateString(
    s: string,
    vars?: Record<string, string | number | boolean | null | undefined>,
  ): string {
    if (!vars) {
      return s;
    }
    return s.replace(/\$\{(\w+)}/g, (_, k: string) => {
      const value = vars[k as keyof typeof vars];
      return value == null ? '' : String(value);
    });
  }

  // Optional: simple retry for GET status
  async getStatusWithRetry<T>(opts: RequestOptions, attempts = 2, delayMs = 250): Promise<T | undefined> {
    for (let i = 0; i < attempts; i++) {
      const r = await this.call<T>(opts);
      if (r !== undefined) {
        return r;
      }
      await delay(delayMs);
    }
    return undefined;
  }
}
