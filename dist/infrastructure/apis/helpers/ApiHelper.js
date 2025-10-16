export class ApiHelper {
    static interpolate(obj, vars) {
        const out = {};
        for (const [k, v] of Object.entries(obj)) {
            if (typeof v === 'string') {
                out[k] = this.interpolateString(v, vars);
            }
            else if (v && typeof v === 'object' && !Array.isArray(v)) {
                out[k] = this.interpolate(v, vars);
            }
            else {
                out[k] = v;
            }
        }
        return out;
    }
    static interpolateString(s, vars) {
        if (!vars) {
            return s;
        }
        return s.replace(/\$\{(\w+)}/g, (_, k) => {
            const value = vars[k];
            return value == null ? '' : String(value);
        });
    }
}
//# sourceMappingURL=ApiHelper.js.map