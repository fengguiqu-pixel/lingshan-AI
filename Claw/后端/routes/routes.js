const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/', (req, res) => {
  try {
    const routes = db.prepare(`SELECT * FROM routes ORDER BY id`).all();
    
    const result = routes.map(route => {
      const stops = db.prepare(`SELECT * FROM route_stops WHERE route_id = ? ORDER BY stop_order`).all(route.id);
      return {
        id: route.route_id,
        name: route.name,
        duration: route.duration,
        difficulty: route.difficulty,
        difficultyColor: route.difficulty_color,
        description: route.description,
        stops: stops.map(s => ({
          time: s.time,
          spot: s.spot,
          activity: s.activity,
          duration: s.duration
        }))
      };
    });
    
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const route = db.prepare(`SELECT * FROM routes WHERE route_id = ?`).get(req.params.id);
    
    if (!route) {
      const routeById = db.prepare(`SELECT * FROM routes WHERE id = ?`).get(req.params.id);
      if (!routeById) {
        return res.status(404).json({ error: '路线不存在' });
      }
      route = routeById;
    }
    
    const stops = db.prepare(`SELECT * FROM route_stops WHERE route_id = ? ORDER BY stop_order`).all(route.id);
    
    res.json({
      success: true,
      data: {
        id: route.route_id,
        name: route.name,
        duration: route.duration,
        difficulty: route.difficulty,
        difficultyColor: route.difficulty_color,
        description: route.description,
        stops: stops.map(s => ({
          time: s.time,
          spot: s.spot,
          activity: s.activity,
          duration: s.duration
        }))
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { route_id, name, description, duration, difficulty, difficulty_color, stops } = req.body;
    
    const result = db.prepare(
      `INSERT INTO routes (route_id, name, description, duration, difficulty, difficulty_color) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(route_id, name, description, duration, difficulty, difficulty_color);
    
    const routeId = result.lastInsertRowid;
    
    if (stops && Array.isArray(stops)) {
      stops.forEach((stop, index) => {
        db.prepare(
          `INSERT INTO route_stops (route_id, time, spot, activity, duration, stop_order) VALUES (?, ?, ?, ?, ?, ?)`
        ).run(routeId, stop.time, stop.spot, stop.activity, stop.duration, index + 1);
      });
    }
    
    res.json({ success: true, id: routeId, message: '路线创建成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { name, description, duration, difficulty, difficulty_color, stops } = req.body;
    
    const route = db.prepare(`SELECT * FROM routes WHERE route_id = ?`).get(req.params.id);
    if (!route) {
      return res.status(404).json({ error: '路线不存在' });
    }
    
    db.prepare(
      `UPDATE routes SET name = ?, description = ?, duration = ?, difficulty = ?, difficulty_color = ? WHERE route_id = ?`
    ).run(name, description, duration, difficulty, difficulty_color, req.params.id);
    
    if (stops && Array.isArray(stops)) {
      db.prepare(`DELETE FROM route_stops WHERE route_id = ?`).run(route.id);
      
      stops.forEach((stop, index) => {
        db.prepare(
          `INSERT INTO route_stops (route_id, time, spot, activity, duration, stop_order) VALUES (?, ?, ?, ?, ?, ?)`
        ).run(route.id, stop.time, stop.spot, stop.activity, stop.duration, index + 1);
      });
    }
    
    res.json({ success: true, message: '路线更新成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const route = db.prepare(`SELECT * FROM routes WHERE route_id = ?`).get(req.params.id);
    if (!route) {
      return res.status(404).json({ error: '路线不存在' });
    }
    
    db.prepare(`DELETE FROM route_stops WHERE route_id = ?`).run(route.id);
    db.prepare(`DELETE FROM routes WHERE route_id = ?`).run(req.params.id);
    
    res.json({ success: true, message: '路线删除成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;