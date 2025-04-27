const winston = require('winston');
const path = require('path');
const config = require('../../config/config');

// ログファイルの保存場所
const logsDir = path.join(process.cwd(), 'logs');

// ロガーの設定
const logger = winston.createLogger({
  level: config.app.logLevel,
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: config.app.name },
  transports: [
    // コンソールへの出力
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(info => {
          const { timestamp, level, message, ...rest } = info;
          let restString = '';
          if (Object.keys(rest).length > 0 && rest.service) {
            restString = JSON.stringify(rest, null, 2);
          }
          return `${timestamp} [${level}]: ${message} ${restString}`;
        })
      )
    }),
    
    // エラーログファイル
    new winston.transports.File({ 
      filename: path.join(logsDir, 'error.log'), 
      level: 'error' 
    }),
    
    // 全てのログファイル
    new winston.transports.File({ 
      filename: path.join(logsDir, 'combined.log') 
    })
  ]
});

// 開発環境ではより詳細なログを出力
if (config.app.env === 'development') {
  logger.level = 'debug';
}

// APIリクエストのロギング用関数
logger.logRequest = (req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
};

// APIレスポンスのロギング用関数（ミドルウェアとして使用）
logger.logResponse = (req, res, next) => {
  const originalSend = res.send;
  res.send = function(body) {
    logger.debug('Response:', {
      status: res.statusCode,
      body: typeof body === 'object' ? body : {}
    });
    originalSend.call(this, body);
  };
  next();
};

module.exports = logger;

