import type { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig } from 'homebridge';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';
import { SimpleFanAccessory, FanDeviceConfig } from './platformAccessory.js';

export class SimpleFanIrPlatform implements DynamicPlatformPlugin {
  public readonly accessories: PlatformAccessory[] = [];

  constructor(
        public readonly log: Logger,
        public readonly config: PlatformConfig & { devices?: FanDeviceConfig[] },
        public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform:', this.config?.name ?? PLATFORM_NAME);

    if (!this.config || !Array.isArray(this.config.devices)) {
      this.log.warn('No devices configured for SimpleFanApi.');
      return;
    }

    this.api.on('didFinishLaunching', () => {
      this.discoverDevices();
    });
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.log.debug('Loaded accessory from cache:', accessory.displayName);
    this.accessories.push(accessory);
  }

  discoverDevices() {
    const devices = this.config.devices ?? [];
    const uuids = new Set<string>();

    for (const dev of devices) {
      const uuid = this.api.hap.uuid.generate(`${dev.serialNumber}:${dev.name}`);
      uuids.add(uuid);

      const existing = this.accessories.find(acc => acc.UUID === uuid);
      if (existing) {
        this.log.debug('Restoring existing accessory from cache:', existing.displayName);
        new SimpleFanAccessory(this, existing, dev);
        continue;
      }

      const accessory = new this.api.platformAccessory(dev.name, uuid);
      accessory.category = this.api.hap.Categories.FAN;
      new SimpleFanAccessory(this, accessory, dev);
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      this.accessories.push(accessory);
    }

    // Unregister accessories not present anymore
    const toRemove = this.accessories.filter(a => !uuids.has(a.UUID));
    if (toRemove.length) {
      this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, toRemove);
      toRemove.forEach(a => this.log.warn('Removed accessory not in config:', a.displayName));
      this.accessories.splice(0, this.accessories.length, ...this.accessories.filter(a => uuids.has(a.UUID)));
    }
  }
}
