import { Endpoint } from '../infrastructure/apis/requests/Endpoint.js';
export interface FanEndpoints {
    start?: Endpoint;
    stop?: Endpoint;
    setSpeed?: Endpoint;
    startRotation?: Endpoint;
    stopRotation?: Endpoint;
    getStatus: Endpoint;
}
