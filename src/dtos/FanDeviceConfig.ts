import { FanEndpoints } from './FanEndpoints.js';
import { AuthConfig } from '../infrastructure/apis/requests/AuthConfig.js';

export interface FanDeviceConfig {
    name: string;
    manufacturer: string;
    model: string;
    serialNumber: string;
    timeoutMs?: number;
    endpoints: FanEndpoints;
    auth?: AuthConfig;
}