const P2PNode = require('../lib/webrtc-node');
const { TorSignalingHost, TorSignalingClient } = require('../lib/tor-signaling');
const { Blockchain } = require('../index');
const http = require('http');

// Mock dependencies for testing
jest.mock('simple-peer');
jest.mock('socks-proxy-agent', () => {
    return {
        SocksProxyAgent: jest.fn().mockImplementation(() => ({}))
    };
});
jest.mock('node-fetch', () => jest.fn());

// Mock http server for TorSignalingHost to avoid port binding issues
jest.mock('http', () => {
    const originalHttp = jest.requireActual('http');
    return {
        ...originalHttp,
        createServer: jest.fn().mockReturnValue({
            listen: jest.fn((port, cb) => cb && cb()),
            on: jest.fn(),
            address: jest.fn(() => ({ port: 3000 }))
        })
    };
});

describe('P2P Protocol Extension', () => {
    let hostNode;
    let clientNode;

    beforeEach(() => {
        hostNode = new P2PNode();
        clientNode = new P2PNode();
    });

    test('P2PNode initialization', () => {
        expect(hostNode.blockchain).toBeInstanceOf(Blockchain);
        expect(hostNode.peers).toEqual([]);
    });

    test('TorSignalingHost setup', () => {
        const signaling = new TorSignalingHost(3000);
        expect(signaling.port).toBe(3000);
        expect(signaling.server.listen).toBeDefined();
    });

    test('TorSignalingClient setup', () => {
        const client = new TorSignalingClient('http://test.onion');
        expect(client.onionAddress).toBe('http://test.onion');
    });

    test('Host starts signaling server', () => {
        const onConnect = jest.fn();
        hostNode.host(3000, onConnect);
        expect(hostNode.signalingServer).toBeDefined();
        expect(hostNode.signalingServer.server.listen).toHaveBeenCalled();
    });

    test('Client attempts to join', async () => {
        // Mock fetch for client
        const fetch = require('node-fetch');
        fetch.mockResolvedValue({
            ok: true,
            json: async () => ({ answer: { type: 'answer', sdp: 'sdp' } })
        });

        const peer = await clientNode.join('http://test.onion');
        expect(peer).toBeDefined();
        // Peer is added on 'connect', which won't fire in this mock setup without more work,
        // but we verify the join process initiated.
    });
});
