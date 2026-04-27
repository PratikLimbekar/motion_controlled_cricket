export function connectSocket(onMessage) {
  const ws = new WebSocket(`ws://${window.location.hostname}:8080`);
  const statusEl = document.getElementById('status');

  ws.onopen = () => {
    statusEl.innerText = "Server Connected, Waiting for Phone...";
    statusEl.style.color = "orange";
    ws.send(JSON.stringify({ type: 'register', clientType: 'frontend' }));
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'mobile_status') {
         if (data.connected) {
             statusEl.innerText = "Phone Connected & Ready!";
             statusEl.style.color = "lightgreen";
         } else {
             statusEl.innerText = "Server Connected, Waiting for Phone...";
             statusEl.style.color = "orange";
         }
         return;
      }
      onMessage(data);
    } catch (e) {
      console.error(e);
    }
  };

  ws.onclose = () => {
    statusEl.innerText = "Server Disconnected";
    statusEl.style.color = "red";
    setTimeout(() => connectSocket(onMessage), 3000); // Reconnect loop
  };
}
