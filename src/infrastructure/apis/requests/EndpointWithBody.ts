import { Endpoint } from './Endpoint.js';

export interface EndpointWithBody extends Endpoint {
    bodyTemplate?: Record<string, unknown>;
}