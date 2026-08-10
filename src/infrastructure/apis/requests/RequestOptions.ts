import { Endpoint } from './Endpoint.js';
import { EndpointWithBody } from './EndpointWithBody.js';
import { AuthConfig } from './AuthConfig.js';

export interface RequestOptions {
    endpoint: Endpoint | EndpointWithBody;
    timeoutMs: number;
    auth?: AuthConfig;
    variables?: Record<string, string | number | boolean | null | undefined>;
}