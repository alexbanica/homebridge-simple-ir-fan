import { SimpleIrFanPlatform } from './platform.js';
import { PLATFORM_NAME } from './settings.js';
/**
 * This method registers the platform with Homebridge
 */
export default (api) => {
    api.registerPlatform(PLATFORM_NAME, SimpleIrFanPlatform);
};
//# sourceMappingURL=index.js.map