import { setTimeout as delay } from 'timers/promises';
import { ApiHelper } from './helpers/ApiHelper.js';
export class ApiClient {
    log;
    constructor(log) {
        this.log = log;
    }
    async call(opts) {
        const url = this.buildUrl(opts.endpoint.uri, opts.endpoint.query, opts.variables);
        const headers = this.generateHeaders(opts);
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), opts.timeoutMs);
        try {
            const init = {
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
                return JSON.parse(text);
            }
            catch {
                return undefined;
            }
        }
        catch (e) {
            if (e instanceof Error && e.name === 'AbortError') {
                this.log.warn(`HTTP timeout for ${url}`);
            }
            else if (e instanceof Error) {
                this.log.error('HTTP error', e.message);
            }
            else {
                this.log.error('HTTP error', String(e));
            }
            return undefined;
        }
        finally {
            clearTimeout(t);
        }
    }
    buildUrl(base, query, vars) {
        const u = new URL(ApiHelper.interpolateString(base, vars));
        const q = { ...(query ?? {}) };
        Object.entries(q).forEach(([k, v]) => {
            const sv = ApiHelper.interpolateString(String(v), vars);
            u.searchParams.set(k, sv);
        });
        return u.toString();
    }
    async callWitRetry(opts, attempts = 2, delayMs = 250) {
        for (let i = 0; i < attempts; i++) {
            const r = await this.call(opts);
            if (r !== undefined) {
                return r;
            }
            await delay(delayMs);
        }
        return undefined;
    }
    generateHeaders(opts) {
        const headers = {
            'Content-Type': 'application/json',
            ...(opts.auth?.headers ?? {}),
            ...(opts.endpoint.headers ?? {}),
        };
        if (opts.auth?.bearerToken) {
            headers.Authorization = `Bearer ${opts.auth.bearerToken}`;
        }
        return headers;
    }
    setBodyOnRequest(init, opts) {
        const ep = opts.endpoint;
        if (!ep.bodyTemplate) {
            return;
        }
        const body = ApiHelper.interpolate(ep.bodyTemplate, opts.variables);
        init.body = JSON.stringify(body);
    }
}
//# sourceMappingURL=ApiClient.js.map