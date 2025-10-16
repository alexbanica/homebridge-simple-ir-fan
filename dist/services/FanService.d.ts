import { FanDevice } from '../dtos/FanDevice.js';
import { ApiClient } from '../infrastructure/apis/ApiClient.js';
export declare class FanService {
    private readonly apiClient;
    constructor(apiClient: ApiClient);
    refresh(fanDevice: FanDevice): Promise<void>;
    isOn(fanDevice: FanDevice): Promise<boolean>;
    getSpeed(fanDevice: FanDevice): Promise<number>;
    isRotating(fanDevice: FanDevice): Promise<boolean>;
    toggle(fanDevice: FanDevice, active: boolean): Promise<void>;
    setSpeed(fanDevice: FanDevice, value: number): Promise<void>;
    toggleRotate(fanDevice: FanDevice, on: boolean): Promise<void>;
}
