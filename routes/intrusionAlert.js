const express = require('express');

module.exports = (wss) => {
  const router = express.Router();

  // POST /api/intrusion-alert
  router.post('/intrusion-alert', (req, res) => {
    const alert = req.body;
    console.log("📡 Received Intrusion Alert:", alert);

    // Broadcast to all WebSocket clients
    wss.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(JSON.stringify({
          type: "intrusionAlert",
          data: alert
        }));
      }
    });

    res.status(200).json({ success: true, message: "Alert received successfully." });
  });

  return router;
};
