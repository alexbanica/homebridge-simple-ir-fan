import type { FanResetGatewayInterface } from '../services/FanResetGatewayInterface.js';

type FanResetGatewayFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

const DEFAULT_API_BASE_URL = 'http://localhost:3000';
const RESET_PATH = '/api/v1/fan/reset';
const DEFAULT_TIMEOUT_MS = 5_000;

export interface DeviceIntegrationApiFanResetGatewayOptionsInterface {
  fetch?: FanResetGatewayFetch;
  timeoutMs?: number;
}

export class DeviceIntegrationApiFanResetGateway implements FanResetGatewayInterface {
  private readonly apiBaseUrl: URL;
  private readonly timeoutMs: number;
  private readonly fetchFn: FanResetGatewayFetch;

  constructor(baseUrl: string | undefined, options: DeviceIntegrationApiFanResetGatewayOptionsInterface = {}) {
    this.apiBaseUrl = this.normalizeApiBaseUrl(baseUrl);
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchFn = options.fetch ?? fetch;
  }

  async reset(): Promise<void> {
    const requestUrl = new URL(RESET_PATH, this.apiBaseUrl).toString();
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, this.timeoutMs);
    const timeoutPromise = new Promise<Response>((_, reject) => {
      abortController.signal.addEventListener(
        'abort',
        () => {
          reject(new DOMException('Fan reset request timed out', 'AbortError'));
        },
        { once: true },
      );
    });

    try {
      const response = await Promise.race([
        timeoutPromise,
        this.fetchFn(requestUrl, {
          method: 'POST',
          signal: abortController.signal,
        }),
      ]);

      if (response.status !== 202) {
        throw new Error(`Fan reset failed: unexpected status ${response.status}`);
      }
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('Fan reset failed: request timed out');
      }

      if (error instanceof Error) {
        throw new Error(`Fan reset failed: ${error.message}`);
      }

      throw new Error('Fan reset failed with an unknown error');
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private normalizeApiBaseUrl(baseUrl?: string): URL {
    const candidate = new URL(baseUrl ?? DEFAULT_API_BASE_URL);

    if (candidate.protocol !== 'http:' && candidate.protocol !== 'https:') {
      throw new Error(`Invalid API base URL protocol: ${candidate.protocol}`);
    }

    if (candidate.username || candidate.password) {
      throw new Error('Invalid API base URL: embedded credentials are not allowed.');
    }

    if (candidate.pathname !== '/' || candidate.search || candidate.hash) {
      throw new Error('Invalid API base URL; only origin values are supported.');
    }

    return new URL(candidate.origin);
  }
}
