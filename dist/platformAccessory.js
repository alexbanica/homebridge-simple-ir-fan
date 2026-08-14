import { FanDevice } from './dtos/FanDevice.js';
import { DeviceIntegrationApiFanResetGateway } from './fan/infrastructures/DeviceIntegrationApiFanResetGateway.js';
import { DeviceIntegrationApiFanRotationGateway } from './fan/infrastructures/DeviceIntegrationApiFanRotationGateway.js';
import { FanResetService } from './fan/services/FanResetService.js';
import { FanRotationService } from './fan/services/FanRotationService.js';
import { ApiClient } from './infrastructure/apis/ApiClient.js';
import { FanService } from './services/FanService.js';
const RESET_SERVICE_SUBTYPE = 'fan-reset';
const ROTATION_SERVICE_SUBTYPE = 'fan-rotation-toggle';
const RESET_OFFLINE_ERROR_MESSAGE = 'Fan reset failed for configured endpoint';
const ROTATION_OFFLINE_ERROR_MESSAGE = 'Fan rotation failed for configured endpoint';
const RESET_LOG_PREFIX = 'Fan reset';
const ROTATION_LOG_PREFIX = 'Fan rotation';
export class SimpleIrFanAccessory {
    platform;
    accessory;
    service;
    fanService;
    fanDevice;
    fanResetService;
    fanRotationService;
    resetSwitchService;
    rotationSwitchService;
    accessoryName;
    fanNameContext;
    actionTimeoutMs;
    resetActionPromise;
    rotationActionPromise;
    constructor(platform, accessory, device) {
        this.platform = platform;
        this.accessory = accessory;
        const { api, log } = platform;
        const safeLog = {
            ...log,
            debug: log.debug ?? (() => undefined),
            warn: log.warn ?? (() => undefined),
            log: log.log ?? (() => undefined),
        };
        this.fanService = new FanService(new ApiClient(safeLog));
        this.fanDevice = new FanDevice(device);
        this.actionTimeoutMs = device.timeoutMs ?? 5_000;
        this.accessoryName = device.name;
        this.fanNameContext = `${device.name} (${device.serialNumber})`;
        accessory.getService(api.hap.Service.AccessoryInformation)
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
        this.fanService.refresh(this.fanDevice).catch(() => { });
    }
    pushStateToHomeKit() {
        const { api } = this.platform;
        this.service.updateCharacteristic(api.hap.Characteristic.Active, this.fanDevice.on ? 1 : 0);
        this.service.updateCharacteristic(api.hap.Characteristic.RotationSpeed, this.fanDevice.speed);
    }
    async handleGetOn() {
        return await this.fanService.isOn(this.fanDevice).finally(() => this.pushStateToHomeKit()) ? 1 : 0;
    }
    async handleGetRotationSpeed() {
        return await this.fanService.getSpeed(this.fanDevice).finally(() => this.pushStateToHomeKit());
    }
    async handleSetOn(value) {
        await this.fanService.toggle(this.fanDevice, value === 1).finally(() => this.pushStateToHomeKit());
    }
    async handleSetRotationSpeed(value) {
        await this.fanService.setSpeed(this.fanDevice, value).finally(() => this.pushStateToHomeKit());
    }
    createFanResetService(endpoints, timeoutMs) {
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
        }
        catch (_error) {
            this.logResetConfigError('Invalid reset configuration.');
            this.removeCachedResetSwitch();
            return undefined;
        }
    }
    createFanRotationService(endpoints, timeoutMs) {
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
        }
        catch (_error) {
            this.logRotationConfigError('Invalid rotation configuration.');
            this.removeCachedRotationSwitch();
            return undefined;
        }
    }
    configureResetService() {
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
    configureRotationService() {
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
    async handleSetResetOn(value) {
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
        }
        catch {
            throw new hap.HapStatusError(-70402 /* hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE */);
        }
    }
    async handleSetRotationOn(value) {
        const { hap } = this.platform.api;
        const shouldRotate = value === true || value === 1;
        if (!shouldRotate) {
            this.setRotationCharacteristic(this.rotationSwitchService, false);
            return;
        }
        if (!this.fanRotationService || !this.rotationSwitchService) {
            this.setRotationCharacteristic(this.rotationSwitchService, false);
            return;
        }
        try {
            await this.startRotationAction();
        }
        catch {
            throw new hap.HapStatusError(-70402 /* hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE */);
        }
    }
    startResetAction() {
        if (!this.resetActionPromise) {
            const { log } = this.platform;
            this.setResetCharacteristic(this.resetSwitchService, true);
            this.resetActionPromise = this.fanResetService
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
    startRotationAction() {
        if (!this.rotationActionPromise) {
            const { log } = this.platform;
            this.setRotationCharacteristic(this.rotationSwitchService, true);
            this.rotationActionPromise = this.fanRotationService
                .rotate()
                .then(() => {
                log.info(`${ROTATION_LOG_PREFIX} completed for ${this.fanNameContext}.`);
            })
                .catch((error) => {
                log.error(ROTATION_OFFLINE_ERROR_MESSAGE, this.fanNameContext, error);
                throw error;
            })
                .finally(() => {
                this.setRotationCharacteristic(this.rotationSwitchService, false);
                this.rotationActionPromise = undefined;
            });
        }
        return this.rotationActionPromise;
    }
    async handleGetResetOn() {
        const service = this.resetSwitchService;
        if (!service) {
            return false;
        }
        return service.getCharacteristic(this.platform.api.hap.Characteristic.On).value;
    }
    async handleGetRotationOn() {
        const service = this.rotationSwitchService;
        if (!service) {
            return false;
        }
        return service.getCharacteristic(this.platform.api.hap.Characteristic.On).value;
    }
    setResetCharacteristic(service, value) {
        service?.getCharacteristic(this.platform.api.hap.Characteristic.On).updateValue(value);
    }
    setRotationCharacteristic(service, value) {
        service?.getCharacteristic(this.platform.api.hap.Characteristic.On).updateValue(value);
    }
    removeCachedResetSwitch() {
        const existing = this.getSwitchService(RESET_SERVICE_SUBTYPE);
        if (existing) {
            this.accessory.removeService(existing);
        }
    }
    removeCachedRotationSwitch() {
        const existing = this.getSwitchService(ROTATION_SERVICE_SUBTYPE);
        if (existing) {
            this.accessory.removeService(existing);
        }
    }
    getSwitchService(subtype) {
        const services = this.accessory.services;
        if (Array.isArray(services)) {
            return services.find((service) => service.subtype === subtype);
        }
        if (services instanceof Map) {
            for (const service of services.values()) {
                if (service.subtype === subtype) {
                    return service;
                }
            }
            return undefined;
        }
        return this.accessory.getService(this.platform.api.hap.Service.Switch);
    }
    isValidResetMethod(method) {
        return method === 'POST';
    }
    isValidRotationMethod(method) {
        return method === 'POST';
    }
    logResetConfigError(message) {
        this.platform.log.error(`${RESET_LOG_PREFIX} unavailable for ${this.fanNameContext}.`, message);
    }
    logRotationConfigError(message) {
        this.platform.log.error(`${ROTATION_LOG_PREFIX} unavailable for ${this.fanNameContext}.`, message);
    }
    removeSwingModeCharacteristic() {
        const service = this.service;
        const removeCharacteristic = service.removeCharacteristic;
        const swingModeCharacteristic = service.getCharacteristic?.(this.platform.api.hap.Characteristic.SwingMode);
        if (typeof removeCharacteristic === 'function' && swingModeCharacteristic) {
            removeCharacteristic.call(this.service, swingModeCharacteristic);
        }
    }
}
//# sourceMappingURL=platformAccessory.js.map