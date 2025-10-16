import { FanDeviceConfig } from './FanDeviceConfig.js';
export declare class FanDevice {
    on: boolean;
    speed: number;
    rotation: boolean;
    config: FanDeviceConfig;
    constructor(config: FanDeviceConfig);
    private speedToPercent;
    private percentToSpeed;
    getDeviceSpeed(): number;
    setDeviceSpeed(speed: number): void;
}
