const express = require('express');
const router = express.Router();
const db = require('../db');

router.post('/register', (req, res) => {
  const { username, password, display_name, user_type } = req.body;
  if (!username || !password || !display_name || !user_type) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  if (!['associate', 'new_joiner'].includes(user_type)) {
    return res.status(400).json({ error: 'Invalid user type' });
  }
  try {
    const result = db.prepare(
      'INSERT INTO accounts (username, password, display_name, user_type) VALUES (?, ?, ?, ?)'
    ).run(username, password, display_name, user_type);
    const user = db.prepare('SELECT id, username, display_name, user_type FROM accounts WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(user);
  } catch (e) {
    res.status(409).json({ error: 'Username already exists' });
  }
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT id, username, display_name, user_type FROM accounts WHERE username = ? AND password = ?').get(username, password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  res.json(user);
});

module.exports = router;
