import type { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig } from 'homebridge';
import { FanDeviceConfig } from './platformAccessory.js';
export declare class SimpleIrFanPlatform implements DynamicPlatformPlugin {
    readonly log: Logger;
    readonly config: PlatformConfig & {
        devices?: FanDeviceConfig[];
    };
    readonly api: API;
    readonly accessories: PlatformAccessory[];
    constructor(log: Logger, config: PlatformConfig & {
        devices?: FanDeviceConfig[];
    }, api: API);
    configureAccessory(accessory: PlatformAccessory): void;
    discoverDevices(): void;
}
