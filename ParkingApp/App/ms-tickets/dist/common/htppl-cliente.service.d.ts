export declare class HttpClientService {
    private readonly logger;
    get<T>(url: string, authHeader?: string): Promise<T>;
    post<T>(url: string, body: unknown, authHeader?: string): Promise<T>;
    put<T>(url: string, authHeader?: string): Promise<T>;
    private buildHeaders;
}
