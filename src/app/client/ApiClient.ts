import { ParamsBase } from '../../types/ParamsBase';
import GoogDeviceDescriptor from '../../types/GoogDeviceDescriptor';

export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
}

export interface DevicesResponse {
    devices: GoogDeviceDescriptor[];
    id: string;
}

export interface StreamOptions {
    player?: string;
    videoSettings?: any;
}

export class ApiClient {
    private baseUrl: string;

    constructor(params: ParamsBase) {
        const { hostname, port, secure, pathname } = params;
        const protocol = secure ? 'https:' : 'http:';
        const host = hostname || location.hostname;
        const portStr = port ? `:${port}` : '';
        const path = pathname || location.pathname;
        this.baseUrl = `${protocol}//${host}${portStr}${path}api`;
    }

    private async request<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options?.headers,
                },
                ...options,
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    public async getDevices(): Promise<ApiResponse<DevicesResponse>> {
        return this.request<DevicesResponse>('/devices');
    }

    public async getDevice(udid: string): Promise<ApiResponse<GoogDeviceDescriptor>> {
        return this.request<GoogDeviceDescriptor>(`/devices/${udid}`);
    }

    public async startStream(udid: string, options: StreamOptions = {}): Promise<ApiResponse> {
        return this.request(`/devices/${udid}/stream/start`, {
            method: 'POST',
            body: JSON.stringify(options),
        });
    }

    public async stopStream(udid: string): Promise<ApiResponse> {
        return this.request(`/devices/${udid}/stream/stop`, {
            method: 'POST',
        });
    }

    public async startServer(udid: string): Promise<ApiResponse> {
        return this.request(`/devices/${udid}/server/start`, {
            method: 'POST',
        });
    }

    public async killServer(udid: string, pid: number): Promise<ApiResponse> {
        return this.request(`/devices/${udid}/server/kill`, {
            method: 'POST',
            body: JSON.stringify({ pid }),
        });
    }

    public async updateInterfaces(udid: string): Promise<ApiResponse> {
        return this.request(`/devices/${udid}/interfaces/update`, {
            method: 'POST',
        });
    }
}