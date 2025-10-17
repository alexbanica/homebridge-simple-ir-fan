import { FanStatus } from '../infrastructure/apis/responses/FanStatus.js';
import { FanDevice } from '../dtos/FanDevice.js';
import { ApiClient } from '../infrastructure/apis/ApiClient.js';

export class FanService {

  private readonly apiClient: ApiClient;

  constructor(apiClient: ApiClient) {
    this.apiClient = apiClient;
  }

  public async refresh(fanDevice: FanDevice): Promise<void> {
    const status = await this.apiClient.callWitRetry<FanStatus>({
      endpoint: fanDevice.config.endpoints.getStatus,
      timeoutMs: fanDevice.config.timeoutMs ?? 5000,
      auth: fanDevice.config.auth,
    });

    if (!status) {
      return;
    }

    fanDevice.on = status.isOn;
    if (typeof status.speed === 'number') {
      fanDevice.setDeviceSpeed(status.speed);
    }

    if (typeof status.isRotating === 'boolean') {
      fanDevice.rotation = status.isRotating;
    }
  }

  public async isOn(fanDevice: FanDevice): Promise<boolean> {
    await this.refresh(fanDevice).catch(() => {});
    return fanDevice?.on ?? false;
  }

  public async getSpeed(fanDevice: FanDevice): Promise<number> {
    this.refresh(fanDevice).catch(() => {});
    return fanDevice?.speed ?? 0;
  }

  public async isRotating(fanDevice: FanDevice): Promise<boolean> {
    await this.refresh(fanDevice).catch(() => {});
    return fanDevice.rotation;
  }

  public async toggle(fanDevice: FanDevice, active: boolean) {
    const ep = active ? fanDevice.config.endpoints.start : fanDevice.config.endpoints.stop;
    if (!ep) {
      return;
    }
    await this.apiClient.call({
      endpoint: ep,
      timeoutMs: fanDevice.config.timeoutMs ?? 5000,
      auth: fanDevice.config.auth,
    });
    fanDevice.on = active;
  }

  public async setSpeed(fanDevice: FanDevice, value: number) {
    if (!fanDevice.config.endpoints.setSpeed) {
      return;
    }

    fanDevice.speed = value;
    const speed = fanDevice.getDeviceSpeed();
    await this.apiClient.call({
      endpoint: fanDevice.config.endpoints.setSpeed,
      timeoutMs: fanDevice.config.timeoutMs ?? 5000,
      auth: fanDevice.config.auth,
      variables: { speed },
    });

    fanDevice.on = speed > 0;
  }

  public async toggleRotate(fanDevice: FanDevice, on: boolean) {
    const ep = on ? fanDevice.config.endpoints.startRotation : fanDevice.config.endpoints.stopRotation;
    if (!ep) {
      return;
    }
    await this.apiClient.call({
      endpoint: ep,
      timeoutMs: fanDevice.config.timeoutMs ?? 5000,
      auth: fanDevice.config.auth,
    });
    fanDevice.rotation = on;
  }
}