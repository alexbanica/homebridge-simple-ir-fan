import type { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig } from 'homebridge';

import { FanDeviceConfig } from './dtos/FanDeviceConfig.js';
import { SimpleIrFanAccessory } from './platformAccessory.js';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';

export interface SimpleIrFanPlatformConfigInterface extends PlatformConfig {
  devices?: FanDeviceConfig[];
}

export class SimpleIrFanPlatform implements DynamicPlatformPlugin {
  public readonly accessories: PlatformAccessory[] = [];
  private readonly fanAccessories = new Map<string, SimpleIrFanAccessory>();

  constructor(
    public readonly log: Logger,
    public readonly config: SimpleIrFanPlatformConfigInterface,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform:', this.platformName);

    if (!Array.isArray(this.config?.devices) || this.config.devices.length === 0) {
      this.log.warn('No fan devices configured; no accessories will be exposed.');
    }

    this.api.on('didFinishLaunching', () => {
      this.discoverDevices();
    });
  }

  private get platformName(): string {
    return typeof this.config?.name === 'string' ? this.config.name : PLATFORM_NAME;
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.log.debug('Loaded accessory from cache:', accessory.displayName);
    this.accessories.push(accessory);
  }

  discoverDevices() {
    const activeUUIDs = new Set<string>();

    this.discoverFanAccessories(activeUUIDs);

    const toRemove = this.accessories.filter((accessory) => !activeUUIDs.has(accessory.UUID));
    if (toRemove.length > 0) {
      this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, toRemove);
      toRemove.forEach((accessory) => this.log.warn('Removed accessory not in config:', accessory.displayName));
      this.accessories.splice(
        0,
        this.accessories.length,
        ...this.accessories.filter((accessory) => activeUUIDs.has(accessory.UUID)),
      );
    }

    for (const uuid of this.fanAccessories.keys()) {
      if (!activeUUIDs.has(uuid)) {
        this.fanAccessories.delete(uuid);
      }
    }
  }

  public async refreshAccessoryStatuses(): Promise<void> {
    await Promise.allSettled(
      [...this.fanAccessories.values()].map((fanAccessory) => fanAccessory.refreshStatus()),
    );
  }

  private discoverFanAccessories(activeUUIDs: Set<string>): void {
    for (const device of this.config?.devices ?? []) {
      const uuid = this.api.hap.uuid.generate(`${device.serialNumber}:${device.name}`);
      activeUUIDs.add(uuid);

      const existing = this.accessories.find((accessory) => accessory.UUID === uuid);
      if (existing) {
        this.log.debug('Restoring existing fan accessory from cache:', existing.displayName);
        this.fanAccessories.set(uuid, new SimpleIrFanAccessory(this, existing, device));
        continue;
      }

      const accessory = new this.api.platformAccessory(device.name, uuid);
      accessory.category = this.api.hap.Categories.FAN;
      this.fanAccessories.set(uuid, new SimpleIrFanAccessory(this, accessory, device));
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      this.accessories.push(accessory);
    }
  }
}
