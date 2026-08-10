import { Endpoint } from '../infrastructure/apis/requests/Endpoint.js';
import { FanResetEndpointInterface } from './FanResetEndpointInterface.js';

export interface FanEndpoints {
    start?: Endpoint;
    stop?: Endpoint;
    setSpeed?: Endpoint;
    startRotation?: Endpoint;
    stopRotation?: Endpoint;
    reset?: FanResetEndpointInterface;
    getStatus: Endpoint;
}
