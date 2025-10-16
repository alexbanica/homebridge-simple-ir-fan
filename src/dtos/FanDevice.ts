import { FanDeviceConfig } from './FanDeviceConfig.js';

export class FanDevice {

  public on = false;
  public speed = 0;
  public rotation = false;
  public config: FanDeviceConfig;

  constructor(config: FanDeviceConfig) {
    this.config = config;
  }

  private speedToPercent(s: number): number {
    if (s <= 1) {
      return 33;
    }
    if (s === 2) {
      return 66;
    }
    return 100;
  }

  private percentToSpeed(p: number): 1 | 2 | 3 {
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
    this.speed = this.speedToPercent(speed);
  }
}