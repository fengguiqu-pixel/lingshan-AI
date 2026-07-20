// ===== 知识库管理 API =====
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mammoth = require('mammoth');

// 文件上传存储配置（工作空间内）
const UPLOAD_DIR = path.join(__dirname, '..', 'data', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    const timestamp = Date.now();
    cb(null, name + '_' + timestamp + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: function (req, file, cb) {
    const allowed = ['.txt', '.md', '.docx', '.pdf', '.html', '.json', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件类型: ' + ext + '，支持: ' + allowed.join(', ')));
    }
  }
});

function getDb() {
  return require('../config/database');
}

// ============================================================
// 文件上传（解析文档内容并存入知识库）
// ============================================================
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请选择要上传的文件' });
    }

    const { title, category } = req.body;
    const file = req.file;
    const ext = path.extname(file.originalname).toLowerCase();

    let content = '';
    let wordCount = 0;

    // 根据文件类型提取文本内容
    try {
      if (ext === '.txt' || ext === '.md' || ext === '.html') {
        content = fs.readFileSync(file.path, 'utf-8');
        if (ext === '.html') {
          content = content.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        }
      } else if (ext === '.docx') {
        const result = await mammoth.extractRawText({ path: file.path });
        content = result.value.trim();
      } else if (ext === '.pdf') {
        // PDF 解析需要额外库，这里简单记录无法提取内容
        content = '[PDF文档 - 内容需手动编辑]';
      } else {
        content = fs.readFileSync(file.path, 'utf-8').substring(0, 10000);
      }
    } catch (parseErr) {
      console.error('文件解析失败:', parseErr);
      content = '[文件解析失败，请手动编辑内容]';
    }

    wordCount = content.length;

    const db = getDb();
    const result = db.prepare(`
      INSERT INTO knowledge_documents (title, category, content, filename, file_type, file_size, word_count, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'published')
    `).run(
      title || file.originalname,
      category || '通用',
      content,
      file.filename,
      ext,
      file.size,
      wordCount
    );

    // 如果上传的是 CSV，尝试解析为 FAQ
    if (ext === '.csv') {
      autoImportFAQ(content, category, db);
    }

    res.json({
      success: true,
      document: {
        id: result.lastInsertRowid,
        title: title || file.originalname,
        category: category || '通用',
        word_count: wordCount,
        file_size: file.size
      },
      message: '文件上传成功，已解析存入知识库'
    });

  } catch (err) {
    console.error('上传失败:', err);
    res.status(500).json({ error: '上传失败: ' + err.message });
  }
});

// ============================================================
// 手动创建/编辑知识文档
// ============================================================
router.post('/', (req, res) => {
  try {
    const { title, category, content } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: '标题和内容不能为空' });
    }

    const db = getDb();
    const result = db.prepare(`
      INSERT INTO knowledge_documents (title, category, content, word_count, status)
      VALUES (?, ?, ?, ?, 'published')
    `).run(title, category || '通用', content, content.length);

    res.json({
      success: true,
      document: { id: result.lastInsertRowid, title, category }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 获取知识库列表
// ============================================================
router.get('/', (req, res) => {
  try {
    const { category, search, status } = req.query;
    const db = getDb();

    let sql = 'SELECT id, title, category, filename, file_type, file_size, word_count, status, created_at, updated_at FROM knowledge_documents WHERE 1=1';
    const params = [];

    if (category && category !== 'all') {
      sql += ' AND category = ?';
      params.push(category);
    }
    if (status && status !== 'all') {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (search) {
      sql += ' AND (title LIKE ? OR content LIKE ?)';
      params.push('%' + search + '%', '%' + search + '%');
    }

    sql += ' ORDER BY updated_at DESC';

    const docs = db.prepare(sql).all(...params);
    res.json({ success: true, count: docs.length, documents: docs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 获取单个文档详情
// ============================================================
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const doc = db.prepare('SELECT * FROM knowledge_documents WHERE id = ?').get(req.params.id);
    if (!doc) {
      return res.status(404).json({ error: '文档不存在' });
    }
    res.json({ success: true, document: doc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 更新文档
// ============================================================
router.put('/:id', (req, res) => {
  try {
    const { title, category, content, status } = req.body;
    const db = getDb();

    const updates = [];
    const params = [];

    if (title !== undefined) { updates.push('title = ?'); params.push(title); }
    if (category !== undefined) { updates.push('category = ?'); params.push(category); }
    if (content !== undefined) { updates.push('content = ?'); updates.push('word_count = ?'); params.push(content, content.length); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }

    if (updates.length === 0) {
      return res.status(400).json({ error: '未提供需要更新的字段' });
    }

    updates.push("updated_at = datetime('now','localtime')");
    params.push(req.params.id);

    const result = db.prepare(`UPDATE knowledge_documents SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    if (result.changes === 0) {
      return res.status(404).json({ error: '文档不存在' });
    }

    res.json({ success: true, message: '更新成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 删除文档
// ============================================================
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const doc = db.prepare('SELECT filename FROM knowledge_documents WHERE id = ?').get(req.params.id);
    if (!doc) {
      return res.status(404).json({ error: '文档不存在' });
    }

    // 删除数据库记录
    db.prepare('DELETE FROM knowledge_documents WHERE id = ?').run(req.params.id);

    // 删除上传的文件
    if (doc.filename) {
      const filePath = path.join(UPLOAD_DIR, doc.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    res.json({ success: true, message: '删除成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 获取知识库分类列表
// ============================================================
router.get('/categories/list', (req, res) => {
  try {
    const db = getDb();
    const cats = db.prepare('SELECT DISTINCT category, COUNT(*) as count FROM knowledge_documents WHERE status = ? GROUP BY category').all('published');
    res.json({ success: true, categories: cats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 搜索知识库（供AI数字人使用）
// ============================================================
router.get('/search/query', (req, res) => {
  try {
    const { q, limit = 5 } = req.query;
    if (!q) {
      return res.status(400).json({ error: '请提供搜索关键词' });
    }

    const db = getDb();
    const results = db.prepare(`
      SELECT id, title, category, 
             substr(content, 1, 500) as snippet,
             word_count
      FROM knowledge_documents 
      WHERE status = 'published' AND (title LIKE ? OR content LIKE ?)
      ORDER BY 
        CASE WHEN title LIKE ? THEN 0 ELSE 1 END,
        word_count DESC
      LIMIT ?
    `).all('%' + q + '%', '%' + q + '%', '%' + q + '%', parseInt(limit));

    res.json({ success: true, query: q, count: results.length, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// CSV自动导入为FAQ
// ============================================================
function autoImportFAQ(csvContent, category, db) {
  try {
    const lines = csvContent.split('\n').filter(l => l.trim());
    if (lines.length < 2) return;

    const header = lines[0].toLowerCase();
    const qIdx = header.includes('问题') || header.includes('question') ? 
      header.split(',').findIndex(c => c.includes('问题') || c.includes('question')) : 0;
    const aIdx = header.includes('答案') || header.includes('answer') ? 
      header.split(',').findIndex(c => c.includes('答案') || c.includes('answer')) : 1;

    let imported = 0;
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.replace(/^"|"$/g, '').trim());
      if (cols.length >= 2 && cols[qIdx] && cols[aIdx]) {
        db.prepare('INSERT INTO faqs (question, answer, category) VALUES (?, ?, ?)').run(
          cols[qIdx], cols[aIdx], category || '通用'
        );
        imported++;
      }
    }
    if (imported > 0) {
      console.log('  CSV自动导入FAQ: ' + imported + ' 条');
    }
  } catch (err) {
    console.error('CSV FAQ导入失败:', err);
  }
}

module.exports = router;
