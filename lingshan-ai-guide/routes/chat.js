const express = require('express');
const router = express.Router();
const axios = require('axios');
const db = require('../config/database');
require('dotenv').config();

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

/**
 * 打印带时间戳的诊断日志
 */
function diagLog(label, detail) {
  const ts = new Date().toISOString();
  console.log(`[AI-DIAG][${ts}] ${label}:`, detail);
}

router.post('/', async (req, res) => {
  const startTime = Date.now();
  let apiStatus = 'NOT_CALLED'; // 跟踪 AI 调用状态

  try {
    const { message, user_id, history, preferences, interests } = req.body;

    if (!message) {
      return res.status(400).json({ error: '消息不能为空' });
    }

    diagLog('收到用户消息', { message: message.substring(0, 100), user_id: user_id || 'guest' });

    // 关键检查：API Key 是否已配置
    if (!DEEPSEEK_API_KEY) {
      apiStatus = 'API_KEY_MISSING';
      diagLog('API 状态', { status: apiStatus, hint: '缺少 DEEPSEEK_API_KEY 环境变量' });
      throw new Error('DEEPSEEK_API_KEY_NOT_SET');
    }

    // 根据用户问题检索相关的基础数据 + 知识库文档
    const context = buildContext(message);
    
    let systemPrompt = `你是"小灵"，灵山胜境景区的AI数字人导游。请根据以下知识库内容回答游客的问题。

【灵山胜境知识库】
${context}

【回答要求】
1. 始终保持亲切友好的语气，自称"小灵"，使用自然的中文表达
2. 优先使用知识库中的信息回答问题，确保准确性
3. 如果知识库中有相关文档，务必引用其中的内容
4. 如果知识库中没有相关信息，可以基于常识补充，然后提醒游客联系景区客服确认
5. 回答简洁有条理，重点内容用序号列出
6. 涉及景点介绍时，让描述更生动有趣`;

    // ===== 个性化偏好注入 =====
    if (preferences && preferences.trim()) {
      systemPrompt += `\n\n【游客个性化偏好 - 务必遵循】
该游客通过个性化推荐选择了以下兴趣偏好：${interests || '自定义'}

请严格按以下讲解方向调整回答风格和侧重：
${preferences}

注意：
- 要在回答中体现对游客兴趣的理解和回应
- 优先推荐与偏好相关的景点和活动
- 语气要贴合游客的兴趣特征`;
    }

    // 构建消息列表：system + 历史对话 + 当前问题
    const messages = [{ role: 'system', content: systemPrompt }];
    if (history && Array.isArray(history)) {
      for (const h of history.slice(-10)) {
        if (h.role === 'user' || h.role === 'assistant') {
          messages.push({ role: h.role, content: h.content });
        }
      }
    }
    messages.push({ role: 'user', content: message });
    
    diagLog('即将调用 DeepSeek API', {
      url: DEEPSEEK_API_URL,
      model: 'deepseek-chat',
      messagesCount: messages.length,
      keyPrefix: DEEPSEEK_API_KEY ? DEEPSEEK_API_KEY.substring(0, 6) + '...' : 'undefined',
      keyLength: DEEPSEEK_API_KEY ? DEEPSEEK_API_KEY.length : 0
    });

    const response = await axios.post(DEEPSEEK_API_URL, {
      model: 'deepseek-chat',
      messages,
      temperature: 0.7,
      max_tokens: 2000
    }, {
      headers: {
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 秒超时
    });

    apiStatus = 'SUCCESS';
    diagLog('DeepSeek API 调用成功', {
      status: response.status,
      statusText: response.statusText,
      latencyMs: Date.now() - startTime,
      usage: response.data?.usage || null,
      choicesCount: response.data?.choices?.length || 0
    });

    const reply = response.data.choices[0].message.content;

    db.prepare(
      `INSERT INTO chat_interactions (user_id, user_message, ai_response) VALUES (?, ?, ?)`
    ).run(user_id || 'guest', message, reply);

    res.json({ success: true, reply, _api_status: apiStatus, _latency_ms: Date.now() - startTime });
  } catch (err) {
    apiStatus = apiStatus === 'NOT_CALLED' ? 'FAILED_BEFORE_CALL' : 'FAILED';

    const diag = {
      status: apiStatus,
      errorMessage: err.message,
      errorCode: err.code || null,
      responseStatus: err.response?.status || null,
      responseStatusText: err.response?.statusText || null,
      responseData: err.response?.data || null,
      latencyMs: Date.now() - startTime
    };

    diagLog('AI API Error', diag);

    // 根据错误原因返回不同的兜底文案
    let fallbackReply;
    if (err.message === 'DEEPSEEK_API_KEY_NOT_SET' || !DEEPSEEK_API_KEY) {
      fallbackReply = '您好！我是小灵，AI 导游服务尚未配置智能服务密钥。请让管理员在后台配置 DEEPSEEK_API_KEY 后重试，或拨打景区客服热线 400-828-9766 获取帮助。';
    } else if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
      fallbackReply = '您好！AI 服务响应超时，可能是网络较慢，请稍后再试。您也可以拨打景区客服热线 400-828-9766 获取帮助。';
    } else if (err.response && err.response.status >= 500) {
      fallbackReply = '您好！AI 智能服务暂时不可用（服务器错误），请稍后再试。您也可以拨打景区客服热线 400-828-9766 获取帮助。';
    } else if (err.response && err.response.status === 401) {
      fallbackReply = '您好！AI 服务密钥无效，请联系管理员检查 DEEPSEEK_API_KEY 配置。';
    } else if (err.response && err.response.status === 429) {
      fallbackReply = '您好！AI 服务请求过于频繁，请稍后再试。';
    } else {
      fallbackReply = getFallbackReply(req.body.message);
    }

    db.prepare(
      `INSERT INTO chat_interactions (user_id, user_message, ai_response) VALUES (?, ?, ?)`
    ).run(req.body.user_id || 'guest', req.body.message, fallbackReply);

    // 返回兜底回复，同时带上诊断字段，方便前端/管理台查看
    res.json({ success: true, reply: fallbackReply, _api_status: apiStatus, _api_diag: diag });
  }
});

/**
 * 提取用户消息中的关键词
 */
function extractKeywords(message) {
  // 常见停用词
  const stopWords = new Set([
    '的','了','在','是','我','有','和','就','不','人','都','一','一个',
    '上','也','很','到','说','要','去','你','会','着','没有','看','好',
    '自己','这','他','她','它','们','那','什么','怎么','如何','为什么',
    '哪','哪里','哪个','可以','吗','呢','吧','啊','哦','嗯','能','请',
    '帮忙','告诉','知道','想','想要','帮我','帮'
  ]);
  
  // 简单分词：按空格和标点分割
  const words = message
    .replace(/[，。！？、；：""''（）【】《》\s,\.!\?;:\(\)\[\]{}"']/g, ' ')
    .split(' ')
    .filter(w => w.length >= 2 && !stopWords.has(w));
  
  return [...new Set(words)]; // 去重
}

/**
 * 构建知识库上下文：基础数据 + 知识库文档检索
 */
function buildContext(message) {
  let context = '';
  
  // ========== 1. 基础数据：景点 + 票务 ==========
  const spots = db.prepare(`SELECT name, description FROM scenic_spots`).all();
  if (spots.length > 0) {
    context += '【景点信息】\n';
    spots.forEach(spot => {
      context += `- ${spot.name}: ${spot.description}\n`;
    });
    context += '\n';
  }
  
  const ticket = db.prepare(`SELECT price, half_price, free, open_time, includes FROM ticket_info LIMIT 1`).get();
  if (ticket) {
    context += `【门票信息】
- 全价票：${ticket.price}
- 半价票/优惠：${ticket.half_price}
- 免费政策：${ticket.free}
- 开放时间：${ticket.open_time}
- 包含项目：${ticket.includes}\n\n`;
  }

  // ========== 2. 相关 FAQ 检索 ==========
  const keywords = extractKeywords(message);
  if (keywords.length > 0) {
    const faqConditions = keywords.map(() => `(question LIKE ? OR answer LIKE ?)`).join(' OR ');
    const faqParams = [];
    keywords.forEach(k => { faqParams.push(`%${k}%`, `%${k}%`); });
    
    const faqs = db.prepare(
      `SELECT question, answer FROM faqs WHERE ${faqConditions} LIMIT 5`
    ).all(...faqParams);
    
    if (faqs.length > 0) {
      context += '【相关常见问题】\n';
      faqs.forEach(faq => {
        context += `问：${faq.question}\n答：${faq.answer}\n\n`;
      });
    }
  }

  // ========== 3. 知识库文档检索（核心） ==========
  try {
    if (keywords.length > 0) {
      const docConditions = keywords.map(() => `(title LIKE ? OR content LIKE ?)`).join(' OR ');
      const docParams = [];
      keywords.forEach(k => { docParams.push(`%${k}%`, `%${k}%`); });
      
      const docs = db.prepare(
        `SELECT title, content, category FROM knowledge_documents 
         WHERE status = 'published' AND (${docConditions})
         ORDER BY 
           (CASE WHEN title LIKE ? THEN 10 ELSE 0 END) +
           (CASE WHEN category = '常见问题' THEN 5 ELSE 0 END) +
           (CASE WHEN category = '景点讲解' THEN 3 ELSE 0 END)
         DESC
         LIMIT 5`
      ).all(...docParams, `%${message.substring(0, 20)}%`);
      
      if (docs.length > 0) {
        context += '【知识库文档】\n';
        docs.forEach(doc => {
          // 截取内容，避免过长（最多 500 字）
          const snippet = doc.content.length > 500 
            ? doc.content.substring(0, 500) + '...' 
            : doc.content;
          context += `--- ${doc.title} (分类: ${doc.category}) ---\n${snippet}\n\n`;
        });
      }
    }
    
    // 如果没搜到结果，也把最近几条知识文档带上作为参考
    if (!keywords.length || context.indexOf('【知识库文档】') === -1) {
      const recentDocs = db.prepare(
        `SELECT title, content, category FROM knowledge_documents 
         WHERE status = 'published' 
         ORDER BY updated_at DESC LIMIT 3`
      ).all();
      
      if (recentDocs.length > 0) {
        context += '【知识库文档】（最新）\n';
        recentDocs.forEach(doc => {
          const snippet = doc.content.length > 400 
            ? doc.content.substring(0, 400) + '...' 
            : doc.content;
          context += `--- ${doc.title} ---\n${snippet}\n\n`;
        });
      }
    }
  } catch(e) {
    // knowledge_documents 表可能还不存在
  }

  // ========== 4. 所有 FAQ 作为兜底（如果前面没匹配到） ==========
  if (context.indexOf('【相关常见问题】') === -1) {
    const allFaqs = db.prepare(`SELECT question, answer FROM faqs LIMIT 10`).all();
    if (allFaqs.length > 0) {
      context += '【常见问题参考】\n';
      allFaqs.forEach(faq => {
        context += `问：${faq.question}\n答：${faq.answer}\n\n`;
      });
    }
  }
  
  // 总字符数限制，防止超过 token
  if (context.length > 5000) {
    context = context.substring(0, 5000) + '\n...(知识库内容已截断)';
  }
  
  return context;
}

function getFallbackReply(message) {
  if (message.includes('门票') || message.includes('价格') || message.includes('多少钱')) {
    return '灵山胜境景区门票信息：全价票210元/人，半价票105元/人。优惠政策包括：6周岁以下儿童、70周岁以上老人凭有效证件免费入园；6-18周岁未成年人、全日制本科及以下学历学生凭有效证件享受半价优惠。开放时间为7:30-17:30。';
  }
  
  if (message.includes('景点') || message.includes('游玩') || message.includes('介绍')) {
    return '灵山胜境景区拥有众多著名景点，包括灵山大佛、梵宫、灵山胜境文化园等。灵山大佛高88米，是世界上最高的佛立像之一；梵宫建筑气势恢宏，内部装饰精美，展现了佛教艺术的博大精深。';
  }
  
  return '您好！感谢您访问灵山胜境AI导游系统。如果您有任何关于景区的问题，欢迎随时咨询。由于网络原因，我暂时无法连接到智能服务，您可以拨打景区客服热线400-828-9766获取帮助。';
}

// ===== AI 服务诊断端点 =====
router.get('/diag', async (req, res) => {
  const result = {
    success: true,
    data: {
      api_key_configured: !!DEEPSEEK_API_KEY,
      key_preview: DEEPSEEK_API_KEY ? DEEPSEEK_API_KEY.substring(0, 6) + '...' : null,
      key_length: DEEPSEEK_API_KEY ? DEEPSEEK_API_KEY.length : 0,
      api_url: DEEPSEEK_API_URL,
      model: 'deepseek-chat',
      timestamp: new Date().toISOString()
    }
  };

  // 如果配置了 key，尝试轻量探测 DeepSeek 服务是否可达
  if (DEEPSEEK_API_KEY) {
    const start = Date.now();
    try {
      const probe = await axios.get('https://api.deepseek.com/v1/models', {
        headers: { 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
        timeout: 15000
      });
      result.data.network_reachable = true;
      result.data.probe_status = probe.status;
      result.data.probe_latency_ms = Date.now() - start;
      result.data.available_models = (probe.data?.data || []).map(m => m.id).slice(0, 10);
    } catch (err) {
      result.data.network_reachable = false;
      result.data.probe_error = err.message;
      result.data.probe_status = err.response?.status || null;
      result.data.probe_status_text = err.response?.statusText || null;
      result.data.probe_response_data = err.response?.data || null;
      result.data.probe_latency_ms = Date.now() - start;
    }
  } else {
    result.data.network_reachable = false;
    result.data.probe_error = 'DEEPSEEK_API_KEY 未配置，跳过网络探测';
  }

  res.json(result);
});

router.get('/history', (req, res) => {
  try {
    const { user_id, limit = 20 } = req.query;
    
    let query = `SELECT * FROM chat_interactions ORDER BY created_at DESC LIMIT ?`;
    
    if (user_id) {
      query = `SELECT * FROM chat_interactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`;
      const history = db.prepare(query).all(user_id, parseInt(limit));
      res.json({ success: true, data: history });
    } else {
      const history = db.prepare(query).all(parseInt(limit));
      res.json({ success: true, data: history });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
