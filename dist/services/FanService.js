export class FanService {
    apiClient;
    constructor(apiClient) {
        this.apiClient = apiClient;
    }
    async refresh(fanDevice) {
        const status = await this.apiClient.callWitRetry({
            endpoint: fanDevice.config.endpoints.getStatus,
            timeoutMs: fanDevice.config.timeoutMs ?? 5000,
            auth: fanDevice.config.auth,
        });
        if (!status) {
            return;
        }
        fanDevice.on = status.isOn;
        if (typeof status.speed === 'number') {
            fanDevice.setDeviceSpeed(status.speed);
        }
    }
    async isOn(fanDevice) {
        await this.refresh(fanDevice).catch(() => { });
        return fanDevice?.on ?? false;
    }
    async getSpeed(fanDevice) {
        this.refresh(fanDevice).catch(() => { });
        return fanDevice?.speed ?? 0;
    }
    async toggle(fanDevice, active) {
        const ep = active ? fanDevice.config.endpoints.start : fanDevice.config.endpoints.stop;
        if (!ep || fanDevice.on === active) {
            return;
        }
        await this.apiClient.call({
            endpoint: ep,
            timeoutMs: fanDevice.config.timeoutMs ?? 5000,
            auth: fanDevice.config.auth,
        });
        fanDevice.on = active;
    }
    async setSpeed(fanDevice, value) {
        if (!fanDevice.config.endpoints.setSpeed || !fanDevice.on) {
            return;
        }
        fanDevice.speed = value;
        const speed = fanDevice.getDeviceSpeed();
        await this.apiClient.call({
            endpoint: fanDevice.config.endpoints.setSpeed,
            timeoutMs: fanDevice.config.timeoutMs ?? 5000,
            auth: fanDevice.config.auth,
            variables: { speed },
        });
    }
}
//# sourceMappingURL=FanService.js.map