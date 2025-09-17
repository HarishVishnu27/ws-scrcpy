import { Request, Response } from 'express';
import { ControlCenter } from '../goog-device/services/ControlCenter';
import { ControlCenterCommand } from '../../common/ControlCenterCommand';

export class DeviceController {
    private controlCenter: ControlCenter;

    constructor() {
        this.controlCenter = ControlCenter.getInstance();
    }

    public async getDevices(_req: Request, res: Response): Promise<void> {
        try {
            await this.controlCenter.init();
            const devices = this.controlCenter.getDevices();
            res.json({
                success: true,
                data: {
                    devices,
                    id: this.controlCenter.getId()
                }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    public async getDevice(req: Request, res: Response): Promise<void> {
        try {
            const { udid } = req.params;
            const device = this.controlCenter.getDevice(udid);
            
            if (!device) {
                res.status(404).json({
                    success: false,
                    error: 'Device not found'
                });
                return;
            }

            res.json({
                success: true,
                data: device.descriptor
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    public async startStream(req: Request, res: Response): Promise<void> {
        try {
            const { udid } = req.params;
            const { player = 'MsePlayer', videoSettings } = req.body;
            
            const device = this.controlCenter.getDevice(udid);
            if (!device) {
                res.status(404).json({
                    success: false,
                    error: 'Device not found'
                });
                return;
            }

            // Start the scrcpy server for streaming
            await device.startServer();
            
            res.json({
                success: true,
                data: {
                    message: 'Stream started successfully',
                    player,
                    udid,
                    videoSettings
                }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    public async stopStream(req: Request, res: Response): Promise<void> {
        try {
            const { udid } = req.params;
            
            const device = this.controlCenter.getDevice(udid);
            if (!device) {
                res.status(404).json({
                    success: false,
                    error: 'Device not found'
                });
                return;
            }

            // Find and kill the server process
            const descriptor = device.descriptor;
            if (descriptor.pid && descriptor.pid !== -1) {
                await device.killServer(descriptor.pid);
            }
            
            res.json({
                success: true,
                data: {
                    message: 'Stream stopped successfully',
                    udid
                }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    public async killServer(req: Request, res: Response): Promise<void> {
        try {
            const { udid } = req.params;
            const { pid } = req.body;
            
            const commandData = {
                id: Date.now(),
                type: ControlCenterCommand.KILL_SERVER,
                data: { udid, pid }
            };
            const command = ControlCenterCommand.fromJSON(JSON.stringify(commandData));
            await this.controlCenter.runCommand(command);
            
            res.json({
                success: true,
                data: {
                    message: 'Server killed successfully',
                    udid,
                    pid
                }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    public async startServer(req: Request, res: Response): Promise<void> {
        try {
            const { udid } = req.params;
            
            const commandData = {
                id: Date.now(),
                type: ControlCenterCommand.START_SERVER,
                data: { udid }
            };
            const command = ControlCenterCommand.fromJSON(JSON.stringify(commandData));
            await this.controlCenter.runCommand(command);
            
            res.json({
                success: true,
                data: {
                    message: 'Server started successfully',
                    udid
                }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    public async updateInterfaces(req: Request, res: Response): Promise<void> {
        try {
            const { udid } = req.params;
            
            const commandData = {
                id: Date.now(),
                type: ControlCenterCommand.UPDATE_INTERFACES,
                data: { udid }
            };
            const command = ControlCenterCommand.fromJSON(JSON.stringify(commandData));
            await this.controlCenter.runCommand(command);
            
            res.json({
                success: true,
                data: {
                    message: 'Interfaces updated successfully',
                    udid
                }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
}