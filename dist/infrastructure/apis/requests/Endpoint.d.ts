import { HttpMethod } from '../helpers/ApiHelper.js';
export interface Endpoint {
    uri: string;
    method: HttpMethod;
    headers?: Record<string, string>;
    query?: Record<string, string | number | boolean>;
}
