const { TorSignalingHost } = require('./lib/tor-signaling');

const port = process.env.PORT || 3000;
const host = new TorSignalingHost(port);

host.listen(() => {
    console.log(`Tor signaling host running on port ${port}`);
});
