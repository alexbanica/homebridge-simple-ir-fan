export class FanDevice {
    on = false;
    speed = 0;
    rotation = false;
    config;
    minSpeed;
    maxSpeed;
    constructor(config) {
        this.config = config;
        this.minSpeed = 0;
        this.maxSpeed = 3;
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
        speed = Math.min(this.maxSpeed, Math.max(this.minSpeed, Math.round(speed)));
        this.speed = this.speedToPercent(speed);
    }
}
//# sourceMappingURL=FanDevice.js.map