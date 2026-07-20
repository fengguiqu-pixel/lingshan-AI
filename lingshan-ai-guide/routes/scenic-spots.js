const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/', (req, res) => {
  try {
    const spots = db.prepare(`SELECT * FROM scenic_spots ORDER BY order_num ASC`).all();
    
    const result = spots.map(spot => {
      const highlights = db.prepare(`SELECT * FROM highlights WHERE spot_id = ?`).all(spot.id);
      const tips = db.prepare(`SELECT * FROM tips WHERE spot_id = ?`).all(spot.id);
      
      return {
        id: spot.spot_id,
        name: spot.name,
        subtitle: spot.subtitle,
        rating: spot.rating,
        tag: spot.tag,
        tagColor: spot.tag_color,
        duration: spot.duration,
        bestTime: spot.best_time,
        heroGradient: spot.hero_gradient,
        heroImage: spot.hero_image,
        description: spot.description,
        position: { x: spot.position_x, y: spot.position_y },
        coordinates: spot.coordinates,
        highlights: highlights.map(h => ({ icon: h.icon, title: h.title, text: h.text })),
        tips: tips.map(t => ({ icon: t.icon, title: t.title, text: t.text }))
      };
    });
    
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const spot = db.prepare(`SELECT * FROM scenic_spots WHERE spot_id = ?`).get(req.params.id);
    
    if (!spot) {
      const spotById = db.prepare(`SELECT * FROM scenic_spots WHERE id = ?`).get(req.params.id);
      if (!spotById) {
        return res.status(404).json({ error: '景点不存在' });
      }
      spot = spotById;
    }
    
    const highlights = db.prepare(`SELECT * FROM highlights WHERE spot_id = ?`).all(spot.id);
    const tips = db.prepare(`SELECT * FROM tips WHERE spot_id = ?`).all(spot.id);
    
    res.json({
      success: true,
      data: {
        id: spot.spot_id,
        name: spot.name,
        subtitle: spot.subtitle,
        rating: spot.rating,
        tag: spot.tag,
        tagColor: spot.tag_color,
        duration: spot.duration,
        bestTime: spot.best_time,
        heroGradient: spot.hero_gradient,
        heroImage: spot.hero_image,
        description: spot.description,
        position: { x: spot.position_x, y: spot.position_y },
        coordinates: spot.coordinates,
        highlights: highlights.map(h => ({ icon: h.icon, title: h.title, text: h.text })),
        tips: tips.map(t => ({ icon: t.icon, title: t.title, text: t.text }))
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { spot_id, name, subtitle, rating, tag, tag_color, duration, best_time, hero_gradient, hero_image, description, position_x, position_y, coordinates, order_num, highlights, tips } = req.body;
    
    const result = db.prepare(
      `INSERT INTO scenic_spots (spot_id, name, subtitle, rating, tag, tag_color, duration, best_time, hero_gradient, hero_image, description, position_x, position_y, coordinates, order_num) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(spot_id, name, subtitle, rating || 5.0, tag, tag_color, duration, best_time, hero_gradient, hero_image, description, position_x, position_y, coordinates, order_num || 0);
    
    const newSpotId = result.lastInsertRowid;
    
    if (highlights && Array.isArray(highlights)) {
      highlights.forEach(h => {
        db.prepare(`INSERT INTO highlights (spot_id, icon, title, text) VALUES (?, ?, ?, ?)`).run(newSpotId, h.icon, h.title, h.text);
      });
    }
    
    if (tips && Array.isArray(tips)) {
      tips.forEach(t => {
        db.prepare(`INSERT INTO tips (spot_id, icon, title, text) VALUES (?, ?, ?, ?)`).run(newSpotId, t.icon, t.title, t.text);
      });
    }
    
    res.json({ success: true, id: newSpotId, message: '景点创建成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { name, subtitle, rating, tag, tag_color, duration, best_time, hero_gradient, hero_image, description, position_x, position_y, coordinates, order_num, highlights, tips } = req.body;
    
    const spot = db.prepare(`SELECT * FROM scenic_spots WHERE spot_id = ?`).get(req.params.id);
    if (!spot) {
      return res.status(404).json({ error: '景点不存在' });
    }
    
    db.prepare(
      `UPDATE scenic_spots SET name = ?, subtitle = ?, rating = ?, tag = ?, tag_color = ?, duration = ?, best_time = ?, hero_gradient = ?, hero_image = ?, description = ?, position_x = ?, position_y = ?, coordinates = ?, order_num = ? WHERE spot_id = ?`
    ).run(name, subtitle, rating, tag, tag_color, duration, best_time, hero_gradient, hero_image, description, position_x, position_y, coordinates, order_num, req.params.id);
    
    if (highlights && Array.isArray(highlights)) {
      db.prepare(`DELETE FROM highlights WHERE spot_id = ?`).run(spot.id);
      highlights.forEach(h => {
        db.prepare(`INSERT INTO highlights (spot_id, icon, title, text) VALUES (?, ?, ?, ?)`).run(spot.id, h.icon, h.title, h.text);
      });
    }
    
    if (tips && Array.isArray(tips)) {
      db.prepare(`DELETE FROM tips WHERE spot_id = ?`).run(spot.id);
      tips.forEach(t => {
        db.prepare(`INSERT INTO tips (spot_id, icon, title, text) VALUES (?, ?, ?, ?)`).run(spot.id, t.icon, t.title, t.text);
      });
    }
    
    res.json({ success: true, message: '景点更新成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const spot = db.prepare(`SELECT * FROM scenic_spots WHERE spot_id = ?`).get(req.params.id);
    if (!spot) {
      return res.status(404).json({ error: '景点不存在' });
    }
    
    db.prepare(`DELETE FROM highlights WHERE spot_id = ?`).run(spot.id);
    db.prepare(`DELETE FROM tips WHERE spot_id = ?`).run(spot.id);
    db.prepare(`DELETE FROM scenic_spots WHERE spot_id = ?`).run(req.params.id);
    
    res.json({ success: true, message: '景点删除成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;