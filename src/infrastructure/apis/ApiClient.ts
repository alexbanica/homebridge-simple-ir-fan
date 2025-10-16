import { setTimeout as delay } from 'timers/promises';
import { Logger } from 'homebridge';
import { RequestOptions } from './requests/RequestOptions.js';
import { EndpointWithBody } from './requests/EndpointWithBody.js';
import { ApiHelper } from './helpers/ApiHelper.js';

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
    const headers = this.generateHeaders(opts);

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), opts.timeoutMs);

    try {
      const init: RequestInit = {
        method: opts.endpoint.method,
        headers,
        signal: controller.signal,
      };
      this.setBodyOnRequest(init, opts);

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
    const u = new URL(ApiHelper.interpolateString(base, vars));
    const q: Record<string, string | number | boolean> = { ...(query ?? {}) };
    Object.entries(q).forEach(([k, v]) => {
      const sv = ApiHelper.interpolateString(String(v), vars);
      u.searchParams.set(k, sv);
    });
    return u.toString();
  }

  async callWitRetry<T>(opts: RequestOptions, attempts = 2, delayMs = 250): Promise<T | undefined> {
    for (let i = 0; i < attempts; i++) {
      const r = await this.call<T>(opts);
      if (r !== undefined) {
        return r;
      }
      await delay(delayMs);
    }
    return undefined;
  }

  private generateHeaders(opts: RequestOptions): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(opts.auth?.headers ?? {}),
      ...(opts.endpoint.headers ?? {}),
    };
    if (opts.auth?.bearerToken) {
      headers.Authorization = `Bearer ${opts.auth.bearerToken}`;
    }

    return headers;
  }
  
  private setBodyOnRequest(init: RequestInit, opts: RequestOptions) {
    const ep = opts.endpoint as EndpointWithBody;
    if (!ep.bodyTemplate) {
      return;
    }
    const body = ApiHelper.interpolate(ep.bodyTemplate, opts.variables);
    init.body = JSON.stringify(body);
  }
}
