/**
 * TorSignalingClient
 * Use this class to connect to a TorSignalingHost via a Tor-enabled browser.
 */
class TorSignalingClient {
    constructor(onionAddress) {
        // Ensure the onion address is in the correct format for browser requests
        if (!onionAddress.startsWith('http://')) {
            onionAddress = 'http://' + onionAddress;
        }
        this.onionAddress = onionAddress.replace(/\/$/, ''); // Remove trailing slash
    }

    async sendOffer(id, offer) {
        const url = `${this.onionAddress}/offer`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, offer }),
                mode: 'cors'
            });
            return response.ok;
        } catch (err) {
            console.error('Error sending offer:', err);
            throw err;
        }
    }

    async getOffer(id) {
        const url = `${this.onionAddress}/offer/${id}`;
        try {
            const response = await fetch(url, { mode: 'cors' });
            if (response.ok) {
                const data = await response.json();
                return data.offer;
            }
            return null;
        } catch (err) {
            console.error('Error getting offer:', err);
            return null;
        }
    }

    async sendAnswer(id, answer) {
        const url = `${this.onionAddress}/answer`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, answer }),
                mode: 'cors'
            });
            return response.ok;
        } catch (err) {
            console.error('Error sending answer:', err);
            throw err;
        }
    }

    async getAnswer(id) {
        const url = `${this.onionAddress}/answer/${id}`;
        try {
            const response = await fetch(url, { mode: 'cors' });
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
    TorSignalingClient
};
