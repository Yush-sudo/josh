const express = require('express');
const { API_KEY } = require('../config');
const router = express.Router();

router.post('/auth', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${API_KEY}`) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin123') {
    res.json({ success: true, message: 'Authenticated' });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

module.exports = router;
