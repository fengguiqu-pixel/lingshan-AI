const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../config/database');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;

router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }
    
    const user = db.prepare(`SELECT * FROM admin_users WHERE username = ?`).get(username);
    
    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    
    if (password === user.password) {
      const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
      
      db.prepare(`UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE id = ?`).run(user.id);
      
      res.json({
        success: true,
        token: token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role
        }
      });
    } else {
      res.status(401).json({ error: '用户名或密码错误' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/register', (req, res) => {
  try {
    const { username, password, role } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }
    
    const result = db.prepare(
      `INSERT INTO admin_users (username, password, role) VALUES (?, ?, ?)`
    ).run(username, password, role || 'admin');
    
    res.json({ success: true, id: result.lastInsertRowid, message: '管理员创建成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/profile', verifyToken, (req, res) => {
  try {
    const user = db.prepare(`SELECT id, username, role, created_at, last_login FROM admin_users WHERE id = ?`).get(req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function verifyToken(req, res, next) {
  const token = req.headers['authorization'];
  
  if (!token) {
    return res.status(403).json({ error: '没有提供token' });
  }
  
  jwt.verify(token.replace('Bearer ', ''), JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: '无效的token' });
    }
    req.user = decoded;
    next();
  });
}

module.exports = router;
module.exports.verifyToken = verifyToken;
