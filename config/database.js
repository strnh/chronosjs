const pgp = require('pg-promise')();
const logger = require('../src/utils/logger');

// 環境変数からDB接続情報を取得
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'cron_monitor',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  max: 30 // 接続プールの最大数
};

// カスタムエラーハンドラー
const dbMonitor = {
  error(err, e) {
    if (e.cn) {
      // 接続エラー
      logger.error('DB接続エラー:', err);
    }
    if (e.query) {
      // クエリエラー
      logger.error('クエリエラー:', err);
      logger.debug('問題のクエリ:', e.query);
      if (e.params) {
        logger.debug('クエリパラメータ:', e.params);
      }
    }
  }
};

// パフォーマンス計測オプション
const dbOptions = {
  // クエリ実行時間が指定したミリ秒以上かかった場合に警告
  query(e) {
    if (e.time > 100) { // 100ms以上かかったクエリ
      logger.warn(`遅いクエリ検出: ${e.time}ms`, {
        query: e.query,
        params: e.params
      });
    }
  }
};

// データベース接続の初期化
const db = pgp({
  ...dbConfig,
  ...dbOptions
});

// 接続テスト
const testConnection = async () => {
  try {
    const result = await db.one('SELECT 1 AS connected');
    if (result.connected === 1) {
      logger.info('データベースに正常に接続されました');
      return true;
    }
  } catch (error) {
    logger.error('データベース接続テストに失敗しました:', error);
    return false;
  }
};

// モジュールのエクスポート
module.exports = {
  db,
  testConnection
};

