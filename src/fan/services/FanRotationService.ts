import type { FanRotationGatewayInterface } from './FanRotationGatewayInterface.js';
import type { FanRotationServiceInterface } from './FanRotationServiceInterface.js';

export class FanRotationService implements FanRotationServiceInterface {
  private inFlightRotation?: Promise<void>;

  constructor(private readonly fanRotationGateway: FanRotationGatewayInterface) {}

  rotate(): Promise<void> {
    if (this.inFlightRotation) {
      return this.inFlightRotation;
    }

    const rotationPromise = this.fanRotationGateway
      .rotate()
      .finally(() => {
        this.inFlightRotation = undefined;
      });

    this.inFlightRotation = rotationPromise;
    return rotationPromise;
  }
}
