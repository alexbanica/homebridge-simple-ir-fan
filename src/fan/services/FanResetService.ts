import type { FanResetGatewayInterface } from './FanResetGatewayInterface.js';
import type { FanResetServiceInterface } from './FanResetServiceInterface.js';

export class FanResetService implements FanResetServiceInterface {
  private inFlightReset?: Promise<void>;

  constructor(private readonly fanResetGateway: FanResetGatewayInterface) {}

  reset(): Promise<void> {
    if (this.inFlightReset) {
      return this.inFlightReset;
    }

    const resetPromise = this.fanResetGateway
      .reset()
      .finally(() => {
        this.inFlightReset = undefined;
      });

    this.inFlightReset = resetPromise;
    return resetPromise;
  }
}
