export class FanDevice {
    on = false;
    speed = 0;
    rotation = false;
    config;
    constructor(config) {
        this.config = config;
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
    getDeviceSpeed() {
        return this.percentToSpeed(this.speed);
    }
    setDeviceSpeed(speed) {
        this.speed = this.speedToPercent(speed);
    }
}
//# sourceMappingURL=FanDevice.js.map