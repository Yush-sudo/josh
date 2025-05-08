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

// 📊 MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pisofi', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

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

// ✅ API routes
app.use('/api', require('./routes/auth'));
app.use('/api', require('./routes/sensor'));
app.use('/api', require('./routes/disableAlarm'));

// ✅ Intrusion alert route with WebSocket
app.use('/api', require('./routes/intrusionAlert')(wss));

// 🆕 Dashboard data endpoint - fetch data for ESP32
app.post('/api/dashboard', async (req, res) => {
  try {
    const { device_id } = req.body;
    
    if (!device_id) {
      return res.status(400).json({ error: 'Device ID is required' });
    }
    
    // Find or create device
    let device = await Device.findOne({ device_id });
    if (!device) {
      device = new Device({ device_id });
      await device.save();
    }
    
    // Update last seen timestamp
    device.last_seen = Date.now();
    device.status = 'online';
    await device.save();
    
    // Get latest sales data
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const dailySales = await SalesReport.aggregate([
      { $match: { device_id, timestamp: { $gte: todayStart } } },
      { $group: { _id: null, total: { $sum: '$sales_amount' } } }
    ]);
    
    // Compile dashboard data to send back to ESP32
    const dashboardData = {
      daily_sales: dailySales.length > 0 ? dailySales[0].total : 0,
      coin_rejection: device.settings.coin_rejection,
      sensors_enabled: device.settings.sensors_enabled
    };
    
    return res.status(200).json(dashboardData);
  } catch (error) {
    console.error('Dashboard data error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// 🆕 Sales report endpoint
app.post('/api/sales-report', async (req, res) => {
  try {
    const { device_id, interval, sales_amount } = req.body;
    
    if (!device_id || !interval || sales_amount === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Update device status
    await Device.findOneAndUpdate(
      { device_id },
      { status: 'online', last_seen: Date.now() },
      { upsert: true }
    );
    
    // Create sales report
    const salesReport = new SalesReport({
      device_id,
      interval,
      sales_amount,
      timestamp: Date.now()
    });
    
    await salesReport.save();
    
    // Broadcast sales update to all clients
    const salesData = {
      [interval]: sales_amount
    };
    broadcast("salesUpdate", salesData);
    
    return res.status(201).json({ 
      success: true,
      message: `${interval} sales report recorded`, 
      amount: sales_amount 
    });
  } catch (error) {
    console.error('Sales report error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// 🆕 Get sales statistics
app.get('/api/sales/stats', async (req, res) => {
  try {
    const { device_id, period } = req.query;
    
    if (!device_id) {
      return res.status(400).json({ error: 'Device ID is required' });
    }
    
    let startDate = new Date();
    
    // Calculate start date based on period
    switch(period) {
      case 'daily':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'weekly':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'monthly':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      default:
        startDate.setHours(0, 0, 0, 0); // Default to daily
    }
    
    const salesData = await SalesReport.find({
      device_id,
      timestamp: { $gte: startDate }
    }).sort({ timestamp: 1 });
    
    // Calculate total
    const total = salesData.reduce((sum, report) => sum + report.sales_amount, 0);
    
    return res.status(200).json({
      success: true,
      period,
      total,
      count: salesData.length,
      data: salesData
    });
  } catch (error) {
    console.error('Sales stats error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// 🆕 Toggle device settings endpoint
app.post('/api/device/settings', async (req, res) => {
  try {
    const { device_id, sensors_enabled, coin_rejection } = req.body;
    
    if (!device_id) {
      return res.status(400).json({ error: 'Device ID is required' });
    }
    
    const updateData = {};
    
    if (sensors_enabled !== undefined) {
      updateData['settings.sensors_enabled'] = sensors_enabled;
    }
    
    if (coin_rejection !== undefined) {
      updateData['settings.coin_rejection'] = coin_rejection;
    }
    
    const device = await Device.findOneAndUpdate(
      { device_id },
      { $set: updateData },
      { new: true, upsert: true }
    );
    
    return res.status(200).json({ 
      success: true,
      message: 'Settings updated',
      device
    });
  } catch (error) {
    console.error('Settings update error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// 🆕 Get device list
app.get('/api/devices', async (req, res) => {
  try {
    const devices = await Device.find();
    return res.status(200).json({ devices });
  } catch (error) {
    console.error('Get devices error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ✅ Login route
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// ✅ Login handler
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

// ✅ Logout route
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

// ✅ Protected dashboard route
app.get('/', (req, res) => {
  if (!req.session.loggedIn) {
    return res.redirect('/login');
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ✅ Catch-all route
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

// ✅ Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});