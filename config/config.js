// 環境変数からの設定読み込み
const config = {
  app: {
    name: process.env.APP_NAME || 'cron-monitor-app',
    env: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info'
  },
  
  // メール設定
  email: {
    imap: {
      user: process.env.MAIL_USER,
      password: process.env.MAIL_PASSWORD,
      host: process.env.MAIL_HOST || 'imap.example.com',
      port: parseInt(process.env.MAIL_PORT, 10) || 993,
      tls: process.env.MAIL_TLS !== 'false',
      tlsOptions: { rejectUnauthorized: process.env.MAIL_REJECT_UNAUTHORIZED !== 'false' }
    },
    // メールボックス監視設定
    checkInterval: parseInt(process.env.MAIL_CHECK_INTERVAL, 10) || 5 * 60 * 1000, // デフォルト5分
    mailbox: process.env.MAIL_MAILBOX || 'INBOX'
  },
  
  // クロンジョブ監視設定
  cronJobs: {
    checkInterval: parseInt(process.env.CRON_CHECK_INTERVAL, 10) || 60 * 1000, // デフォルト1分
    alertThreshold: parseInt(process.env.CRON_ALERT_THRESHOLD, 10) || 10 * 60 * 1000 // デフォルト10分
  },
  
  // 監視通知システム設定
  monitoring: {
    nagios: {
      enabled: process.env.NAGIOS_ENABLED === 'true',
      endpoint: process.env.NAGIOS_ENDPOINT || 'http://localhost/nagios/api',
      token: process.env.NAGIOS_TOKEN
    },
    zabbix: {
      enabled: process.env.ZABBIX_ENABLED === 'true',
      endpoint: process.env.ZABBIX_ENDPOINT || 'http://localhost/zabbix/api_jsonrpc.php',
      user: process.env.ZABBIX_USER,
      password: process.env.ZABBIX_PASSWORD
    },
    prometheus: {
      enabled: process.env.PROMETHEUS_ENABLED === 'true',
      port: parseInt(process.env.PROMETHEUS_PORT, 10) || 9090
    }
  }
};

module.exports = config;

