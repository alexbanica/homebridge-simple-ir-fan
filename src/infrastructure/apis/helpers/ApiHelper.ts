export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';


export class ApiHelper {

  public static interpolate(
    obj: Record<string, unknown>,
    vars?: Record<string, string | number | boolean | null | undefined>,
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string') {
        out[k] = this.interpolateString(v, vars);
      } else if (v && typeof v === 'object' && !Array.isArray(v)) {
        out[k] = this.interpolate(v as Record<string, unknown>, vars);
      } else {
        out[k] = v;
      }
    }
    return out;
  }

  public static interpolateString(
    s: string,
    vars?: Record<string, string | number | boolean | null | undefined>,
  ): string {
    if (!vars) {
      return s;
    }
    return s.replace(/\$\{(\w+)}/g, (_, k: string) => {
      const value = vars[k as keyof typeof vars];
      return value == null ? '' : String(value);
    });
  }
}