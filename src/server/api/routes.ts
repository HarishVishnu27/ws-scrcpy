import { Router } from 'express';
import { DeviceController } from './DeviceController';

export function createApiRoutes(): Router {
    const router = Router();
    const deviceController = new DeviceController();

    // Enable JSON parsing for POST requests
    router.use((req, _res, next) => {
        if (req.method === 'POST' || req.method === 'PUT') {
            req.headers['content-type'] = 'application/json';
        }
        next();
    });

    // Device management endpoints
    router.get('/devices', (req, res) => deviceController.getDevices(req, res));
    router.get('/devices/:udid', (req, res) => deviceController.getDevice(req, res));
    
    // Stream control endpoints  
    router.post('/devices/:udid/stream/start', (req, res) => deviceController.startStream(req, res));
    router.post('/devices/:udid/stream/stop', (req, res) => deviceController.stopStream(req, res));
    
    // Server control endpoints
    router.post('/devices/:udid/server/start', (req, res) => deviceController.startServer(req, res));
    router.post('/devices/:udid/server/kill', (req, res) => deviceController.killServer(req, res));
    
    // Interface management
    router.post('/devices/:udid/interfaces/update', (req, res) => deviceController.updateInterfaces(req, res));

    return router;
}