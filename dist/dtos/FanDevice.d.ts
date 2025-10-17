import { FanDeviceConfig } from './FanDeviceConfig.js';
export declare class FanDevice {
    private _on;
    speed: number;
    rotation: boolean;
    config: FanDeviceConfig;
    private readonly minDeviceSpeed;
    private readonly maxDeviceSpeed;
    private readonly onDeviceSpeed;
    constructor(config: FanDeviceConfig);
    private speedToPercent;
    private percentToSpeed;
    getDeviceSpeed(): number;
    setDeviceSpeed(speed: number): void;
    set on(on: boolean);
    get on(): boolean;
}
