const SteamSignaling = require('../lib/steam-signaling');

// Mocking the steamworks.js library
jest.mock('steamworks.js', () => ({
  init: jest.fn(() => ({
    matchmaking: {
      createLobby: jest.fn(() => Promise.resolve('test-lobby-id')),
      joinLobby: jest.fn(() => Promise.resolve()),
      getLobbyOwner: jest.fn(() => 'lobby-owner-steam-id'),
    },
    networking: {
      on: jest.fn(),
      sendP2PMessage: jest.fn(),
    },
  })),
}));

describe('SteamSignaling', () => {
  let steamSignaling;
  let mockSteamworksClient;

  beforeEach(() => {
    // Get the mocked client instance
    mockSteamworksClient = require('steamworks.js').init();
    steamSignaling = new SteamSignaling(480);
    // Link the instance in SteamSignaling to our mock
    steamSignaling.client = mockSteamworksClient;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create a lobby', async () => {
    const lobbyId = await steamSignaling.createLobby();
    expect(lobbyId).toBe('test-lobby-id');
    expect(mockSteamworksClient.matchmaking.createLobby).toHaveBeenCalledWith('friends', 2);
  });

  it('should join a lobby', async () => {
    await steamSignaling.joinLobby('test-lobby-id');
    expect(mockSteamworksClient.matchmaking.joinLobby).toHaveBeenCalledWith('test-lobby-id');
  });

  it('should send a P2P message', () => {
    steamSignaling.sendMessage('test-user', { data: 'hello' });
    expect(mockSteamworksClient.networking.sendP2PMessage).toHaveBeenCalledWith('test-user', JSON.stringify({ data: 'hello' }));
  });

  it('should set a message handler', () => {
    const callback = jest.fn();
    steamSignaling.setOnMessage(callback);
    expect(steamSignaling.onMessage).toBe(callback);
  });
});
