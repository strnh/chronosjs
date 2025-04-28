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
2. setup config/config.js
3. preload databases
4. migrate
5. add scripts
6. install dependency check
7. run it
