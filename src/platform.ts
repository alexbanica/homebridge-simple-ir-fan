import type { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig } from 'homebridge';

import { FanDeviceConfig } from './dtos/FanDeviceConfig.js';
import { DeviceIntegrationApiFanResetGateway } from './fan/infrastructures/DeviceIntegrationApiFanResetGateway.js';
import { FanResetService } from './fan/services/FanResetService.js';
import type { FanResetServiceInterface } from './fan/services/FanResetServiceInterface.js';
import { FanResetPlatformAccessory, SimpleIrFanAccessory } from './platformAccessory.js';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';

const DEFAULT_API_BASE_URL = 'http://localhost:3000';
const RESET_ACCESSORY_ID = 'fan-reset-trigger';

export interface SimpleIrFanPlatformConfigInterface extends PlatformConfig {
  devices?: FanDeviceConfig[];
  apiBaseUrl?: unknown;
}

export class SimpleIrFanPlatform implements DynamicPlatformPlugin {
  public readonly accessories: PlatformAccessory[] = [];
  public readonly apiBaseUrl: string;

  private readonly fanResetService?: FanResetServiceInterface;

  constructor(
    public readonly log: Logger,
    public readonly config: SimpleIrFanPlatformConfigInterface,
    public readonly api: API,
  ) {
    let resolvedApiBaseUrl = DEFAULT_API_BASE_URL;
    const hasExplicitApiBaseUrl = !!this.config && Object.prototype.hasOwnProperty.call(this.config, 'apiBaseUrl');

    try {
      resolvedApiBaseUrl = this.resolveApiBaseUrl(this.config?.apiBaseUrl, hasExplicitApiBaseUrl);
      this.fanResetService = new FanResetService(new DeviceIntegrationApiFanResetGateway(resolvedApiBaseUrl));
    } catch {
      this.log.error('Invalid apiBaseUrl configuration; the reset accessory is disabled.');
    }

    this.apiBaseUrl = resolvedApiBaseUrl;
    this.log.debug('Finished initializing platform:', this.platformName);

    if (!Array.isArray(this.config?.devices) || this.config.devices.length === 0) {
      this.log.warn('No fan devices configured; only the reset trigger will be exposed.');
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

    this.discoverResetAccessory(activeUUIDs);
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
  }

  private discoverResetAccessory(activeUUIDs: Set<string>): void {
    if (!this.fanResetService) {
      return;
    }

    const uuid = this.api.hap.uuid.generate(RESET_ACCESSORY_ID);
    activeUUIDs.add(uuid);

    const existing = this.accessories.find((accessory) => accessory.UUID === uuid);
    if (existing) {
      this.log.debug('Restoring existing reset accessory from cache:', existing.displayName);
      const existingContext = existing.context?.device;
      const existingDeviceContext = typeof existingContext === 'object' && existingContext !== null ? existingContext : {};
      const displayNameChanged = existing.displayName !== this.platformName;
      const contextChanged = existing.context.device?.exampleDisplayName !== this.platformName;

      existing.displayName = this.platformName;
      existing.context.device = {
        ...(existingDeviceContext as Record<string, unknown>),
        exampleDisplayName: this.platformName,
      };

      if (displayNameChanged || contextChanged) {
        this.api.updatePlatformAccessories([existing]);
      }

      new FanResetPlatformAccessory(this, existing, this.fanResetService);
      return;
    }

    this.log.info('Adding reset accessory:', this.platformName);
    const accessory = new this.api.platformAccessory(this.platformName, uuid);
    accessory.context.device = { exampleDisplayName: this.platformName };
    new FanResetPlatformAccessory(this, accessory, this.fanResetService);
    this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    this.accessories.push(accessory);
  }

  private discoverFanAccessories(activeUUIDs: Set<string>): void {
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
      accessory.category = this.api.hap.Categories.FAN;
      new SimpleIrFanAccessory(this, accessory, device);
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      this.accessories.push(accessory);
    }
  }

  private resolveApiBaseUrl(apiBaseUrl: unknown, hasExplicitApiBaseUrl: boolean): string {
    if (!hasExplicitApiBaseUrl) {
      return DEFAULT_API_BASE_URL;
    }

    if (typeof apiBaseUrl !== 'string') {
      throw new Error('Invalid API base URL type: apiBaseUrl must be a string URL when supplied.');
    }

    const candidate = new URL(apiBaseUrl);

    if (candidate.protocol !== 'http:' && candidate.protocol !== 'https:') {
      throw new Error(`Invalid API base URL protocol: ${candidate.protocol}`);
    }

    if (candidate.username || candidate.password) {
      throw new Error('Invalid API base URL: embedded credentials are not allowed.');
    }

    if (candidate.pathname !== '/' || candidate.search || candidate.hash) {
      throw new Error('Invalid API base URL; only origin values are supported.');
    }

    return candidate.origin;
  }
}
