#!/usr/bin/env node

require('dotenv').config();
const app = require('./src/app');
const logger = require('./src/utils/logger');
const cronChecker = require('./src/services/cronChecker');

const PORT = process.env.PORT || 3000;

// サーバー起動
app.listen(PORT, () => {
  logger.info(`サーバーが起動しました: http://localhost:${PORT}`);
  
  // クロンジョブチェッカーを開始
  cronChecker.startAll();
  
  logger.info('クロンジョブ監視が開始されました');
});

// 予期せぬエラーハンドリング
process.on('uncaughtException', (error) => {
  logger.error('予期せぬエラーが発生しました:', error);
  // 深刻なエラーの場合はプロセスを終了させる選択も
  // process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('未処理のプロミス拒否:', reason);
});

