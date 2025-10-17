export class FanDevice {
    _on = false;
    speed = 0;
    rotation = false;
    config;
    minDeviceSpeed;
    maxDeviceSpeed;
    onDeviceSpeed;
    constructor(config) {
        this.config = config;
        this.minDeviceSpeed = 0;
        this.onDeviceSpeed = 1;
        this.maxDeviceSpeed = 3;
    }
    speedToPercent(s) {
        if (s === 0) {
            return 0;
        }
        if (s === 1) {
            return 33;
        }
        if (s === 2) {
            return 66;
        }
        return 100;
    }
    percentToSpeed(p) {
        if (p === 0) {
            return 0;
        }
        if (p <= 33) {
            return 1;
        }
        if (p <= 66) {
            return 2;
        }
        return 3;
    }
    getDeviceSpeed() {
        return this.percentToSpeed(this.speed);
    }
    setDeviceSpeed(speed) {
        speed = Math.min(this.maxDeviceSpeed, Math.max(this.minDeviceSpeed, Math.round(speed)));
        this.speed = this.speedToPercent(speed);
    }
    set on(on) {
        this._on = on;
        if (on) {
            this.setDeviceSpeed(this.onDeviceSpeed);
        }
        else {
            this.setDeviceSpeed(this.minDeviceSpeed);
        }
    }
    get on() {
        return this._on;
    }
}
//# sourceMappingURL=FanDevice.js.map