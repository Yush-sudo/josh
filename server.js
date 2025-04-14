const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));

const users = [
    { username: 'admin', password: 'password123' },
    { username: 'user', password: 'userpass' }
];

// Other routes that don't need wss
app.use('/api', require('./routes/auth'));
app.use('/api', require('./routes/sensor'));
app.use('/api', require('./routes/disableAlarm'));

// Create HTTP + WebSocket Server
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// ✅ Mount intrusionAlert route AFTER initializing wss
app.use('/api', require('./routes/intrusionAlert')(wss));

// Login and catch-all routes
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);
  if (user) res.redirect('/');
  else res.send('Invalid credentials, please try again.');
});

app.get('*', (req, res) => {
  console.log("📢 Request received for:", req.url);
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// WebSocket broadcast function
function broadcast(type, data) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type, data }));
    }
  });
}

// Watch alarm.txt
fs.watchFile("alarm.txt", () => {
  try {
    const alarmStatus = fs.readFileSync("alarm.txt", "utf8").trim();
    const isIntrusion = alarmStatus === "on";
    broadcast("intrusionAlert", { alert: isIntrusion });
    console.log("🔔 WebSocket pushed intrusion alert:", isIntrusion);
  } catch (err) {
    console.error("❌ Error reading alarm.txt:", err);
  }
});

// ✅ Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
