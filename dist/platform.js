import { SimpleIrFanAccessory } from './platformAccessory.js';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';
export class SimpleIrFanPlatform {
    log;
    config;
    api;
    accessories = [];
    constructor(log, config, api) {
        this.log = log;
        this.config = config;
        this.api = api;
        this.log.debug('Finished initializing platform:', this.platformName);
        if (!Array.isArray(this.config?.devices) || this.config.devices.length === 0) {
            this.log.warn('No fan devices configured; no accessories will be exposed.');
        }
        this.api.on('didFinishLaunching', () => {
            this.discoverDevices();
        });
    }
    get platformName() {
        return typeof this.config?.name === 'string' ? this.config.name : PLATFORM_NAME;
    }
    configureAccessory(accessory) {
        this.log.debug('Loaded accessory from cache:', accessory.displayName);
        this.accessories.push(accessory);
    }
    discoverDevices() {
        const activeUUIDs = new Set();
        this.discoverFanAccessories(activeUUIDs);
        const toRemove = this.accessories.filter((accessory) => !activeUUIDs.has(accessory.UUID));
        if (toRemove.length > 0) {
            this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, toRemove);
            toRemove.forEach((accessory) => this.log.warn('Removed accessory not in config:', accessory.displayName));
            this.accessories.splice(0, this.accessories.length, ...this.accessories.filter((accessory) => activeUUIDs.has(accessory.UUID)));
        }
    }
    discoverFanAccessories(activeUUIDs) {
        for (const device of this.config?.devices ?? []) {
            const uuid = this.api.hap.uuid.generate(`${device.serialNumber}:${device.name}`);
            activeUUIDs.add(uuid);
            const existing = this.accessories.find((accessory) => accessory.UUID === uuid);
            if (existing) {
                this.log.debug('Restoring existing fan accessory from cache:', existing.displayName);
                new SimpleIrFanAccessory(this, existing, device);
                continue;
            }
            const accessory = new this.api.platformAccessory(device.name, uuid);
            accessory.category = 3 /* this.api.hap.Categories.FAN */;
            new SimpleIrFanAccessory(this, accessory, device);
            this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
            this.accessories.push(accessory);
        }
    }
}
//# sourceMappingURL=platform.js.map