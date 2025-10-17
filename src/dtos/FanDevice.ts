import { FanDeviceConfig } from './FanDeviceConfig.js';

export class FanDevice {

  private _on = false;
  public speed = 0;
  public rotation = false;
  public config: FanDeviceConfig;
  private readonly minDeviceSpeed: number;
  private readonly maxDeviceSpeed: number;
  private readonly onDeviceSpeed: number;

  constructor(config: FanDeviceConfig) {
    this.config = config;
    this.minDeviceSpeed = 0;
    this.onDeviceSpeed = 1;
    this.maxDeviceSpeed = 3;
  }

  private speedToPercent(s: number): number {
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

  private percentToSpeed(p: number): 0 | 1 | 2 | 3 {
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

  public getDeviceSpeed(): number {
    return this.percentToSpeed(this.speed);
  }

  public setDeviceSpeed(speed: number): void {
    speed = Math.min(this.maxDeviceSpeed, Math.max(this.minDeviceSpeed, Math.round(speed)));
    this.speed = this.speedToPercent(speed);
  }

  set on(on: boolean) {
    this._on = on;
    if (on) {
      this.setDeviceSpeed(this.onDeviceSpeed);
    } else {
      this.setDeviceSpeed(this.minDeviceSpeed);
    }
  }
  get on() {
    return this._on;
  }
}