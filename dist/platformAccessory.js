import { ApiClient } from './infrastructure/apis/ApiClient.js';
import { FanService } from './services/FanService.js';
import { FanDevice } from './dtos/FanDevice.js';
export class SimpleIrFanAccessory {
    platform;
    accessory;
    device;
    service;
    fanService;
    fanDevice;
    constructor(platform, accessory, device) {
        this.platform = platform;
        this.accessory = accessory;
        this.device = device;
        const { api, log } = platform;
        this.fanService = new FanService(new ApiClient(log));
        this.fanDevice = new FanDevice(device);
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
        this.fanService.refresh(this.fanDevice).catch(() => { });
    }
    pushStateToHomeKit() {
        const { api } = this.platform;
        this.service.updateCharacteristic(api.hap.Characteristic.Active, this.fanDevice.on ? 1 : 0);
        this.service.updateCharacteristic(api.hap.Characteristic.RotationSpeed, this.fanDevice.speed);
        this.service.updateCharacteristic(api.hap.Characteristic.SwingMode, this.fanDevice.rotation ? 1 : 0);
    }
    async handleGetOn() {
        return await this.fanService.isOn(this.fanDevice).finally(() => this.pushStateToHomeKit()) ? 1 : 0;
    }
    async handleGetRotationSpeed() {
        return await this.fanService.getSpeed(this.fanDevice).finally(() => this.pushStateToHomeKit());
    }
    async handleGetSwingMode() {
        return await this.fanService.isRotating(this.fanDevice).finally(() => this.pushStateToHomeKit()) ? 1 : 0;
    }
    // Setters
    async handleSetOn(value) {
        const active = value === 1;
        await this.fanService.toggle(this.fanDevice, active);
    }
    async handleSetRotationSpeed(value) {
        await this.fanService.setSpeed(this.fanDevice, value).finally(() => this.pushStateToHomeKit());
    }
    async handleSetSwingMode(value) {
        await this.fanService.toggleRotate(this.fanDevice, value === 1).finally(() => this.pushStateToHomeKit());
    }
}
//# sourceMappingURL=platformAccessory.js.map