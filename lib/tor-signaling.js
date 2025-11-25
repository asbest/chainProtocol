const express = require('express');
const cors = require('cors');
const http = require('http');
const { SocksProxyAgent } = require('socks-proxy-agent');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

/**
 * TorSignalingHost
 * Use this class to host a signaling server that can be exposed as a Tor Hidden Service.
 */
class TorSignalingHost {
    constructor(port = 3000) {
        this.port = port;
        this.app = express();
        this.server = http.createServer(this.app);
        this.peers = new Map(); // Store offers/answers

        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
    }

    setupRoutes() {
        // Client sends Offer here
        this.app.post('/offer', (req, res) => {
            const { id, offer } = req.body;
            console.log(`Received offer from ${id}`);
            this.peers.set(id, { offer, answer: null });

            // Notify listener (the Game Host) that an offer arrived
            if (this.onOffer) {
                this.onOffer(id, offer).then(answer => {
                    if (this.peers.has(id)) {
                        this.peers.get(id).answer = answer;
                    }
                });
            }

            res.status(200).send({ message: 'Offer received' });
        });

        // Client polls for Answer here
        this.app.get('/answer/:id', (req, res) => {
            const { id } = req.params;
            const peerData = this.peers.get(id);
            if (peerData && peerData.answer) {
                res.json({ answer: peerData.answer });
                this.peers.delete(id); // Clean up after answer is retrieved
            } else {
                res.status(404).send({ message: 'Answer not ready' });
            }
        });
    }

    listen(callback) {
        this.server.listen(this.port, () => {
            console.log(`Signaling server running on port ${this.port}`);
            if (callback) callback();
        });
    }

    // Callback when an offer is received
    // Should return a Promise that resolves to an Answer
    setOnOffer(callback) {
        this.onOffer = callback;
    }
}

/**
 * TorSignalingClient
 * Use this class to connect to a TorSignalingHost via Tor.
 */
class TorSignalingClient {
    constructor(onionAddress, socksPort = 9050) {
        this.onionAddress = onionAddress.replace(/\/$/, ''); // Remove trailing slash
        if (socksPort) {
            this.agent = new SocksProxyAgent(`socks5h://127.0.0.1:${socksPort}`);
        } else {
            this.agent = null;
        }
    }

    async sendOffer(id, offer) {
        const url = `${this.onionAddress}/offer`;
        try {
            const options = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, offer })
            };
            if (this.agent) {
                options.agent = this.agent;
            }

            const response = await fetch(url, options);
            return response.ok;
        } catch (err) {
            console.error('Error sending offer:', err);
            throw err;
        }
    }

    async getAnswer(id) {
        const url = `${this.onionAddress}/answer/${id}`;
        try {
            const options = {};
            if (this.agent) {
                options.agent = this.agent;
            }

            const response = await fetch(url, options);
            if (response.ok) {
                const data = await response.json();
                return data.answer;
            }
            return null;
        } catch (err) {
            console.error('Error getting answer:', err);
            return null;
        }
    }
}

module.exports = {
    TorSignalingHost,
    TorSignalingClient
};
