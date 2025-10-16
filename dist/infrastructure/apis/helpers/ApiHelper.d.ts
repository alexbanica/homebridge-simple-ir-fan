export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export declare class ApiHelper {
    static interpolate(obj: Record<string, unknown>, vars?: Record<string, string | number | boolean | null | undefined>): Record<string, unknown>;
    static interpolateString(s: string, vars?: Record<string, string | number | boolean | null | undefined>): string;
}
