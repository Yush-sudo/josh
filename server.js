const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const session = require('express-session');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || 'supersecure123';

// ✅ Middleware
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));

// 🔐 Session setup
app.use(session({
  secret: process.env.SESSION_SECRET || 'mySecretKey123',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 60 * 60 * 1000 } // 1 hour
}));

// ✅ WebSocket setup
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// ✅ WebSocket broadcast utility
function broadcast(type, data) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type, data }));
    }
  });
}

// 📝 Define schemas
const deviceSchema = new mongoose.Schema({
  device_id: { type: String, required: true, unique: true },
  name: String,
  location: String,
  status: { type: String, default: 'online' },
  last_seen: { type: Date, default: Date.now },
  settings: {
    sensors_enabled: { type: Boolean, default: true },
    coin_rejection: { type: Boolean, default: false }
  }
});

const salesReportSchema = new mongoose.Schema({
  device_id: { type: String, required: true },
  interval: { type: String, required: true },
  sales_amount: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now }
});

const intrusionAlertSchema = new mongoose.Schema({
  device_id: { type: String, required: true },
  intrusion: { type: Boolean, default: true },
  triggered_by: String,
  status: String,
  timestamp: { type: Date, default: Date.now },
  resolved: { type: Boolean, default: false }
});

// 📝 Create models
const Device = mongoose.model('Device', deviceSchema);
const SalesReport = mongoose.model('SalesReport', salesReportSchema);
const IntrusionAlert = mongoose.model('IntrusionAlert', intrusionAlertSchema);

// ✅ In-memory user store (you should migrate this to MongoDB)
const users = [
  { username: 'admin', password: 'password123' },
  { username: 'user', password: 'userpass' }
];

// 📊 MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pisofi', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('✅ Connected to MongoDB');

  // ✅ API routes
  app.use('/api', require('./routes/auth'));
  app.use('/api', require('./routes/sensor'));
  app.use('/api', require('./routes/disableAlarm'));
  app.use('/api', require('./routes/intrusionAlert')(wss));

  // ... all your route definitions remain the same (dashboard, sales-report, etc.)

  // ✅ Login route
  app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
  });

  app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
      req.session.loggedIn = true;
      res.redirect('/');
    } else {
      res.send('Invalid credentials. <a href="/login">Try again</a>.');
    }
  });

  app.get('/logout', (req, res) => {
    req.session.destroy(() => {
      res.redirect('/login');
    });
  });

  app.get('/', (req, res) => {
    if (!req.session.loggedIn) {
      return res.redirect('/login');
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  app.get('*', (req, res) => {
    res.redirect('/login');
  });

  // ✅ Watch alarm.txt and broadcast alerts
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

  // ✅ Start server only after DB is ready
  server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
})
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
});

// MongoDB connection event logging
mongoose.connection.on('connected', () => {
  console.log('✅ Mongoose connection established');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose connection error:', err);
});
