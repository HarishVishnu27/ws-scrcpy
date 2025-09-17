import '../../../style/dialog.css';
import GoogDeviceDescriptor from '../../../types/GoogDeviceDescriptor';
import { DisplayCombinedInfo } from '../../client/StreamReceiver';
import VideoSettings from '../../VideoSettings';
import { StreamClientScrcpy } from './StreamClientScrcpy';
import Size from '../../Size';
import Util from '../../Util';
import { DisplayInfo } from '../../DisplayInfo';
import { ToolBoxButton } from '../../toolbox/ToolBoxButton';
import SvgImage from '../../ui/SvgImage';
import { PlayerClass } from '../../player/BasePlayer';
import { DeviceTracker } from './DeviceTracker';
import { Attribute } from '../../Attribute';
import { StreamReceiverScrcpy } from './StreamReceiverScrcpy';
import { ParamsStreamScrcpy } from '../../../types/ParamsStreamScrcpy';
import { BaseClient } from '../../client/BaseClient';

interface ConfigureScrcpyEvents {
    closed: { dialog: ConfigureScrcpy; result: boolean };
}

export class ConfigureScrcpy extends BaseClient<ParamsStreamScrcpy, ConfigureScrcpyEvents> {
    private readonly TAG: string;
    private readonly udid: string;
    private readonly escapedUdid: string;
    private readonly playerStorageKey: string;
    private deviceName: string;
    private streamReceiver?: StreamReceiverScrcpy;
    private playerName?: string;
    private displayInfo?: DisplayInfo;
    private background: HTMLElement;
    private dialogBody?: HTMLElement;
    private okButton?: HTMLButtonElement;
    private fitToScreenCheckbox?: HTMLInputElement;
    private resetSettingsButton?: HTMLButtonElement;
    private loadSettingsButton?: HTMLButtonElement;
    private saveSettingsButton?: HTMLButtonElement;
    private playerSelectElement?: HTMLSelectElement;
    private displayIdSelectElement?: HTMLSelectElement;
    private encoderSelectElement?: HTMLSelectElement;
    private connectionStatusElement?: HTMLElement;
    private dialogContainer?: HTMLElement;
    private statusText = '';
    private connectionCount = 0;

    constructor(private readonly tracker: DeviceTracker, descriptor: GoogDeviceDescriptor, params: ParamsStreamScrcpy) {
        super(params);
        this.udid = descriptor.udid;
        this.escapedUdid = Util.escapeUdid(this.udid);
        this.playerStorageKey = `configure_stream::${this.escapedUdid}::player`;
        this.deviceName = descriptor['ro.product.model'];
        this.TAG = `ConfigureScrcpy[${this.udid}]`;
        this.createStreamReceiver(params);
        this.setTitle(`${this.deviceName}. Configure stream`);
        this.background = this.createUI();
    }

    public getTracker(): DeviceTracker {
        return this.tracker;
    }

    private createStreamReceiver(params: ParamsStreamScrcpy): void {
        if (this.streamReceiver) {
            this.detachEventsListeners(this.streamReceiver);
            this.streamReceiver.stop();
        }
        this.streamReceiver = new StreamReceiverScrcpy(params);
        this.attachEventsListeners(this.streamReceiver);
    }

    private attachEventsListeners(streamReceiver: StreamReceiverScrcpy): void {
        streamReceiver.on('encoders', this.onEncoders);
        streamReceiver.on('displayInfo', this.onDisplayInfo);
        streamReceiver.on('connected', this.onConnected);
        streamReceiver.on('disconnected', this.onDisconnected);
    }

    private detachEventsListeners(streamReceiver: StreamReceiverScrcpy): void {
        streamReceiver.off('encoders', this.onEncoders);
        streamReceiver.off('displayInfo', this.onDisplayInfo);
        streamReceiver.off('connected', this.onConnected);
        streamReceiver.off('disconnected', this.onDisconnected);
    }

    private updateStatus(): void {
        if (!this.connectionStatusElement) {
            return;
        }
        let text = this.statusText;
        if (this.connectionCount) {
            text = `${text}. Other clients: ${this.connectionCount}.`;
        }
        this.connectionStatusElement.innerText = text;
    }

    private onEncoders = (encoders: string[]): void => {
        // console.log(this.TAG, 'Encoders', encoders);
        const select = this.encoderSelectElement || document.createElement('select');
        let child;
        while ((child = select.firstChild)) {
            select.removeChild(child);
        }
        encoders.unshift('');
        encoders.forEach((value) => {
            const optionElement = document.createElement('option');
            optionElement.setAttribute('value', value);
            optionElement.innerText = value;
            select.appendChild(optionElement);
        });
        this.encoderSelectElement = select;
    };

    private onDisplayInfo = (infoArray: DisplayCombinedInfo[]): void => {
        // console.log(this.TAG, 'Received info');
        this.statusText = 'Ready';
        this.updateStatus();
        this.dialogContainer?.classList.add('ready');
        const select = this.displayIdSelectElement || document.createElement('select');
        let child;
        while ((child = select.firstChild)) {
            select.removeChild(child);
        }
        let selectedOptionIdx = -1;
        infoArray.forEach((value: DisplayCombinedInfo, idx: number) => {
            const { displayInfo } = value;
            const { displayId, size } = displayInfo;
            const optionElement = document.createElement('option');
            optionElement.setAttribute('value', displayId.toString());
            optionElement.innerText = `ID: ${displayId}; ${size.width}x${size.height}`;
            select.appendChild(optionElement);
            if (
                (this.displayInfo && this.displayInfo.displayId === displayId) ||
                (!this.displayInfo && displayId === DisplayInfo.DEFAULT_DISPLAY)
            ) {
                selectedOptionIdx = idx;
            }
        });
        if (selectedOptionIdx > -1) {
            select.selectedIndex = selectedOptionIdx;
            const { videoSettings, connectionCount, displayInfo } = infoArray[selectedOptionIdx];
            this.displayInfo = displayInfo;
            if (connectionCount > 0 && videoSettings) {
                // console.log(this.TAG, 'Apply other clients settings');
                this.fillInputsFromVideoSettings(videoSettings, false);
            } else {
                // console.log(this.TAG, 'Apply settings for current player');
                this.updateVideoSettingsForPlayer();
            }
            this.connectionCount = connectionCount;
            this.updateStatus();
        }
        this.displayIdSelectElement = select;
        if (this.dialogBody) {
            this.dialogBody.classList.remove('hidden');
            this.dialogBody.classList.add('visible');
        }
    };

    private onConnected = (): void => {
        // console.log(this.TAG, 'Connected');
        this.statusText = 'Waiting for info...';
        this.updateStatus();
        if (this.okButton) {
            this.okButton.disabled = false;
        }
    };

    private onDisconnected = (): void => {
        // console.log(this.TAG, 'Disconnected');
        this.statusText = 'Disconnected';
        this.updateStatus();
        if (this.okButton) {
            this.okButton.disabled = true;
        }
        if (this.dialogBody) {
            this.dialogBody.classList.remove('visible');
            this.dialogBody.classList.add('hidden');
        }
    };

    private getPlayer(): PlayerClass | undefined {
        if (!this.playerSelectElement) {
            return;
        }
        const playerName = this.playerSelectElement.options[this.playerSelectElement.selectedIndex].value;
        return StreamClientScrcpy.getPlayers().find((playerClass) => {
            return playerClass.playerFullName === playerName;
        });
    }

    private updateVideoSettingsForPlayer(): void {
        const player = this.getPlayer();
        if (player) {
            this.playerName = player.playerFullName;
            const storedOrPreferred = player.loadVideoSettings(this.udid, this.displayInfo);
            const fitToScreen = player.getFitToScreenStatus(this.udid, this.displayInfo);
            this.fillInputsFromVideoSettings(storedOrPreferred, fitToScreen);
        }
    }

    private getBasicInput(id: string): HTMLInputElement | null {
        const element = document.getElementById(`${id}_${this.escapedUdid}`);
        if (!element) {
            return null;
        }
        return element as HTMLInputElement;
    }

    private fillInputsFromVideoSettings(videoSettings: VideoSettings, fitToScreen: boolean): void {
        if (this.displayInfo && this.displayInfo.displayId !== videoSettings.displayId) {
            console.error(this.TAG, `Display id from VideoSettings and DisplayInfo don't match`);
        }
        this.fillBasicInput({ id: 'bitrate' }, videoSettings);
        this.fillBasicInput({ id: 'maxFps' }, videoSettings);
        this.fillBasicInput({ id: 'iFrameInterval' }, videoSettings);
        // this.fillBasicInput({ id: 'displayId' }, videoSettings);
        this.fillBasicInput({ id: 'codecOptions' }, videoSettings);
        if (videoSettings.bounds) {
            const { width, height } = videoSettings.bounds;
            const widthInput = this.getBasicInput('maxWidth');
            if (widthInput) {
                widthInput.value = width.toString(10);
            }
            const heightInput = this.getBasicInput('maxHeight');
            if (heightInput) {
                heightInput.value = height.toString(10);
            }
        }
        if (this.encoderSelectElement) {
            const encoderName = videoSettings.encoderName || '';
            const option = Array.from(this.encoderSelectElement.options).find((element) => {
                return element.value === encoderName;
            });
            if (option) {
                this.encoderSelectElement.selectedIndex = option.index;
            }
        }
        if (this.fitToScreenCheckbox) {
            this.fitToScreenCheckbox.checked = fitToScreen;
            this.onFitToScreenChanged(fitToScreen);
        }
    }

    private onFitToScreenChanged(checked: boolean) {
        const heightInput = this.getBasicInput('maxHeight');
        const widthInput = this.getBasicInput('maxWidth');
        if (!this.fitToScreenCheckbox || !heightInput || !widthInput) {
            return;
        }
        heightInput.disabled = widthInput.disabled = checked;
        if (checked) {
            heightInput.setAttribute(Attribute.VALUE, heightInput.value);
            heightInput.value = '';
            widthInput.setAttribute(Attribute.VALUE, widthInput.value);
            widthInput.value = '';
        } else {
            const storedHeight = heightInput.getAttribute(Attribute.VALUE);
            if (typeof storedHeight === 'string') {
                heightInput.value = storedHeight;
                heightInput.removeAttribute(Attribute.VALUE);
            }
            const storedWidth = widthInput.getAttribute(Attribute.VALUE);
            if (typeof storedWidth === 'string') {
                widthInput.value = storedWidth;
                widthInput.removeAttribute(Attribute.VALUE);
            }
        }
    }

    private fillBasicInput(opts: { id: keyof VideoSettings }, videoSettings: VideoSettings): void {
        const input = this.getBasicInput(opts.id);
        const value = videoSettings[opts.id];
        if (input) {
            if (typeof value !== 'undefined' && value !== '-' && value !== 0 && value !== null) {
                input.value = value.toString(10);
                if (input.getAttribute('type') === 'range') {
                    input.dispatchEvent(new Event('input'));
                }
            } else {
                input.value = '';
            }
        }
    }

    private getNumberValueFromInput(name: string): number {
        const value = (document.getElementById(`${name}_${this.escapedUdid}`) as HTMLInputElement).value;
        return parseInt(value, 10);
    }

    private getStringValueFromInput(name: string): string {
        return (document.getElementById(`${name}_${this.escapedUdid}`) as HTMLInputElement).value;
    }

    private getValueFromSelect(name: string): string {
        const select = document.getElementById(`${name}_${this.escapedUdid}`) as HTMLSelectElement;
        return select.options[select.selectedIndex].value;
    }

    private buildVideoSettings(): VideoSettings | null {
        try {
            const bitrate = this.getNumberValueFromInput('bitrate');
            const maxFps = this.getNumberValueFromInput('maxFps');
            const iFrameInterval = this.getNumberValueFromInput('iFrameInterval');
            const maxWidth = this.getNumberValueFromInput('maxWidth');
            const maxHeight = this.getNumberValueFromInput('maxHeight');
            const displayId = this.getNumberValueFromInput('displayId');
            const codecOptions = this.getStringValueFromInput('codecOptions') || undefined;
            let bounds: Size | undefined;
            if (!isNaN(maxWidth) && !isNaN(maxHeight) && maxWidth && maxHeight) {
                bounds = new Size(maxWidth, maxHeight);
            }
            const encoderName = this.getValueFromSelect('encoderName') || undefined;
            return new VideoSettings({
                bitrate,
                bounds,
                maxFps,
                iFrameInterval,
                displayId,
                codecOptions,
                encoderName,
            });
        } catch (error: any) {
            console.error(this.TAG, error.message);
            return null;
        }
    }

    private getFitToScreenValue(): boolean {
        if (!this.fitToScreenCheckbox) {
            return false;
        }
        return this.fitToScreenCheckbox.checked;
    }

    private setPreviouslyUsedPlayer(playerName: string): void {
        if (!window.localStorage) {
            return;
        }
        window.localStorage.setItem(this.playerStorageKey, playerName);
    }

    private createUI(): HTMLElement {
        const dialogName = 'configureDialog';
        const blockClass = 'dialog-block';
        const background = document.createElement('div');
        background.classList.add('dialog-background', dialogName);
        const dialogContainer = (this.dialogContainer = document.createElement('div'));
        dialogContainer.classList.add('dialog-container', dialogName);
        const dialogHeader = document.createElement('div');
        dialogHeader.classList.add('dialog-header', dialogName, 'control-wrapper');
        const backButton = new ToolBoxButton('Back', SvgImage.Icon.ARROW_BACK);

        backButton.addEventListener('click', () => {
            this.cancel();
        });
        backButton.getAllElements().forEach((el) => {
            dialogHeader.appendChild(el);
        });

        const deviceName = document.createElement('span');
        deviceName.classList.add('dialog-title', 'main-title');
        deviceName.innerText = this.deviceName;
        dialogHeader.appendChild(deviceName);
        const dialogBody = (this.dialogBody = document.createElement('div'));
        dialogBody.classList.add('dialog-body', blockClass, dialogName, 'hidden');
        // Player is locked to H264 Converter - create disabled display only
        const playerWrapper = document.createElement('div');
        playerWrapper.classList.add('controls');
        const playerLabel = document.createElement('label');
        playerLabel.classList.add('label');
        playerLabel.innerText = 'Player:';
        playerWrapper.appendChild(playerLabel);
        const playerSelect = (this.playerSelectElement = document.createElement('select'));
        playerSelect.classList.add('input');
        playerSelect.id = playerLabel.htmlFor = `player_${this.escapedUdid}`;
        playerSelect.disabled = true; // Lock the player selection
        playerWrapper.appendChild(playerSelect);
        dialogBody.appendChild(playerWrapper);

        // Only add H264 Converter option
        const h264Option = document.createElement('option');
        h264Option.setAttribute('value', 'H264 Converter');
        h264Option.innerText = 'H264 Converter';
        h264Option.selected = true;
        playerSelect.appendChild(h264Option);

        // Set to always use H264 Converter
        this.playerName = 'H264 Converter';
        this.updateVideoSettingsForPlayer();

        const controls = document.createElement('div');
        controls.classList.add('controls', 'control-wrapper');

        // Simplified settings panel - only show locked resolution and frame rate
        const settingsTitle = document.createElement('h3');
        settingsTitle.innerText = 'Streaming Settings';
        settingsTitle.style.marginBottom = '10px';
        controls.appendChild(settingsTitle);

        // Resolution display (locked to 1080p)
        const resolutionWrapper = document.createElement('div');
        resolutionWrapper.classList.add('setting-item');
        const resolutionLabel = document.createElement('label');
        resolutionLabel.classList.add('label');
        resolutionLabel.innerText = 'Resolution:';
        resolutionWrapper.appendChild(resolutionLabel);
        const resolutionValue = document.createElement('span');
        resolutionValue.classList.add('locked-value');
        resolutionValue.innerText = '1920x1080 (1080p)';
        resolutionWrapper.appendChild(resolutionValue);
        controls.appendChild(resolutionWrapper);

        // Frame rate display (locked to 60fps)
        const fpsWrapper = document.createElement('div');
        fpsWrapper.classList.add('setting-item');
        const fpsLabel = document.createElement('label');
        fpsLabel.classList.add('label');
        fpsLabel.innerText = 'Frame Rate:';
        fpsWrapper.appendChild(fpsLabel);
        const fpsValue = document.createElement('span');
        fpsValue.classList.add('locked-value');
        fpsValue.innerText = '60 FPS';
        fpsWrapper.appendChild(fpsValue);
        controls.appendChild(fpsWrapper);

        // Hidden inputs for the locked values (needed for buildVideoSettings)
        const hiddenMaxWidth = document.createElement('input');
        hiddenMaxWidth.type = 'hidden';
        hiddenMaxWidth.id = `maxWidth_${this.escapedUdid}`;
        hiddenMaxWidth.value = '1920';
        controls.appendChild(hiddenMaxWidth);

        const hiddenMaxHeight = document.createElement('input');
        hiddenMaxHeight.type = 'hidden';
        hiddenMaxHeight.id = `maxHeight_${this.escapedUdid}`;
        hiddenMaxHeight.value = '1080';
        controls.appendChild(hiddenMaxHeight);

        const hiddenMaxFps = document.createElement('input');
        hiddenMaxFps.type = 'hidden';
        hiddenMaxFps.id = `maxFps_${this.escapedUdid}`;
        hiddenMaxFps.value = '60';
        controls.appendChild(hiddenMaxFps);

        const hiddenBitrate = document.createElement('input');
        hiddenBitrate.type = 'hidden';
        hiddenBitrate.id = `bitrate_${this.escapedUdid}`;
        hiddenBitrate.value = '8388608';
        controls.appendChild(hiddenBitrate);

        const hiddenIFrame = document.createElement('input');
        hiddenIFrame.type = 'hidden';
        hiddenIFrame.id = `iFrameInterval_${this.escapedUdid}`;
        hiddenIFrame.value = '10';
        controls.appendChild(hiddenIFrame);

        const hiddenCodecOptions = document.createElement('input');
        hiddenCodecOptions.type = 'hidden';
        hiddenCodecOptions.id = `codecOptions_${this.escapedUdid}`;
        hiddenCodecOptions.value = '';
        controls.appendChild(hiddenCodecOptions);

        dialogBody.appendChild(controls);

        // Remove settings buttons since all settings are locked
        // Keep only the minimal interface

        const dialogFooter = document.createElement('div');
        dialogFooter.classList.add('dialog-footer', blockClass, dialogName);
        const statusElement = document.createElement('span');
        statusElement.classList.add('subtitle');
        this.connectionStatusElement = statusElement;
        dialogFooter.appendChild(statusElement);
        this.statusText = `Connecting...`;
        this.updateStatus();

        // const cancelButton = (this.cancelButton = document.createElement('button'));
        // cancelButton.innerText = 'Cancel';
        // cancelButton.addEventListener('click', this.cancel);
        const okButton = (this.okButton = document.createElement('button'));
        okButton.innerText = 'Open';
        okButton.disabled = true;
        okButton.addEventListener('click', this.openStream);
        dialogFooter.appendChild(okButton);
        // dialogFooter.appendChild(cancelButton);
        dialogBody.appendChild(dialogFooter);
        dialogContainer.appendChild(dialogHeader);
        dialogContainer.appendChild(dialogBody);
        dialogContainer.appendChild(dialogFooter);
        background.appendChild(dialogContainer);
        background.addEventListener('click', this.onBackgroundClick);
        document.body.appendChild(background);
        return background;
    }

    private removeUI(): void {
        document.body.removeChild(this.background);
        this.okButton?.removeEventListener('click', this.openStream);
        // this.cancelButton?.removeEventListener('click', this.cancel);
        this.resetSettingsButton?.removeEventListener('click', this.resetSettings);
        this.loadSettingsButton?.removeEventListener('click', this.loadSettings);
        this.saveSettingsButton?.removeEventListener('click', this.saveSettings);
        this.background.removeEventListener('click', this.onBackgroundClick);
    }

    private onBackgroundClick = (event: MouseEvent): void => {
        if (event.target !== event.currentTarget) {
            return;
        }
        this.cancel();
    };

    private cancel = (): void => {
        if (this.streamReceiver) {
            this.detachEventsListeners(this.streamReceiver);
            this.streamReceiver.stop();
        }
        this.emit('closed', { dialog: this, result: false });
        this.removeUI();
    };

    private resetSettings = (): void => {
        const player = this.getPlayer();
        if (player) {
            this.fillInputsFromVideoSettings(player.getPreferredVideoSetting(), false);
        }
    };

    private loadSettings = (): void => {
        this.updateVideoSettingsForPlayer();
    };

    private saveSettings = (): void => {
        const videoSettings = this.buildVideoSettings();
        const player = this.getPlayer();
        if (videoSettings && player) {
            const fitToScreen = this.getFitToScreenValue();
            player.saveVideoSettings(this.udid, videoSettings, fitToScreen, this.displayInfo);
        }
    };

    private openStream = (): void => {
        const videoSettings = this.buildVideoSettings();
        if (!videoSettings || !this.streamReceiver || !this.playerName) {
            return;
        }
        const fitToScreen = this.getFitToScreenValue();
        this.detachEventsListeners(this.streamReceiver);
        this.emit('closed', { dialog: this, result: true });
        this.removeUI();
        const player = StreamClientScrcpy.createPlayer(this.playerName, this.udid, this.displayInfo);
        if (!player) {
            return;
        }
        this.setPreviouslyUsedPlayer(this.playerName);
        // return;
        player.setVideoSettings(videoSettings, fitToScreen, false);
        const params: ParamsStreamScrcpy = {
            ...this.params,
            udid: this.udid,
            fitToScreen,
        };
        StreamClientScrcpy.start(params, this.streamReceiver, player, fitToScreen, videoSettings);
        this.streamReceiver.triggerInitialInfoEvents();
    };
}
