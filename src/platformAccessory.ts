import type { API, CharacteristicValue, Logger, PlatformAccessory, Service } from 'homebridge';

import { FanDevice } from './dtos/FanDevice.js';
import type { FanDeviceConfig } from './dtos/FanDeviceConfig.js';
import type { FanResetServiceInterface } from './fan/services/FanResetServiceInterface.js';
import { ApiClient } from './infrastructure/apis/ApiClient.js';
import type { SimpleIrFanPlatform } from './platform.js';
import { FanService } from './services/FanService.js';

export class SimpleIrFanAccessory {
  private readonly service: Service;
  private readonly fanService: FanService;
  private readonly fanDevice: FanDevice;

  constructor(
    private readonly platform: SimpleIrFanPlatform,
    private readonly accessory: PlatformAccessory,
    device: FanDeviceConfig,
  ) {
    const { api, log } = platform;
    this.fanService = new FanService(new ApiClient(log));
    this.fanDevice = new FanDevice(device);

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
}

export interface FanResetHomebridgePlatformInterface {
  readonly api: API;
  readonly log: Logger;
}

export class FanResetPlatformAccessory {
  private readonly service: Service;

  constructor(
    private readonly platform: FanResetHomebridgePlatformInterface,
    private readonly accessory: PlatformAccessory,
    private readonly fanResetService: FanResetServiceInterface,
  ) {
    const { api } = this.platform;

    this.accessory.getService(api.hap.Service.AccessoryInformation)!
      .setCharacteristic(api.hap.Characteristic.Manufacturer, 'Homebridge')
      .setCharacteristic(api.hap.Characteristic.Model, 'Fan Reset Trigger')
      .setCharacteristic(api.hap.Characteristic.SerialNumber, 'fan-reset-trigger');

    this.service = this.accessory.getService(api.hap.Service.Switch)
      || this.accessory.addService(api.hap.Service.Switch, this.accessory.displayName);
    this.service.setCharacteristic(api.hap.Characteristic.Name, this.accessory.displayName);
    this.setOnCharacteristic(false);

    this.service.getCharacteristic(api.hap.Characteristic.On)
      .onSet(this.setOn.bind(this))
      .onGet(this.getOn.bind(this));
  }

  async setOn(value: CharacteristicValue): Promise<void> {
    if (value !== true) {
      this.setOnCharacteristic(false);
      return;
    }

    this.setOnCharacteristic(true);

    try {
      await this.fanResetService.reset();
      this.platform.log.info('Fan reset triggered successfully.');
      this.setOnCharacteristic(false);
    } catch (error) {
      this.platform.log.error('Fan reset failed.', error);
      this.setOnCharacteristic(false);
      throw new this.platform.api.hap.HapStatusError(
        this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE,
      );
    }
  }

  async getOn(): Promise<CharacteristicValue> {
    return this.service.getCharacteristic(this.platform.api.hap.Characteristic.On).value as boolean;
  }

  private setOnCharacteristic(value: boolean): void {
    this.service.updateCharacteristic(this.platform.api.hap.Characteristic.On, value);
  }
}
