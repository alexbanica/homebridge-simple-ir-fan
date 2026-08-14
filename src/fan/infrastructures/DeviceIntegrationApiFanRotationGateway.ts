import type { FanRotationGatewayInterface } from '../services/FanRotationGatewayInterface.js';

type FanRotationGatewayFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

const ROTATE_PATH = '/api/v1/fan/rotate';
const DEFAULT_TIMEOUT_MS = 5_000;

export interface DeviceIntegrationApiFanRotationGatewayOptionsInterface {
  fetch?: FanRotationGatewayFetch;
  timeoutMs?: number;
}

export class DeviceIntegrationApiFanRotationGateway implements FanRotationGatewayInterface {
  private readonly requestUrl: URL;
  private readonly timeoutMs: number;
  private readonly fetchFn: FanRotationGatewayFetch;

  constructor(rotationUri: string | undefined, options: DeviceIntegrationApiFanRotationGatewayOptionsInterface = {}) {
    this.requestUrl = this.normalizeRotationUri(rotationUri);
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchFn = options.fetch ?? fetch;
  }

  async rotate(): Promise<void> {
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, this.timeoutMs);
    const timeoutPromise = new Promise<Response>((_, reject) => {
      abortController.signal.addEventListener(
        'abort',
        () => {
          reject(new DOMException('Fan rotation request timed out', 'AbortError'));
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
        throw new Error(`Fan rotation failed: unexpected status ${response.status}`);
      }
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('Fan rotation failed: request timed out');
      }

      if (error instanceof Error) {
        if (error.message.startsWith('Fan rotation failed: unexpected status')) {
          throw error;
        }

        throw new Error('Fan rotation failed: request failed');
      }

      throw new Error('Fan rotation failed with an unknown error');
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private normalizeRotationUri(rawUri: string | undefined): URL {
    if (!rawUri) {
      throw new Error('Invalid rotation URI');
    }

    let candidate: URL;
    try {
      candidate = new URL(rawUri);
    } catch (_error) {
      throw new Error('Invalid rotation URI');
    }

    if (candidate.protocol !== 'http:' && candidate.protocol !== 'https:') {
      throw new Error('Invalid rotation URI');
    }

    if (candidate.username || candidate.password) {
      throw new Error('Invalid rotation URI');
    }

    if (candidate.pathname !== ROTATE_PATH || candidate.search || candidate.hash) {
      throw new Error('Invalid rotation URI');
    }

    return candidate;
  }
}
