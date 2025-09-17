import '../style/app.css';
import { ApiStreamClient } from './googDevice/client/ApiStreamClient';
import { ApiDeviceTracker } from './googDevice/client/ApiDeviceTracker';

window.onload = async function (): Promise<void> {
    const hash = location.hash.replace(/^#!/, '');
    const parsedQuery = new URLSearchParams(hash);
    const action = parsedQuery.get('action');

    // Only register H264 Converter (MsePlayer)
    /// #if USE_H264_CONVERTER
    // Import MsePlayer to ensure it's available
    await import('./player/MsePlayer');
    /// #endif

    // Handle stream action with API-based client
    if (action === 'stream' && typeof parsedQuery.get('udid') === 'string') {
        const params = {
            udid: parsedQuery.get('udid')!,
            player: 'MsePlayer', // Fixed to H264 Converter only
            hostname: parsedQuery.get('hostname') || location.hostname,
            port: parsedQuery.get('port') ? parseInt(parsedQuery.get('port')!) : location.port ? parseInt(location.port) : 80,
            secure: parsedQuery.get('secure') === 'true' || location.protocol === 'https:',
            pathname: parsedQuery.get('pathname') || location.pathname,
            action: action
        };
        ApiStreamClient.start(params);
        return;
    }

    // For device list, start directly with localhost configuration
    const defaultHostItem = {
        type: 'android' as const,
        hostname: location.hostname,
        port: location.port ? parseInt(location.port) : 80,
        secure: location.protocol === 'https:',
        pathname: location.pathname
    };
    
    const deviceTracker = ApiDeviceTracker.start(defaultHostItem);
    // Make it globally accessible for button clicks
    (window as any).deviceTracker = deviceTracker;
};
