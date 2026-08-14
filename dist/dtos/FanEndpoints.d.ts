import { Endpoint } from '../infrastructure/apis/requests/Endpoint.js';
import { FanResetEndpointInterface } from './FanResetEndpointInterface.js';
import { FanRotationEndpointInterface } from './FanRotationEndpointInterface.js';
export interface FanEndpoints {
    start?: Endpoint;
    stop?: Endpoint;
    setSpeed?: Endpoint;
    reset?: FanResetEndpointInterface;
    rotate?: FanRotationEndpointInterface;
    getStatus: Endpoint;
}
