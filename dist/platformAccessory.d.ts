import type { PlatformAccessory } from 'homebridge';
import { SimpleIrFanPlatform } from './platform.js';
import { AuthConfig, Endpoint, EndpointWithBody } from './api_client.js';
export interface FanEndpoints {
    start?: Endpoint;
    stop?: Endpoint;
    setSpeed?: EndpointWithBody;
    startRotation?: Endpoint;
    stopRotation?: Endpoint;
    getStatus: Endpoint;
}
export interface FanDeviceConfig {
    name: string;
    manufacturer: string;
    model: string;
    serialNumber: string;
    timeoutMs?: number;
    endpoints: FanEndpoints;
    auth?: AuthConfig;
}
export declare class SimpleIrFanAccessory {
    private readonly platform;
    private readonly accessory;
    private readonly device;
    private service;
    private apiClient;
    private on;
    private speed;
    private rotation;
    constructor(platform: SimpleIrFanPlatform, accessory: PlatformAccessory, device: FanDeviceConfig);
    private speedToPercent;
    private percentToSpeed;
    private refreshFromStatus;
    private pushStateToHomeKit;
    private handleGetOn;
    private handleGetRotationSpeed;
    private handleGetSwingMode;
    private handleSetOn;
    private handleSetRotationSpeed;
    private handleSetSwingMode;
}
