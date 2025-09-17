import '../../../style/devicelist.css';
import { ApiClient } from '../../client/ApiClient';
import GoogDeviceDescriptor from '../../../types/GoogDeviceDescriptor';
import { DeviceState } from '../../../common/DeviceState';
import { HostItem } from '../../../types/Configuration';

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
            } else {
                // Show error state but keep UI visible
                this.devices = [];
                this.rebuildDeviceList();
                this.showErrorState(response.error || 'Failed to load devices');
            }
        } catch (error) {
            console.error('Failed to update devices:', error);
            // Show error state but keep UI visible
            this.devices = [];
            this.rebuildDeviceList();
            this.showErrorState('Connection error: ' + error);
        }
    }

    private buildDeviceTable(): void {
        let holder = document.getElementById('devices_holder');
        if (!holder) {
            holder = document.createElement('div');
            holder.id = 'devices_holder';
            document.body.appendChild(holder);
        }

        const devicesContainer = document.createElement('div');
        devicesContainer.id = 'devices';
        
        const deviceListContainer = document.createElement('div');
        deviceListContainer.className = 'device-list';
        deviceListContainer.id = 'device_list_container';
        
        devicesContainer.appendChild(deviceListContainer);
        
        holder.innerHTML = '';
        holder.appendChild(devicesContainer);
    }

    private showErrorState(error: string): void {
        const container = document.getElementById('device_list_container');
        if (!container) return;

        container.innerHTML = '';
        
        const errorState = document.createElement('div');
        errorState.className = 'error-state';
        
        const title = document.createElement('h3');
        title.textContent = 'Connection Error';
        
        const message = document.createElement('p');
        message.textContent = error;
        
        const retryButton = document.createElement('button');
        retryButton.className = 'action-btn secondary';
        retryButton.textContent = 'Retry';
        retryButton.onclick = () => this.retry();
        
        errorState.appendChild(title);
        errorState.appendChild(message);
        errorState.appendChild(retryButton);
        
        container.appendChild(errorState);
    }

    private rebuildDeviceList(): void {
        const container = document.getElementById('device_list_container');
        if (!container) return;

        container.innerHTML = '';

        if (this.devices.length === 0) {
            // Show empty state
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state';
            
            const title = document.createElement('h3');
            title.textContent = 'No devices found';
            
            const message = document.createElement('p');
            message.textContent = 'Connect an Android device and ensure ADB is running.';
            
            emptyState.appendChild(title);
            emptyState.appendChild(message);
            container.appendChild(emptyState);
            return;
        }

        this.devices.forEach(device => {
            const deviceCard = this.buildDeviceCard(device);
            container.appendChild(deviceCard);
        });
    }

    public retry(): void {
        this.updateDevices();
    }

    private buildDeviceCard(device: GoogDeviceDescriptor): HTMLElement {
        const isActive = device.state === DeviceState.DEVICE;
        const hasPid = device.pid !== -1;
        
        // Create the device card element
        const deviceCard = document.createElement('div');
        deviceCard.className = `device-card ${isActive ? 'active' : 'inactive'}`;
        
        // Create header
        const header = document.createElement('div');
        header.className = 'device-header';
        
        const deviceInfo = document.createElement('div');
        deviceInfo.className = 'device-info';
        
        const deviceName = document.createElement('h3');
        deviceName.className = 'device-name';
        deviceName.textContent = `${device['ro.product.manufacturer']} ${device['ro.product.model']}`;
        
        const deviceSerial = document.createElement('div');
        deviceSerial.className = 'device-serial';
        deviceSerial.textContent = device.udid;
        
        const deviceVersion = document.createElement('div');
        deviceVersion.className = 'device-version';
        deviceVersion.textContent = `Android ${device['ro.build.version.release']} (API ${device['ro.build.version.sdk']})`;
        
        deviceInfo.appendChild(deviceName);
        deviceInfo.appendChild(deviceSerial);
        deviceInfo.appendChild(deviceVersion);
        
        const deviceStatus = document.createElement('div');
        deviceStatus.className = 'device-status';
        
        const statusIndicator = document.createElement('div');
        statusIndicator.className = `status-indicator ${isActive ? 'online' : 'offline'}`;
        
        const statusText = document.createElement('span');
        statusText.className = 'status-text';
        statusText.textContent = isActive ? 'Online' : 'Offline';
        
        deviceStatus.appendChild(statusIndicator);
        deviceStatus.appendChild(statusText);
        
        header.appendChild(deviceInfo);
        header.appendChild(deviceStatus);
        
        // Create actions
        const actions = document.createElement('div');
        actions.className = 'device-actions';
        
        if (isActive) {
            this.buildActiveDeviceActionsDOM(actions, device, hasPid);
        } else {
            this.buildInactiveDeviceActionsDOM(actions, device);
        }
        
        deviceCard.appendChild(header);
        deviceCard.appendChild(actions);
        
        return deviceCard;
    }

    private buildActiveDeviceActionsDOM(container: HTMLElement, device: GoogDeviceDescriptor, hasPid: boolean): void {
        if (hasPid) {
            const streamBtn = document.createElement('button');
            streamBtn.className = 'action-btn primary';
            streamBtn.innerHTML = '▶ Start Stream';
            streamBtn.onclick = () => this.startStream(device.udid);
            container.appendChild(streamBtn);
            
            const stopBtn = document.createElement('button');
            stopBtn.className = 'action-btn danger';
            stopBtn.innerHTML = '✖ Stop Server';
            stopBtn.onclick = () => this.killServer(device.udid, device.pid);
            container.appendChild(stopBtn);
        } else {
            const startBtn = document.createElement('button');
            startBtn.className = 'action-btn secondary';
            startBtn.innerHTML = '🔄 Start Server';
            startBtn.onclick = () => this.startServer(device.udid);
            container.appendChild(startBtn);
        }
        
        const refreshBtn = document.createElement('button');
        refreshBtn.className = 'action-btn secondary';
        refreshBtn.innerHTML = '🔄 Refresh';
        refreshBtn.onclick = () => this.updateInterfaces(device.udid);
        container.appendChild(refreshBtn);
    }

    private buildInactiveDeviceActionsDOM(container: HTMLElement, device: GoogDeviceDescriptor): void {
        const inactiveInfo = document.createElement('div');
        inactiveInfo.className = 'inactive-info';
        
        const lastUpdate = device['last.update.timestamp'];
        const lastUpdateText = lastUpdate 
            ? `Last seen: ${new Date(lastUpdate).toLocaleString()}`
            : 'Never seen';
        inactiveInfo.textContent = lastUpdateText;
        
        container.appendChild(inactiveInfo);
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