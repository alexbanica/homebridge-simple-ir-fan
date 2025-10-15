import { ApiClient } from './api_client.js';
export class SimpleIrFanAccessory {
    platform;
    accessory;
    device;
    service;
    apiClient;
    on = false;
    speed = 1;
    rotation = false;
    constructor(platform, accessory, device) {
        this.platform = platform;
        this.accessory = accessory;
        this.device = device;
        const { api, log } = platform;
        this.apiClient = new ApiClient(log);
        accessory.getService(api.hap.Service.AccessoryInformation)
            .setCharacteristic(api.hap.Characteristic.Manufacturer, device.manufacturer)
            .setCharacteristic(api.hap.Characteristic.Model, device.model)
            .setCharacteristic(api.hap.Characteristic.SerialNumber, device.serialNumber);
        this.service = accessory.getService(api.hap.Service.Fanv2) || accessory.addService(api.hap.Service.Fanv2, device.name);
        // On characteristic
        this.service.getCharacteristic(api.hap.Characteristic.Active)
            .onGet(this.handleGetOn.bind(this))
            .onSet(this.handleSetOn.bind(this));
        // RotationSpeed maps 1..3 to 0..100
        this.service.getCharacteristic(api.hap.Characteristic.RotationSpeed)
            .setProps({ minValue: 0, maxValue: 100, minStep: 1 })
            .onGet(this.handleGetRotationSpeed.bind(this))
            .onSet(this.handleSetRotationSpeed.bind(this));
        // Use SwingMode to represent oscillation On/Off (Start/Stop rotation)
        this.service.getCharacteristic(api.hap.Characteristic.SwingMode)
            .onGet(this.handleGetSwingMode.bind(this))
            .onSet(this.handleSetSwingMode.bind(this));
        // Initial status fetch
        this.refreshFromStatus().catch(() => { });
    }
    speedToPercent(s) {
        if (s <= 1) {
            return 33;
        }
        if (s === 2) {
            return 66;
        }
        return 100;
    }
    percentToSpeed(p) {
        if (p <= 33) {
            return 1;
        }
        if (p <= 66) {
            return 2;
        }
        return 3;
    }
    async refreshFromStatus() {
        const status = await this.apiClient.getStatusWithRetry({
            endpoint: this.device.endpoints.getStatus,
            timeoutMs: this.device.timeoutMs ?? 5000,
            auth: this.device.auth,
        });
        if (status) {
            this.on = status.isOn;
            if (typeof status.speed === 'number') {
                this.speed = Math.min(3, Math.max(1, Math.round(status.speed)));
            }
            if (typeof status.isRotating === 'boolean') {
                this.rotation = status.isRotating;
            }
            this.pushStateToHomeKit();
        }
    }
    pushStateToHomeKit() {
        const { api } = this.platform;
        this.service.updateCharacteristic(api.hap.Characteristic.Active, this.on ? 1 : 0);
        this.service.updateCharacteristic(api.hap.Characteristic.RotationSpeed, this.speedToPercent(this.speed));
        this.service.updateCharacteristic(api.hap.Characteristic.SwingMode, this.rotation ? 1 : 0);
    }
    // Getters
    async handleGetOn() {
        await this.refreshFromStatus().catch(() => { });
        return this.on ? 1 : 0;
    }
    async handleGetRotationSpeed() {
        await this.refreshFromStatus().catch(() => { });
        return this.speedToPercent(this.speed);
    }
    async handleGetSwingMode() {
        await this.refreshFromStatus().catch(() => { });
        return this.rotation ? 1 : 0;
    }
    // Setters
    async handleSetOn(value) {
        const active = value === 1;
        const ep = active ? this.device.endpoints.start : this.device.endpoints.stop;
        if (!ep) {
            return;
        }
        await this.apiClient.call({
            endpoint: ep,
            timeoutMs: this.device.timeoutMs ?? 5000,
            auth: this.device.auth,
        });
        this.on = active;
    }
    async handleSetRotationSpeed(value) {
        const speed = this.percentToSpeed(value);
        if (!this.device.endpoints.setSpeed) {
            return;
        }
        await this.apiClient.call({
            endpoint: this.device.endpoints.setSpeed,
            timeoutMs: this.device.timeoutMs ?? 5000,
            auth: this.device.auth,
            variables: { speed },
        });
        this.speed = speed;
        // If speed > 0, ensure Active=1 for better UX
        if (speed > 0) {
            this.on = true;
            this.service.updateCharacteristic(this.platform.api.hap.Characteristic.Active, 1);
        }
    }
    async handleSetSwingMode(value) {
        const on = value === 1;
        const ep = on ? this.device.endpoints.startRotation : this.device.endpoints.stopRotation;
        if (!ep) {
            return;
        }
        await this.apiClient.call({
            endpoint: ep,
            timeoutMs: this.device.timeoutMs ?? 5000,
            auth: this.device.auth,
        });
        this.rotation = on;
    }
}
//# sourceMappingURL=platformAccessory.js.map