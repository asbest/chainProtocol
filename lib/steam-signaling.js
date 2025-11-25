const steamworks = require('steamworks.js');

class SteamSignaling {
  constructor(appId) {
    this.client = steamworks.init(appId);
    this.lobbyId = null;
    this.onMessage = null;

    this.client.networking.on('p2pMessage', (user, data) => {
      if (this.onMessage) {
        this.onMessage(user, JSON.parse(data.toString()));
      }
    });
  }

  async createLobby() {
    this.lobbyId = await this.client.matchmaking.createLobby('friends', 2);
    return this.lobbyId;
  }

  async joinLobby(lobbyId) {
    this.lobbyId = lobbyId;
    await this.client.matchmaking.joinLobby(lobbyId);
  }

  sendMessage(user, message) {
    this.client.networking.sendP2PMessage(user, JSON.stringify(message));
  }

  setOnMessage(callback) {
    this.onMessage = callback;
  }
}

module.exports = SteamSignaling;
