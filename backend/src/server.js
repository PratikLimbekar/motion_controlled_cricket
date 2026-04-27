const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });
console.log("WebSocket Relay server running on ws://0.0.0.0:8080");

let clients = [];

wss.on('connection', (ws) => {
  // console.log("New client connected.");

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      // Initial handshake to assign type
      if (data.type === 'register') {
        ws.clientType = data.clientType; // "mobile" or "frontend"
        console.log(`Client registered as: ${ws.clientType}`);
        if (!clients.includes(ws)) {
            clients.push(ws);
        }

        // Notify frontends if a mobile just joined
        if (ws.clientType === 'mobile') {
            clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN && client.clientType === 'frontend') {
                    client.send(JSON.stringify({ type: 'mobile_status', connected: true }));
                }
            });
        }
        
        // Let newly joined frontend know if any mobile is already connected
        if (ws.clientType === 'frontend') {
            const hasMobile = clients.some(c => c.clientType === 'mobile' && c.readyState === WebSocket.OPEN);
            ws.send(JSON.stringify({ type: 'mobile_status', connected: hasMobile }));
        }

        return;
      }
      
      // If it's a motion or action message, broadcast to all frontend clients
      if (data.type === 'motion' || data.type === 'action') {
        if (data.type === 'action') console.log(`Relaying action from mobile: ${data.action}`);
        clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN && client.clientType === 'frontend') {
            client.send(JSON.stringify(data));
          }
        });
      }

    } catch (e) {
      console.error("Failed to parse message:", e);
    }
  });

  ws.on('close', () => {
    // console.log(`Client disconnected (${ws.clientType || 'unknown'}).`);
    clients = clients.filter((client) => client !== ws);

    // If a mobile disconnects, let frontends know
    if (ws.clientType === 'mobile') {
        const hasMobile = clients.some(c => c.clientType === 'mobile' && c.readyState === WebSocket.OPEN);
        if (!hasMobile) {
            clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN && client.clientType === 'frontend') {
                    client.send(JSON.stringify({ type: 'mobile_status', connected: false }));
                }
            });
        }
    }
  });
});
