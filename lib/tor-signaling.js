const express = require('express');
const cors = require('cors');
const http = require('http');
const { SocksProxyAgent } = require('socks-proxy-agent');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

/**
 * TorSignalingHost
 * Use this class to host a signaling server that can be exposed as a Tor Hidden Service.
 * This version supports both Node.js-to-Node.js (via setOnOffer) and
 * browser-to-browser (via REST endpoints) signaling.
 */
class TorSignalingHost {
    constructor(port = 3000) {
        this.port = port;
        this.app = express();
        this.server = http.createServer(this.app);
        this.peers = new Map(); // A map for all signaling data

        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
    }

    setupRoutes() {
        // Endpoint for both Node.js host (with setOnOffer) and Browser host
        this.app.post('/offer', (req, res) => {
            const { id, offer } = req.body;
            if (!id || !offer) {
                return res.status(400).send({ message: 'Missing "id" or "offer" in request body.' });
            }
            console.log(`Received offer for ID: ${id}`);
            this.peers.set(id, { offer, answer: null });

            // Support for the Node.js P2PNode host flow
            if (this.onOffer) {
                this.onOffer(id, offer).then(answer => {
                    if (this.peers.has(id)) {
                        this.peers.get(id).answer = answer;
                    }
                });
            }

            res.status(200).send({ message: 'Offer received' });
        });

        // Browser flow: Joining client retrieves the offer
        this.app.get('/offer/:id', (req, res) => {
            const { id } = req.params;
            const peerData = this.peers.get(id);
            if (peerData && peerData.offer) {
                res.json({ offer: peerData.offer });
            } else {
                res.status(404).send({ message: 'Offer not found for the given game ID.' });
            }
        });

        // Browser flow: Joining client posts the answer
        this.app.post('/answer', (req, res) => {
            const { id, answer } = req.body;
            if (!id || !answer) {
                return res.status(400).send({ message: 'Missing "id" or "answer" in request body.' });
            }
            const peerData = this.peers.get(id);
            if (peerData) {
                peerData.answer = answer;
                res.status(200).send({ message: 'Answer stored successfully.' });
            } else {
                res.status(404).send({ message: 'ID not found.' });
            }
        });

        // Endpoint for both Node.js joiner and Browser host to poll for an answer
        this.app.get('/answer/:id', (req, res) => {
            const { id } = req.params;
            const peerData = this.peers.get(id);
            if (peerData && peerData.answer) {
                res.json({ answer: peerData.answer });
                this.peers.delete(id);
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

    // Restored for the Node.js P2P tests
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
