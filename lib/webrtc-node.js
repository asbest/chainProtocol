const SimplePeer = require('simple-peer');
const { TorSignalingHost, TorSignalingClient } = require('./tor-signaling');
const { Blockchain } = require('../index');

// Try to load wrtc for Node.js environment
let wrtc;
try {
    wrtc = require('wrtc');
} catch (e) {
    console.warn('wrtc not found. WebRTC will not work in Node.js unless you install it or use this in a browser.');
}

class P2PNode {
    constructor(blockchain) {
        this.blockchain = blockchain || new Blockchain();
        this.peers = [];
    }

    /**
     * Start hosting a game.
     * @param {number} port - Local port to listen on (which Tor Hidden Service forwards to).
     * @param {function} onConnect - Callback when a peer connects.
     */
    host(port, onConnect) {
        this.signalingServer = new TorSignalingHost(port);

        this.signalingServer.setOnOffer(async (peerId, offer) => {
            return new Promise((resolve) => {
                const peer = new SimplePeer({
                    initiator: false,
                    trickle: false,
                    wrtc: wrtc
                });

                peer.on('signal', (answer) => {
                    resolve(answer);
                });

                peer.on('connect', () => {
                    console.log(`Connected to peer ${peerId}`);
                    this.peers.push(peer);
                    this.setupPeerEvents(peer);
                    if (onConnect) onConnect(peer);

                    // Sync blockchain
                    this.syncChain(peer);
                });

                peer.signal(offer);
            });
        });

        this.signalingServer.listen();
    }

    /**
     * Join a game hosted at an onion address.
     * @param {string} onionAddress - The http://xyz.onion address.
     * @param {number} socksPort - The local SOCKS5 port (default 9050).
     */
    async join(onionAddress, socksPort = 9050) {
        const clientId = 'client-' + Math.random().toString(36).substr(2, 9);
        const signalingClient = new TorSignalingClient(onionAddress, socksPort);

        const peer = new SimplePeer({
            initiator: true,
            trickle: false,
            wrtc: wrtc
        });

        peer.on('signal', async (offer) => {
            try {
                await signalingClient.sendOffer(clientId, offer);
            } catch (err) {
                console.error('Failed to send offer:', err);
                return;
            }

            // Poll for answer with timeout
            let attempts = 0;
            const maxAttempts = 60; // 60 seconds timeout
            const pollInterval = setInterval(async () => {
                attempts++;
                if (attempts > maxAttempts) {
                    clearInterval(pollInterval);
                    console.error('Signaling timeout: No answer received');
                    peer.destroy();
                    return;
                }

                const answer = await signalingClient.getAnswer(clientId);
                if (answer) {
                    clearInterval(pollInterval);
                    peer.signal(answer);
                }
            }, 1000);
        });

        peer.on('connect', () => {
            console.log('Connected to host');
            this.peers.push(peer);
            this.setupPeerEvents(peer);

            // Sync blockchain
            this.syncChain(peer);
        });

        return peer;
    }

    setupPeerEvents(peer) {
        peer.on('data', (data) => {
            try {
                const message = JSON.parse(data.toString());
                this.handleMessage(message, peer);
            } catch (err) {
                console.error('Invalid message received:', err);
            }
        });

        peer.on('error', (err) => {
            console.error('Peer error:', err);
        });

        peer.on('close', () => {
            console.log('Peer disconnected');
            this.peers = this.peers.filter(p => p !== peer);
        });
    }

    handleMessage(message, peer) {
        if (message.type === 'CHAIN_SYNC') {
            const receivedChain = Blockchain.load(message.data);
            if (receivedChain.isChainValid() && receivedChain.chain.length > this.blockchain.chain.length) {
                console.log('Replacing chain with longer valid chain');
                this.blockchain = receivedChain;
            }
        } else if (message.type === 'NEW_BLOCK') {
            // Handle new block propagation
            // Note: In a real implementation, we should verify the block before adding
            // For now, we assume if we trust the peer, we might want to sync.
            // But usually we just sync the whole chain or the diff.
            // Let's keep it simple: if we receive a block, we trigger a sync request or just add it if valid.
        }
    }

    syncChain(peer) {
        const savedChain = this.blockchain.save();
        peer.send(JSON.stringify({
            type: 'CHAIN_SYNC',
            data: savedChain
        }));
    }

    broadcastBlock(block) {
        const message = JSON.stringify({
            type: 'NEW_BLOCK',
            data: block
        });
        this.peers.forEach(peer => peer.send(message));
    }
}

module.exports = P2PNode;
