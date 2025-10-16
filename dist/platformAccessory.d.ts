import type { PlatformAccessory } from 'homebridge';
import { SimpleIrFanPlatform } from './platform.js';
import { FanDeviceConfig } from './dtos/FanDeviceConfig.js';
export declare class SimpleIrFanAccessory {
    private readonly platform;
    private readonly accessory;
    private readonly device;
    private service;
    private fanService;
    private fanDevice;
    constructor(platform: SimpleIrFanPlatform, accessory: PlatformAccessory, device: FanDeviceConfig);
    private pushStateToHomeKit;
    private handleGetOn;
    private handleGetRotationSpeed;
    private handleGetSwingMode;
    private handleSetOn;
    private handleSetRotationSpeed;
    private handleSetSwingMode;
}
