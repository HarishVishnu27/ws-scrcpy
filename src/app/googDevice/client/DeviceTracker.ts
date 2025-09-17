import '../../../style/devicelist.css';
import { BaseDeviceTracker } from '../../client/BaseDeviceTracker';
import { SERVER_PORT } from '../../../common/Constants';
import { ACTION } from '../../../common/Action';
import GoogDeviceDescriptor from '../../../types/GoogDeviceDescriptor';
import { ControlCenterCommand } from '../../../common/ControlCenterCommand';
import { StreamClientScrcpy } from './StreamClientScrcpy';
import { html } from '../../ui/HtmlTag';
import Util from '../../Util';
import { Attribute } from '../../Attribute';
import { DeviceState } from '../../../common/DeviceState';
import { Message } from '../../../types/Message';
import { ParamsDeviceTracker } from '../../../types/ParamsDeviceTracker';
import { HostItem } from '../../../types/Configuration';
import { ChannelCode } from '../../../common/ChannelCode';
import { Tool } from '../../client/Tool';

export class DeviceTracker extends BaseDeviceTracker<GoogDeviceDescriptor, never> {
    public static readonly ACTION = ACTION.GOOG_DEVICE_LIST;
    public static readonly CREATE_DIRECT_LINKS = true;
    private static instancesByUrl: Map<string, DeviceTracker> = new Map();
    protected static tools: Set<Tool> = new Set();
    protected tableId = 'goog_device_list';

    public static start(hostItem: HostItem): DeviceTracker {
        const url = this.buildUrlForTracker(hostItem).toString();
        let instance = this.instancesByUrl.get(url);
        if (!instance) {
            instance = new DeviceTracker(hostItem, url);
        }
        return instance;
    }

    public static getInstance(hostItem: HostItem): DeviceTracker {
        return this.start(hostItem);
    }

    protected constructor(params: HostItem, directUrl: string) {
        super({ ...params, action: DeviceTracker.ACTION }, directUrl);
        DeviceTracker.instancesByUrl.set(directUrl, this);
        this.buildDeviceTable();
        this.openNewConnection();
    }

    protected onSocketOpen(): void {
        // nothing here;
    }

    protected setIdAndHostName(id: string, hostName: string): void {
        super.setIdAndHostName(id, hostName);
        for (const value of DeviceTracker.instancesByUrl.values()) {
            if (value.id === id && value !== this) {
                console.warn(
                    `Tracker with url: "${this.url}" has the same id(${this.id}) as tracker with url "${value.url}"`,
                );
                console.warn(`This tracker will shut down`);
                this.destroy();
            }
        }
    }

    onInterfaceSelected = (event: Event): void => {
        const selectElement = event.currentTarget as HTMLSelectElement;
        const option = selectElement.selectedOptions[0];
        const url = decodeURI(option.getAttribute(Attribute.URL) || '');
        const name = option.getAttribute(Attribute.NAME) || '';
        const fullName = decodeURIComponent(selectElement.getAttribute(Attribute.FULL_NAME) || '');
        const udid = selectElement.getAttribute(Attribute.UDID) || '';
        this.updateLink({ url, name, fullName, udid, store: true });
    };

    private updateLink(params: { url: string; name: string; fullName: string; udid: string; store: boolean }): void {
        const { url, name, fullName, udid, store } = params;
        const playerTds = document.getElementsByName(
            encodeURIComponent(`${DeviceTracker.AttributePrefixPlayerFor}${fullName}`),
        );
        if (typeof udid !== 'string') {
            return;
        }
        if (store) {
            const localStorageKey = DeviceTracker.getLocalStorageKey(fullName || '');
            if (localStorage && name) {
                localStorage.setItem(localStorageKey, name);
            }
        }
        const action = ACTION.STREAM_SCRCPY;
        playerTds.forEach((item) => {
            item.innerHTML = '';
            const playerFullName = item.getAttribute(DeviceTracker.AttributePlayerFullName);
            const playerCodeName = item.getAttribute(DeviceTracker.AttributePlayerCodeName);
            if (!playerFullName || !playerCodeName) {
                return;
            }
            const link = DeviceTracker.buildLink(
                {
                    action,
                    udid,
                    player: decodeURIComponent(playerCodeName),
                    ws: url,
                },
                decodeURIComponent(playerFullName),
                this.params,
            );
            item.appendChild(link);
        });
    }

    onActionButtonClick = (event: MouseEvent): void => {
        const button = event.currentTarget as HTMLButtonElement;
        const udid = button.getAttribute(Attribute.UDID);
        const pidString = button.getAttribute(Attribute.PID) || '';
        const command = button.getAttribute(Attribute.COMMAND) as string;
        const pid = parseInt(pidString, 10);
        const data: Message = {
            id: this.getNextId(),
            type: command,
            data: {
                udid: typeof udid === 'string' ? udid : undefined,
                pid: isNaN(pid) ? undefined : pid,
            },
        };

        if (this.ws && this.ws.readyState === this.ws.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    };

    private static getLocalStorageKey(udid: string): string {
        return `device_list::${udid}::interface`;
    }

    protected static createUrl(params: ParamsDeviceTracker, udid = ''): URL {
        const secure = !!params.secure;
        const hostname = params.hostname || location.hostname;
        const port = typeof params.port === 'number' ? params.port : secure ? 443 : 80;
        const pathname = params.pathname || location.pathname;
        const urlObject = this.buildUrl({ ...params, secure, hostname, port, pathname });
        if (udid) {
            urlObject.searchParams.set('action', ACTION.PROXY_ADB);
            urlObject.searchParams.set('remote', `tcp:${SERVER_PORT.toString(10)}`);
            urlObject.searchParams.set('udid', udid);
        }
        return urlObject;
    }

    protected static createInterfaceOption(name: string, url: string): HTMLOptionElement {
        const optionElement = document.createElement('option');
        optionElement.setAttribute(Attribute.URL, url);
        optionElement.setAttribute(Attribute.NAME, name);
        optionElement.innerText = `proxy over adb`;
        return optionElement;
    }

    protected buildDeviceRow(tbody: Element, device: GoogDeviceDescriptor): void {
        const fullName = `${this.id}_${Util.escapeUdid(device.udid)}`;
        const blockClass = 'desc-block';
        const isActive = device.state === DeviceState.DEVICE;
        let hasPid = false;

        // Create device card in Appium-style layout
        const card = html`<div class="device-card ${isActive ? 'active' : 'not-active'}">
            <div class="device-card-header">
                <div class="device-status-indicator ${isActive ? 'online' : 'offline'}"></div>
                <div class="device-main-info">
                    <div class="device-name">${device['ro.product.manufacturer']} ${device['ro.product.model']}</div>
                    <div class="device-serial">ID: ${device.udid}</div>
                </div>
            </div>
            <div class="device-card-body">
                <div class="device-specs">
                    <div class="spec-item">
                        <span class="spec-label">Android:</span>
                        <span class="spec-value">${device['ro.build.version.release']}</span>
                    </div>
                    <div class="spec-item">
                        <span class="spec-label">API Level:</span>
                        <span class="spec-value">${device['ro.build.version.sdk']}</span>
                    </div>
                    <div class="spec-item">
                        <span class="spec-label">Status:</span>
                        <span class="spec-value ${isActive ? 'status-online' : 'status-offline'}"
                            >${isActive ? 'Online' : 'Offline'}</span
                        >
                    </div>
                </div>
            </div>
            <div class="device-card-footer" id="device_actions_${Util.escapeUdid(device.udid)}"></div>
        </div>`.content;

        const actionsContainer = card.getElementById(`device_actions_${Util.escapeUdid(device.udid)}`);
        if (!actionsContainer) {
            return;
        }

        // Add the streaming button only (H264 Converter)
        const streamEntry = StreamClientScrcpy.createEntryForDeviceList(device, blockClass, fullName, this.params);
        if (streamEntry) {
            // Modify the button to be more card-like
            const streamButton = streamEntry.querySelector('button');
            if (streamButton) {
                streamButton.classList.add('device-action-button', 'stream-button');
                streamButton.innerHTML = '<span>Start Streaming</span>';
            }
            actionsContainer.appendChild(streamEntry);
        }

        // Add server control buttons for active devices
        if (isActive) {
            const serverPid = device.pid;
            hasPid = serverPid !== -1;

            const serverButton = document.createElement('button');
            serverButton.classList.add('device-action-button', 'server-button');
            serverButton.setAttribute(Attribute.UDID, device.udid);
            serverButton.setAttribute(Attribute.PID, serverPid.toString());

            if (hasPid) {
                serverButton.setAttribute(Attribute.COMMAND, ControlCenterCommand.KILL_SERVER);
                serverButton.innerHTML = '<span>Stop Server</span>';
                serverButton.classList.add('stop-server');
                serverButton.title = 'Stop server';
            } else {
                serverButton.setAttribute(Attribute.COMMAND, ControlCenterCommand.START_SERVER);
                serverButton.innerHTML = '<span>Start Server</span>';
                serverButton.classList.add('start-server');
                serverButton.title = 'Start server';
            }

            serverButton.onclick = this.onActionButtonClick;
            actionsContainer.appendChild(serverButton);
        }

        tbody.appendChild(card);

        if (DeviceTracker.CREATE_DIRECT_LINKS && hasPid && isActive) {
            // Update any direct links if needed
            const proxyInterfaceUrl = DeviceTracker.createUrl(this.params, device.udid).toString();
            this.updateLink({
                url: proxyInterfaceUrl,
                name: 'proxy',
                fullName,
                udid: device.udid,
                store: false,
            });
        }
    }

    protected getChannelCode(): string {
        return ChannelCode.GTRC;
    }

    public destroy(): void {
        super.destroy();
        DeviceTracker.instancesByUrl.delete(this.url.toString());
        if (!DeviceTracker.instancesByUrl.size) {
            const holder = document.getElementById(BaseDeviceTracker.HOLDER_ELEMENT_ID);
            if (holder && holder.parentElement) {
                holder.parentElement.removeChild(holder);
            }
        }
    }
}
