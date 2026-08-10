import type { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig } from 'homebridge';
import { FanDeviceConfig } from './dtos/FanDeviceConfig.js';
export interface SimpleIrFanPlatformConfigInterface extends PlatformConfig {
    devices?: FanDeviceConfig[];
}
export declare class SimpleIrFanPlatform implements DynamicPlatformPlugin {
    readonly log: Logger;
    readonly config: SimpleIrFanPlatformConfigInterface;
    readonly api: API;
    readonly accessories: PlatformAccessory[];
    constructor(log: Logger, config: SimpleIrFanPlatformConfigInterface, api: API);
    private get platformName();
    configureAccessory(accessory: PlatformAccessory): void;
    discoverDevices(): void;
    private discoverFanAccessories;
}
