import type { CharacteristicValue, Logger, PlatformAccessory, Service } from 'homebridge';

import { FanDevice } from './dtos/FanDevice.js';
import type { FanDeviceConfig } from './dtos/FanDeviceConfig.js';
import { DeviceIntegrationApiFanResetGateway } from './fan/infrastructures/DeviceIntegrationApiFanResetGateway.js';
import type { FanResetServiceInterface } from './fan/services/FanResetServiceInterface.js';
import { FanResetService } from './fan/services/FanResetService.js';
import { ApiClient } from './infrastructure/apis/ApiClient.js';
import type { SimpleIrFanPlatform } from './platform.js';
import { FanService } from './services/FanService.js';

type FanResetEndpointConfig = {
  uri: string;
  method: 'POST';
};

const RESET_SERVICE_SUBTYPE = 'fan-reset';
const RESET_OFFLINE_ERROR_MESSAGE = 'Fan reset failed for configured endpoint';
const RESET_LOG_PREFIX = 'Fan reset';

export class SimpleIrFanAccessory {
  private readonly service: Service;
  private readonly fanService: FanService;
  private readonly fanDevice: FanDevice;
  private readonly fanResetService?: FanResetServiceInterface;
  private readonly resetSwitchService?: Service;
  private readonly accessoryName: string;
  private readonly fanNameContext: string;
  private resetActionPromise?: Promise<void>;

  constructor(
    private readonly platform: SimpleIrFanPlatform,
    private readonly accessory: PlatformAccessory,
    device: FanDeviceConfig,
  ) {
    const { api, log } = platform;
    const safeLog = {
      ...log,
      debug: log.debug ?? (() => undefined),
      warn: log.warn ?? (() => undefined),
      log: log.log ?? (() => undefined),
    };
    this.fanService = new FanService(new ApiClient(safeLog as Logger));
    this.fanDevice = new FanDevice(device);
    this.accessoryName = device.name;
    this.fanNameContext = `${device.name} (${device.serialNumber})`;

    accessory.getService(api.hap.Service.AccessoryInformation)!
      .setCharacteristic(api.hap.Characteristic.Manufacturer, device.manufacturer)
      .setCharacteristic(api.hap.Characteristic.Model, device.model)
      .setCharacteristic(api.hap.Characteristic.SerialNumber, device.serialNumber);

    this.service = accessory.getService(api.hap.Service.Fanv2) || accessory.addService(api.hap.Service.Fanv2, device.name);

    this.service.getCharacteristic(api.hap.Characteristic.Active)
      .onGet(this.handleGetOn.bind(this))
      .onSet(this.handleSetOn.bind(this));

    this.service.getCharacteristic(api.hap.Characteristic.RotationSpeed)
      .setProps({ minValue: 0, maxValue: 100, minStep: 1 })
      .onGet(this.handleGetRotationSpeed.bind(this))
      .onSet(this.handleSetRotationSpeed.bind(this));

    this.service.getCharacteristic(api.hap.Characteristic.SwingMode)
      .onGet(this.handleGetSwingMode.bind(this))
      .onSet(this.handleSetSwingMode.bind(this));

    this.fanResetService = this.createFanResetService(device.endpoints as { reset?: FanResetEndpointConfig }, device.timeoutMs ?? 5_000);
    this.resetSwitchService = this.configureResetService();

    this.fanService.refresh(this.fanDevice).catch(() => {});
  }

  private pushStateToHomeKit(): void {
    const { api } = this.platform;
    this.service.updateCharacteristic(api.hap.Characteristic.Active, this.fanDevice.on ? 1 : 0);
    this.service.updateCharacteristic(api.hap.Characteristic.RotationSpeed, this.fanDevice.speed);
    this.service.updateCharacteristic(api.hap.Characteristic.SwingMode, this.fanDevice.rotation ? 1 : 0);
  }

  private async handleGetOn(): Promise<CharacteristicValue> {
    return await this.fanService.isOn(this.fanDevice).finally(() => this.pushStateToHomeKit()) ? 1 : 0;
  }

  private async handleGetRotationSpeed(): Promise<CharacteristicValue> {
    return await this.fanService.getSpeed(this.fanDevice).finally(() => this.pushStateToHomeKit());
  }

  private async handleGetSwingMode(): Promise<CharacteristicValue> {
    return await this.fanService.isRotating(this.fanDevice).finally(() => this.pushStateToHomeKit()) ? 1 : 0;
  }

  private async handleSetOn(value: CharacteristicValue): Promise<void> {
    await this.fanService.toggle(this.fanDevice, value === 1).finally(() => this.pushStateToHomeKit());
  }

  private async handleSetRotationSpeed(value: CharacteristicValue): Promise<void> {
    await this.fanService.setSpeed(this.fanDevice, value as number).finally(() => this.pushStateToHomeKit());
  }

  private async handleSetSwingMode(value: CharacteristicValue): Promise<void> {
    await this.fanService.toggleRotate(this.fanDevice, value === 1).finally(() => this.pushStateToHomeKit());
  }

  private createFanResetService(
    endpoints: { reset?: FanResetEndpointConfig },
    timeoutMs: number,
  ): FanResetServiceInterface | undefined {
    const resetEndpoint = endpoints.reset;
    if (!resetEndpoint) {
      this.removeCachedResetSwitch();
      return undefined;
    }

    if (!this.isValidResetMethod(resetEndpoint.method)) {
      this.logResetConfigError('Invalid reset method.');
      this.removeCachedResetSwitch();
      return undefined;
    }

    try {
      const gateway = new DeviceIntegrationApiFanResetGateway(resetEndpoint.uri, { timeoutMs });
      return new FanResetService(gateway);
    } catch (_error) {
      this.logResetConfigError('Invalid reset configuration.');
      this.removeCachedResetSwitch();
      return undefined;
    }
  }

  private configureResetService(): Service | undefined {
    const { api, log } = this.platform;
    const hasValidResetService = Boolean(this.fanResetService);
    const cachedService = this.getResetSwitchService();

    if (!hasValidResetService) {
      if (cachedService) {
        log.info(`${RESET_LOG_PREFIX} disabled for ${this.fanNameContext}.`);
        this.accessory.removeService(cachedService);
      }
      return undefined;
    }

    const service = cachedService
      || this.accessory.addService(api.hap.Service.Switch, 'Reset', RESET_SERVICE_SUBTYPE);
    service.setCharacteristic(api.hap.Characteristic.Name, `${this.accessoryName} Reset`);
    this.setResetCharacteristic(service, false);
    service.getCharacteristic(api.hap.Characteristic.On)
      .onSet(this.handleSetResetOn.bind(this))
      .onGet(this.handleGetResetOn.bind(this));

    return service;
  }

  private async handleSetResetOn(value: CharacteristicValue): Promise<void> {
    const { hap } = this.platform.api;
    const shouldReset = value === true || value === 1;

    if (!shouldReset) {
      this.setResetCharacteristic(this.resetSwitchService, false);
      return;
    }

    if (!this.fanResetService || !this.resetSwitchService) {
      this.setResetCharacteristic(this.resetSwitchService, false);
      return;
    }

    try {
      await this.startResetAction();
    } catch (error) {
      throw new hap.HapStatusError(hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
  }

  private startResetAction(): Promise<void> {
    if (!this.resetActionPromise) {
      const { log } = this.platform;
      this.setResetCharacteristic(this.resetSwitchService, true);
      this.resetActionPromise = this.fanResetService!
        .reset()
        .then(() => {
          log.info(`${RESET_LOG_PREFIX} completed for ${this.fanNameContext}.`);
        })
        .catch((error) => {
          log.error(RESET_OFFLINE_ERROR_MESSAGE, this.fanNameContext, error);
          throw error;
        })
        .finally(() => {
          this.setResetCharacteristic(this.resetSwitchService, false);
          this.resetActionPromise = undefined;
        });
    }
    return this.resetActionPromise;
  }

  private async handleGetResetOn(): Promise<CharacteristicValue> {
    const service = this.resetSwitchService;
    if (!service) {
      return false;
    }

    return service.getCharacteristic(this.platform.api.hap.Characteristic.On).value as boolean;
  }

  private setResetCharacteristic(service: Service | undefined, value: boolean): void {
    service?.getCharacteristic(this.platform.api.hap.Characteristic.On).updateValue(value);
  }

  private removeCachedResetSwitch(): void {
    const existing = this.getResetSwitchService();
    if (existing) {
      this.accessory.removeService(existing);
    }
  }

  private getResetSwitchService(): Service | undefined {
    const services = (this.accessory as { services?: unknown }).services;

    if (Array.isArray(services)) {
      return services.find((service: { subtype?: string }) => service.subtype === RESET_SERVICE_SUBTYPE) as Service | undefined;
    }

    if (services instanceof Map) {
      return services.get(this.platform.api.hap.Service.Switch) as Service | undefined;
    }

    return this.accessory.getService(this.platform.api.hap.Service.Switch);
  }

  private isValidResetMethod(method: string): method is 'POST' {
    return method === 'POST';
  }

  private logResetConfigError(message: string): void {
    this.platform.log.error(`${RESET_LOG_PREFIX} unavailable for ${this.fanNameContext}.`, message);
  }
}
