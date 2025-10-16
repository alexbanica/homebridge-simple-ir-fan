import { Logger } from 'homebridge';
import { RequestOptions } from './requests/RequestOptions.js';
export declare class ApiClient {
    private readonly log;
    constructor(log: Logger);
    call<T = unknown>(opts: RequestOptions): Promise<T | undefined>;
    private buildUrl;
    callWitRetry<T>(opts: RequestOptions, attempts?: number, delayMs?: number): Promise<T | undefined>;
    private generateHeaders;
    private setBodyOnRequest;
}
