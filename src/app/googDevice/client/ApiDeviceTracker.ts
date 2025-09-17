import '../../../style/devicelist.css';
import { ApiClient } from '../../client/ApiClient';
import GoogDeviceDescriptor from '../../../types/GoogDeviceDescriptor';
import { DeviceState } from '../../../common/DeviceState';
import { HostItem } from '../../../types/Configuration';
import { html } from '../../ui/HtmlTag';

export class ApiDeviceTracker {
    private static instancesByUrl: Map<string, ApiDeviceTracker> = new Map();
    private apiClient: ApiClient;
    private devices: GoogDeviceDescriptor[] = [];
    private params: HostItem;
    private pollInterval: number = 2000; // Poll every 2 seconds
    private pollTimeoutId?: number;

    public static start(hostItem: HostItem): ApiDeviceTracker {
        const url = this.buildUrlForTracker(hostItem).toString();
        let instance = this.instancesByUrl.get(url);
        if (!instance) {
            instance = new ApiDeviceTracker(hostItem);
            this.instancesByUrl.set(url, instance);
        }
        return instance;
    }

    private static buildUrlForTracker(hostItem: HostItem): URL {
        const { hostname, port, secure, pathname } = hostItem;
        const protocol = secure ? 'https:' : 'http:';
        const host = hostname || location.hostname;
        const portStr = port ? `:${port}` : '';
        const path = pathname || location.pathname;
        return new URL(`${protocol}//${host}${portStr}${path}`);
    }

    constructor(params: HostItem) {
        this.params = params;
        const apiParams = { ...params, action: 'api' };
        this.apiClient = new ApiClient(apiParams);
        this.buildDeviceTable();
        this.startPolling();
    }

    private async startPolling(): Promise<void> {
        await this.updateDevices();
        this.pollTimeoutId = window.setTimeout(() => {
            this.startPolling();
        }, this.pollInterval);
    }

    private async updateDevices(): Promise<void> {
        try {
            const response = await this.apiClient.getDevices();
            if (response.success && response.data) {
                this.devices = response.data.devices;
                this.rebuildDeviceList();
            }
        } catch (error) {
            console.error('Failed to update devices:', error);
        }
    }

    private buildDeviceTable(): void {
        let holder = document.getElementById('devices_holder');
        if (!holder) {
            holder = document.createElement('div');
            holder.id = 'devices_holder';
            document.body.appendChild(holder);
        }

        const deviceList = html`<div id="devices">
            <div class="device-list" id="device_list_container">
                <!-- Devices will be populated here -->
            </div>
        </div>`.content;

        holder.innerHTML = '';
        holder.appendChild(deviceList);
    }

    private rebuildDeviceList(): void {
        const container = document.getElementById('device_list_container');
        if (!container) return;

        container.innerHTML = '';

        this.devices.forEach(device => {
            const deviceCard = this.buildDeviceCard(device);
            container.appendChild(deviceCard);
        });
    }

    private buildDeviceCard(device: GoogDeviceDescriptor): HTMLElement {
        const isActive = device.state === DeviceState.DEVICE;
        const hasPid = device.pid !== -1;
        
        const deviceCard = html`<div class="device-card ${isActive ? 'active' : 'inactive'}">
            <div class="device-header">
                <div class="device-info">
                    <h3 class="device-name">${device['ro.product.manufacturer']} ${device['ro.product.model']}</h3>
                    <div class="device-serial">${device.udid}</div>
                    <div class="device-version">
                        Android ${device['ro.build.version.release']} (API ${device['ro.build.version.sdk']})
                    </div>
                </div>
                <div class="device-status">
                    <div class="status-indicator ${isActive ? 'online' : 'offline'}"></div>
                    <span class="status-text">${isActive ? 'Online' : 'Offline'}</span>
                </div>
            </div>
            <div class="device-actions">
                ${isActive ? this.buildActiveDeviceActions(device, hasPid) : this.buildInactiveDeviceActions(device)}
            </div>
        </div>`.content;

        const firstChild = deviceCard.firstElementChild;
        return firstChild as HTMLElement;
    }

    private buildActiveDeviceActions(device: GoogDeviceDescriptor, hasPid: boolean): string {
        const streamButton = hasPid 
            ? `<button class="action-btn primary" onclick="window.deviceTracker.startStream('${device.udid}')">
                ▶ Start Stream
               </button>`
            : `<button class="action-btn secondary" onclick="window.deviceTracker.startServer('${device.udid}')">
                🔄 Start Server
               </button>`;

        const serverButton = hasPid
            ? `<button class="action-btn danger" onclick="window.deviceTracker.killServer('${device.udid}', ${device.pid})">
                ✖ Stop Server
               </button>`
            : '';

        return `
            ${streamButton}
            ${serverButton}
            <button class="action-btn secondary" onclick="window.deviceTracker.updateInterfaces('${device.udid}')">
                🔄 Refresh
            </button>
        `;
    }

    private buildInactiveDeviceActions(device: GoogDeviceDescriptor): string {
        const lastUpdate = device['last.update.timestamp'];
        const lastUpdateText = lastUpdate 
            ? `Last seen: ${new Date(lastUpdate).toLocaleString()}`
            : 'Never seen';
            
        return `<div class="inactive-info">${lastUpdateText}</div>`;
    }

    public async startStream(udid: string): Promise<void> {
        try {
            const response = await this.apiClient.startStream(udid, { 
                player: 'MsePlayer' // Only H264 Converter (MsePlayer)
            });
            
            if (response.success) {
                // Navigate to stream page
                const streamUrl = this.buildStreamUrl(udid);
                window.location.href = streamUrl;
            } else {
                alert(`Failed to start stream: ${response.error}`);
            }
        } catch (error) {
            alert(`Error starting stream: ${error}`);
        }
    }

    public async startServer(udid: string): Promise<void> {
        try {
            const response = await this.apiClient.startServer(udid);
            if (response.success) {
                // Refresh device list after a short delay
                setTimeout(() => this.updateDevices(), 1000);
            } else {
                alert(`Failed to start server: ${response.error}`);
            }
        } catch (error) {
            alert(`Error starting server: ${error}`);
        }
    }

    public async killServer(udid: string, pid: number): Promise<void> {
        try {
            const response = await this.apiClient.killServer(udid, pid);
            if (response.success) {
                // Refresh device list after a short delay
                setTimeout(() => this.updateDevices(), 1000);
            } else {
                alert(`Failed to kill server: ${response.error}`);
            }
        } catch (error) {
            alert(`Error killing server: ${error}`);
        }
    }

    public async updateInterfaces(udid: string): Promise<void> {
        try {
            const response = await this.apiClient.updateInterfaces(udid);
            if (response.success) {
                // Refresh device list after a short delay
                setTimeout(() => this.updateDevices(), 1000);
            } else {
                alert(`Failed to update interfaces: ${response.error}`);
            }
        } catch (error) {
            alert(`Error updating interfaces: ${error}`);
        }
    }

    private buildStreamUrl(udid: string): string {
        const params = new URLSearchParams();
        params.set('action', 'stream');
        params.set('udid', udid);
        params.set('player', 'MsePlayer');
        if (this.params.hostname) params.set('hostname', this.params.hostname);
        if (this.params.port) params.set('port', this.params.port.toString());
        if (this.params.secure) params.set('secure', 'true');
        if (this.params.pathname) params.set('pathname', this.params.pathname);
        
        return `#!/${params.toString()}`;
    }

    public destroy(): void {
        if (this.pollTimeoutId) {
            clearTimeout(this.pollTimeoutId);
        }
        const key = ApiDeviceTracker.buildUrlForTracker(this.params).toString();
        ApiDeviceTracker.instancesByUrl.delete(key);
    }
}

// Make it globally accessible for button clicks
declare global {
    interface Window {
        deviceTracker: ApiDeviceTracker;
    }
}