const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 数据库文件路径
const DB_FILE = path.join(__dirname, 'db.json');

// 初始化数据库
function initDB() {
  if (!fs.existsSync(DB_FILE)) {
    const initialData = {
      comments: [
        {
          id: 1,
          author: '网站主人',
          text: '欢迎来到我的网站！来留下你的第一条评论吧~',
          created_at: new Date().toISOString()
        }
      ]
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
  }
}

initDB();

// 读取数据库
function readDB() {
  const data = fs.readFileSync(DB_FILE, 'utf8');
  return JSON.parse(data);
}

// 写入数据库
function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

app.use(cors());
app.use(express.json());

// 静态文件服务
app.use(express.static(path.join(__dirname)));

// 获取评论（最新10条）
app.get('/api/comments', (req, res) => {
  try {
    const db = readDB();
    const comments = db.comments
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 10);
    res.json(comments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 添加评论
app.post('/api/comments', (req, res) => {
  try {
    const { author, text } = req.body;
    
    if (!text || text.trim() === '') {
      return res.status(400).json({ error: '评论内容不能为空' });
    }

    const authorName = (author && author.trim()) ? author.trim() : '匿名用户';
    const commentText = text.trim();
    
    const db = readDB();
    
    const newId = db.comments.length > 0 
      ? Math.max(...db.comments.map(c => c.id)) + 1 
      : 1;

    const newComment = {
      id: newId,
      author: authorName,
      text: commentText,
      created_at: new Date().toISOString()
    };

    db.comments.push(newComment);
    writeDB(db);

    res.json(newComment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
  console.log(`📝 评论系统已就绪！`);
});
