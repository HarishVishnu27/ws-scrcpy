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
            // If ADB is not available, return mock data for demo purposes
            if (error instanceof Error && error.message.includes('spawn adb ENOENT')) {
                const mockDevices = [
                    {
                        udid: 'demo_device_1',
                        state: 'device',
                        pid: 12345,
                        'ro.product.manufacturer': 'Google',
                        'ro.product.model': 'Pixel 7',
                        'ro.build.version.release': '13',
                        'ro.build.version.sdk': '33',
                        interfaces: [
                            { name: 'wlan0', ipv4: '192.168.1.100' }
                        ],
                        'wifi.interface': 'wlan0'
                    },
                    {
                        udid: 'demo_device_2', 
                        state: 'offline',
                        pid: -1,
                        'ro.product.manufacturer': 'Samsung',
                        'ro.product.model': 'Galaxy S22',
                        'ro.build.version.release': '12',
                        'ro.build.version.sdk': '31',
                        interfaces: [],
                        'last.update.timestamp': Date.now() - 300000 // 5 minutes ago
                    }
                ];
                
                res.json({
                    success: true,
                    data: {
                        devices: mockDevices,
                        id: 'demo_server_id'
                    }
                });
                return;
            }
            
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