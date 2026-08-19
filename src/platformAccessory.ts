import type { CharacteristicValue, Logger, PlatformAccessory, Service } from 'homebridge';

import { FanDevice } from './dtos/FanDevice.js';
import type { FanDeviceConfig } from './dtos/FanDeviceConfig.js';
import type { FanRotationEndpointInterface } from './dtos/FanRotationEndpointInterface.js';
import { DeviceIntegrationApiFanResetGateway } from './fan/infrastructures/DeviceIntegrationApiFanResetGateway.js';
import { DeviceIntegrationApiFanRotationGateway } from './fan/infrastructures/DeviceIntegrationApiFanRotationGateway.js';
import type { FanResetServiceInterface } from './fan/services/FanResetServiceInterface.js';
import type { FanRotationServiceInterface } from './fan/services/FanRotationServiceInterface.js';
import { FanResetService } from './fan/services/FanResetService.js';
import { FanRotationService } from './fan/services/FanRotationService.js';
import { ApiClient } from './infrastructure/apis/ApiClient.js';
import type { SimpleIrFanPlatform } from './platform.js';
import { FanService } from './services/FanService.js';

type FanResetEndpointConfig = {
  uri: string;
  method: 'POST';
};

type FanRotationEndpointConfig = FanRotationEndpointInterface;

const RESET_SERVICE_SUBTYPE = 'fan-reset';
const ROTATION_SERVICE_SUBTYPE = 'fan-rotation-toggle';
const RESET_OFFLINE_ERROR_MESSAGE = 'Fan reset failed for configured endpoint';
const ROTATION_OFFLINE_ERROR_MESSAGE = 'Fan rotation failed for configured endpoint';
const RESET_LOG_PREFIX = 'Fan reset';
const ROTATION_LOG_PREFIX = 'Fan rotation';

export class SimpleIrFanAccessory {
  private readonly service: Service;
  private readonly fanService: FanService;
  private readonly fanDevice: FanDevice;
  private readonly fanResetService?: FanResetServiceInterface;
  private readonly fanRotationService?: FanRotationServiceInterface;
  private readonly resetSwitchService?: Service;
  private readonly rotationSwitchService?: Service;
  private readonly accessoryName: string;
  private readonly fanNameContext: string;
  private readonly actionTimeoutMs: number;
  private resetActionPromise?: Promise<void>;
  private rotationActionPromise?: Promise<void>;

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
    this.actionTimeoutMs = device.timeoutMs ?? 5_000;
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

    this.removeSwingModeCharacteristic();

    this.fanResetService = this.createFanResetService(device.endpoints, this.actionTimeoutMs);
    this.resetSwitchService = this.configureResetService();
    this.fanRotationService = this.createFanRotationService(device.endpoints, this.actionTimeoutMs);
    this.rotationSwitchService = this.configureRotationService();

    this.fanService.refresh(this.fanDevice)
      .then(() => this.pushStateToHomeKit())
      .catch(() => {});
  }

  private pushStateToHomeKit(): void {
    const { api } = this.platform;
    this.service.updateCharacteristic(api.hap.Characteristic.Active, this.fanDevice.on ? 1 : 0);
    this.service.updateCharacteristic(api.hap.Characteristic.RotationSpeed, this.fanDevice.speed);
    this.setRotationCharacteristic(this.rotationSwitchService, this.fanDevice.rotation);
  }

  public async refreshStatus(): Promise<void> {
    await this.fanService.refresh(this.fanDevice)
      .finally(() => this.pushStateToHomeKit());
  }

  private async handleGetOn(): Promise<CharacteristicValue> {
    return await this.fanService.isOn(this.fanDevice).finally(() => this.pushStateToHomeKit()) ? 1 : 0;
  }

  private async handleGetRotationSpeed(): Promise<CharacteristicValue> {
    return await this.fanService.getSpeed(this.fanDevice).finally(() => this.pushStateToHomeKit());
  }

  private async handleSetOn(value: CharacteristicValue): Promise<void> {
    await this.fanService.toggle(this.fanDevice, value === 1).finally(() => this.pushStateToHomeKit());
  }

  private async handleSetRotationSpeed(value: CharacteristicValue): Promise<void> {
    await this.fanService.setSpeed(this.fanDevice, value as number).finally(() => this.pushStateToHomeKit());
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

  private createFanRotationService(
    endpoints: { rotate?: FanRotationEndpointConfig },
    timeoutMs: number,
  ): FanRotationServiceInterface | undefined {
    const rotationEndpoint = endpoints.rotate;
    if (!rotationEndpoint) {
      this.removeCachedRotationSwitch();
      return undefined;
    }

    if (!this.isValidRotationMethod(rotationEndpoint.method)) {
      this.logRotationConfigError('Invalid rotation method.');
      this.removeCachedRotationSwitch();
      return undefined;
    }

    try {
      const gateway = new DeviceIntegrationApiFanRotationGateway(rotationEndpoint.uri, { timeoutMs });
      return new FanRotationService(gateway);
    } catch (_error) {
      this.logRotationConfigError('Invalid rotation configuration.');
      this.removeCachedRotationSwitch();
      return undefined;
    }
  }

  private configureResetService(): Service | undefined {
    const { api, log } = this.platform;
    const hasValidResetService = Boolean(this.fanResetService);
    const cachedService = this.getSwitchService(RESET_SERVICE_SUBTYPE);

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

  private configureRotationService(): Service | undefined {
    const { api, log } = this.platform;
    const hasValidRotationService = Boolean(this.fanRotationService);
    const cachedService = this.getSwitchService(ROTATION_SERVICE_SUBTYPE);

    if (!hasValidRotationService) {
      if (cachedService) {
        log.info(`${ROTATION_LOG_PREFIX} disabled for ${this.fanNameContext}.`);
        this.accessory.removeService(cachedService);
      }
      return undefined;
    }

    const service = cachedService
      || this.accessory.addService(api.hap.Service.Switch, 'Rotation Toggle', ROTATION_SERVICE_SUBTYPE);
    service.setCharacteristic(api.hap.Characteristic.Name, `${this.accessoryName} Rotation Toggle`);
    this.setRotationCharacteristic(service, false);
    service.getCharacteristic(api.hap.Characteristic.On)
      .onSet(this.handleSetRotationOn.bind(this))
      .onGet(this.handleGetRotationOn.bind(this));

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
    } catch {
      throw new hap.HapStatusError(hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
  }

  private async handleSetRotationOn(value: CharacteristicValue): Promise<void> {
    const { hap } = this.platform.api;
    const requestedRotation = value === true || value === 1;

    if (!this.fanRotationService || !this.rotationSwitchService) {
      this.setRotationCharacteristic(this.rotationSwitchService, false);
      return;
    }

    try {
      const currentRotation = await this.fanService.getRotation(this.fanDevice);
      if (currentRotation === requestedRotation) {
        this.setRotationCharacteristic(this.rotationSwitchService, currentRotation);
        return;
      }

      await this.startRotationAction(requestedRotation, currentRotation);
    } catch {
      throw new hap.HapStatusError(hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
  }

  private startResetAction(): Promise<void> {
    if (!this.resetActionPromise) {
      const { log } = this.platform;
      this.setResetCharacteristic(this.resetSwitchService, true);
      this.resetActionPromise = this.fanResetService!
        .reset()
        .then(async () => {
          log.info(`${RESET_LOG_PREFIX} completed for ${this.fanNameContext}.`);
          await this.platform.refreshAccessoryStatuses();
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

  private startRotationAction(requestedRotation: boolean, previousRotation: boolean): Promise<void> {
    if (!this.rotationActionPromise) {
      const { log } = this.platform;
      this.setRotationCharacteristic(this.rotationSwitchService, requestedRotation);
      this.rotationActionPromise = this.fanRotationService!
        .rotate()
        .then(() => {
          this.fanDevice.rotation = requestedRotation;
          log.info(`${ROTATION_LOG_PREFIX} completed for ${this.fanNameContext}.`);
        })
        .catch((error) => {
          this.fanDevice.rotation = previousRotation;
          log.error(ROTATION_OFFLINE_ERROR_MESSAGE, this.fanNameContext, error);
          throw error;
        })
        .finally(() => {
          this.setRotationCharacteristic(this.rotationSwitchService, this.fanDevice.rotation);
          this.rotationActionPromise = undefined;
        });
    }
    return this.rotationActionPromise;
  }

  private async handleGetResetOn(): Promise<CharacteristicValue> {
    const service = this.resetSwitchService;
    if (!service) {
      return false;
    }

    return service.getCharacteristic(this.platform.api.hap.Characteristic.On).value as boolean;
  }

  private async handleGetRotationOn(): Promise<CharacteristicValue> {
    const service = this.rotationSwitchService;
    if (!service) {
      return false;
    }

    return await this.fanService.getRotation(this.fanDevice)
      .finally(() => this.pushStateToHomeKit());
  }

  private setResetCharacteristic(service: Service | undefined, value: boolean): void {
    service?.getCharacteristic(this.platform.api.hap.Characteristic.On).updateValue(value);
  }

  private setRotationCharacteristic(service: Service | undefined, value: boolean): void {
    service?.getCharacteristic(this.platform.api.hap.Characteristic.On).updateValue(value);
  }

  private removeCachedResetSwitch(): void {
    const existing = this.getSwitchService(RESET_SERVICE_SUBTYPE);
    if (existing) {
      this.accessory.removeService(existing);
    }
  }

  private removeCachedRotationSwitch(): void {
    const existing = this.getSwitchService(ROTATION_SERVICE_SUBTYPE);
    if (existing) {
      this.accessory.removeService(existing);
    }
  }

  private getSwitchService(subtype: string): Service | undefined {
    const services = (this.accessory as { services?: unknown }).services;

    if (Array.isArray(services)) {
      return services.find((service: { subtype?: string }) => service.subtype === subtype) as Service | undefined;
    }

    if (services instanceof Map) {
      for (const service of services.values() as Iterable<Service & { subtype?: string }>) {
        if (service.subtype === subtype) {
          return service;
        }
      }
      return undefined;
    }

    return this.accessory.getService(this.platform.api.hap.Service.Switch);
  }

  private isValidResetMethod(method: string): method is 'POST' {
    return method === 'POST';
  }

  private isValidRotationMethod(method: string): method is 'POST' {
    return method === 'POST';
  }

  private logResetConfigError(message: string): void {
    this.platform.log.error(`${RESET_LOG_PREFIX} unavailable for ${this.fanNameContext}.`, message);
  }

  private logRotationConfigError(message: string): void {
    this.platform.log.error(`${ROTATION_LOG_PREFIX} unavailable for ${this.fanNameContext}.`, message);
  }

  private removeSwingModeCharacteristic(): void {
    const service = this.service as Service & {
      getCharacteristic?: (characteristic: unknown) => { value?: unknown } | undefined;
      removeCharacteristic?: (characteristic: unknown) => void;
    };
    const removeCharacteristic = service.removeCharacteristic;
    const swingModeCharacteristic = service.getCharacteristic?.(this.platform.api.hap.Characteristic.SwingMode);

    if (typeof removeCharacteristic === 'function' && swingModeCharacteristic) {
      removeCharacteristic.call(this.service, swingModeCharacteristic);
    }
  }
}
