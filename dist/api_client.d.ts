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
    isOn: boolean;
    speed?: number;
    isRotating?: boolean;
}
export declare class ApiClient {
    private readonly log;
    constructor(log: Logger);
    call<T = unknown>(opts: RequestOptions): Promise<T | undefined>;
    private buildUrl;
    private interpolate;
    private interpolateString;
    getStatusWithRetry<T>(opts: RequestOptions, attempts?: number, delayMs?: number): Promise<T | undefined>;
}
