# chronosjs

management mail-messages from cron jobs(with express.js)

```tree
project-root/
├── config/
│   ├── database.js        # データベース接続設定
│   └── config.js          # アプリ全体の設定
├── src/
│   ├── models/
│   │   ├── cronJob.js     # クロンジョブモデル
│   │   └── alert.js       # アラートモデル
│   ├── services/
│   │   ├── mailParser.js  # メール解析サービス
│   │   ├── cronChecker.js # クロンジョブチェックサービス
│   │   └── alertNotifier.js # 監視ツール通知サービス
│   ├── routes/
│   │   ├── api.js         # API用ルート
│   │   └── index.js       # メインルート
│   ├── utils/
│   │   ├── logger.js      # ロギングユーティリティ
│   │   └── emailFetcher.js # メール取得ユーティリティ
│   └── app.js            # Expressアプリケーション設定
├── migrations/
│   └── init.sql       # 初期DBマイグレーション
├── plugins/
│   ├── nagios.js         # Nagios通知プラグイン
│   ├── zabbix.js         # Zabbix通知プラグイン
│   └── prometheus.js     # Prometheus通知プラグイン
├── package.json
└── server.js            # アプリケーションのエントリーポイント
```

## install procedure

1. deploy .env file

example:

```env
PORT=3000
MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_SECURE=false
MAIL_USER=your-email@example.com
MAIL_PASSWORD=your-email-password
MAIL_FROM=your-email@example.com
MAIL_RECIPIENTS=recipient1@example.com,recipient2@example.com
```

2. setup config/config.js

example:

```js
require('dotenv').config();

module.exports = {
  mail: {
    host: process.env.MAIL_HOST,
    port: parseInt(process.env.MAIL_PORT, 10),
    secure: process.env.MAIL_SECURE === 'true',
    user: process.env.MAIL_USER,
    password: process.env.MAIL_PASSWORD,
    from: process.env.MAIL_FROM,
    recipients: process.env.MAIL_RECIPIENTS.split(','),
  },
  server: {
    port: process.env.PORT || 3000,
  },
};


```

1. preload databases
1. migrate
1. add scripts
1. install dependency check
1. run it
