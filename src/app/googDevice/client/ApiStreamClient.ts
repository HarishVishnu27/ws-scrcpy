import { ApiClient } from '../../client/ApiClient';
import { ParamsStream } from '../../../types/ParamsStream';
import { BasePlayer } from '../../player/BasePlayer';
import { MsePlayer } from '../../player/MsePlayer';

export class ApiStreamClient {
    protected params: ParamsStream;
    protected apiClient: ApiClient;
    protected udid: string;
    protected player?: BasePlayer;
    protected videoWrapper: HTMLElement;
    protected deviceView?: HTMLDivElement;

    constructor(params: ParamsStream) {
        this.params = params;
        this.udid = params.udid;
        this.apiClient = new ApiClient(params);
        this.videoWrapper = document.createElement('div');
        this.videoWrapper.className = 'video';
    }

    public static start(params: ParamsStream): void {
        const client = new ApiStreamClient(params);
        client.startStream();
    }

    protected async startStream(): Promise<void> {
        try {
            // Create the video player (only H264 Converter/MsePlayer)
            this.player = new MsePlayer(this.udid);
            
            // Setup the device view
            const deviceView = document.createElement('div');
            deviceView.className = 'device-view';
            this.deviceView = deviceView;

            // Create video container
            const video = document.createElement('div');
            video.className = 'video';
            deviceView.appendChild(video);

            // Create simple control panel
            const controls = this.createControls();
            deviceView.appendChild(controls);

            // Add to document
            document.body.appendChild(deviceView);

            // Initialize player
            this.player.setParent(video);
            this.player.play();

            // Start the stream via API
            const response = await this.apiClient.startStream(this.udid, {
                player: 'MsePlayer'
            });

            if (!response.success) {
                throw new Error(response.error || 'Failed to start stream');
            }

        } catch (error) {
            console.error('Failed to start stream:', error);
            alert(`Failed to start stream: ${error}`);
        }
    }

    private createControls(): HTMLElement {
        const controls = document.createElement('div');
        controls.className = 'stream-controls';
        
        controls.innerHTML = `
            <div class="control-panel">
                <button id="stop-stream" class="control-btn danger">Stop Stream</button>
                <button id="back-to-devices" class="control-btn secondary">Back to Devices</button>
                <div class="stream-info">
                    <span>Device: ${this.udid}</span>
                    <span>Player: H264 Converter</span>
                </div>
            </div>
        `;

        // Add event listeners
        const stopBtn = controls.querySelector('#stop-stream') as HTMLButtonElement;
        const backBtn = controls.querySelector('#back-to-devices') as HTMLButtonElement;

        stopBtn.addEventListener('click', () => this.stopStream());
        backBtn.addEventListener('click', () => this.backToDevices());

        return controls;
    }

    protected async stopStream(): Promise<void> {
        try {
            // Stop the player
            if (this.player) {
                this.player.stop();
            }

            // Stop the stream via API
            await this.apiClient.stopStream(this.udid);

            // Clean up UI
            if (this.deviceView && this.deviceView.parentElement) {
                this.deviceView.parentElement.removeChild(this.deviceView);
            }

            // Go back to device list
            this.backToDevices();

        } catch (error) {
            console.error('Failed to stop stream:', error);
        }
    }

    protected backToDevices(): void {
        // Navigate back to the device list
        window.location.href = '/';
    }

    public getDeviceName(): string {
        return this.udid;
    }
}