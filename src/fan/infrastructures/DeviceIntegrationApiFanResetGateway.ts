import type { FanResetGatewayInterface } from '../services/FanResetGatewayInterface.js';

type FanResetGatewayFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

const RESET_PATH = '/api/v1/fan/reset';
const DEFAULT_TIMEOUT_MS = 5_000;

export interface DeviceIntegrationApiFanResetGatewayOptionsInterface {
  fetch?: FanResetGatewayFetch;
  timeoutMs?: number;
}

export class DeviceIntegrationApiFanResetGateway implements FanResetGatewayInterface {
  private readonly requestUrl: URL;
  private readonly timeoutMs: number;
  private readonly fetchFn: FanResetGatewayFetch;

  constructor(resetUri: string | undefined, options: DeviceIntegrationApiFanResetGatewayOptionsInterface = {}) {
    this.requestUrl = this.normalizeResetUri(resetUri);
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchFn = options.fetch ?? fetch;
  }

  async reset(): Promise<void> {
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
        this.fetchFn(this.requestUrl, {
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
        if (error.message.startsWith('Fan reset failed: unexpected status')) {
          throw error;
        }

        throw new Error('Fan reset failed: request failed');
      }

      throw new Error('Fan reset failed with an unknown error');
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private normalizeResetUri(rawUri: string | undefined): URL {
    if (!rawUri) {
      throw new Error('Invalid reset URI');
    }

    let candidate: URL;
    try {
      candidate = new URL(rawUri);
    } catch (_error) {
      throw new Error('Invalid reset URI');
    }

    if (candidate.protocol !== 'http:' && candidate.protocol !== 'https:') {
      throw new Error('Invalid reset URI');
    }

    if (candidate.username || candidate.password) {
      throw new Error('Invalid reset URI');
    }

    if (candidate.pathname !== RESET_PATH || candidate.search || candidate.hash) {
      throw new Error('Invalid reset URI');
    }

    return candidate;
  }
}
