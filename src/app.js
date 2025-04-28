const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const routes = require('routes');
const logger = require('./utils/logger');

const app = express();

// ミドルウェア
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// リクエストロギング
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// ルーティング
app.use('/', routes);

// 404ハンドラー
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'リソースが見つかりません'
  });
});

// エラーハンドラー
app.use((err, req, res, next) => {
  logger.error('アプリケーションエラー:', err);
  
  res.status(err.status || 500).json({
    status: 'error',
    message: err.message || '内部サーバーエラー'
  });
});

module.exports = app;

