-- cron_jobsテーブル: 監視対象のクロンジョブ情報

-- job_executionsテーブル: クロンジョブの実行履歴
CREATE TABLE IF NOT EXISTS job_executions (
  id SERIAL PRIMARY KEY,
  cron_job_id INTEGER REFERENCES cron_jobs(id) ON DELETE CASCADE,
  execution_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) DEFAULT 'success' CHECK (status IN ('success', 'failure', 'partial', 'missed')),
  extracted_data JSONB, -- メールから抽出した有用なデータをJSON形式で保存
  execution_duration INTEGER, -- 実行時間（秒）
  message_id VARCHAR(255), -- メールのMessage-ID
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- alertsテーブル: 検出されたアラート情報
CREATE TABLE IF NOT EXISTS alerts (
  id SERIAL PRIMARY KEY,
  cron_job_id INTEGER REFERENCES cron_jobs(id) ON DELETE CASCADE,
  alert_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  severity VARCHAR(20) CHECK (severity IN ('info', 'warning', 'critical', 'error')),
  message TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- notification_historyテーブル: 監視システムへの通知履歴
CREATE TABLE IF NOT EXISTS notification_history (
  id SERIAL PRIMARY KEY,
  alert_id INTEGER REFERENCES alerts(id) ON DELETE CASCADE,
  notification_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  monitoring_system VARCHAR(50) NOT NULL CHECK (monitoring_system IN ('nagios', 'zabbix', 'prometheus')), -- 'nagios', 'zabbix', 'prometheus'
  endpoint VARCHAR(255) NOT NULL,
  payload JSONB,
  response_code INTEGER,
  response_body TEXT,
  status VARCHAR(20) DEFAULT 'success' CHECK (status IN ('success', 'failure')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- メールテンプレートマッチングのためのテーブル
CREATE TABLE IF NOT EXISTS mail_patterns (
  id SERIAL PRIMARY KEY,
  cron_job_id INTEGER REFERENCES cron_jobs(id) ON DELETE CASCADE,
  pattern_name VARCHAR(100) NOT NULL,
  -- Allowed values for pattern_type: 'regex', 'keyword', 'json_path'
  pattern_type VARCHAR(20) CHECK (pattern_type IN ('regex', 'keyword', 'json_path')),
  target_field VARCHAR(50) CHECK (target_field IN ('subject', 'body', 'from', 'to', 'headers', 'cc', 'bcc')),
  target_field VARCHAR(50) CHECK (target_field IN ('subject', 'body', 'from', 'to', 'headers')),
  extraction_name VARCHAR(100), -- 抽出するデータの名前
  priority INTEGER DEFAULT 0, -- 複数パターンがある場合の優先順位
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- インデックス作成
CREATE INDEX idx_job_executions_cron_job_id ON job_executions(cron_job_id);
CREATE INDEX idx_job_executions_status ON job_executions(status);
CREATE INDEX idx_job_executions_time ON job_executions(execution_time);

CREATE INDEX idx_alerts_cron_job_id ON alerts(cron_job_id);
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_time ON alerts(alert_time);

CREATE INDEX idx_notification_alert_id ON notification_history(alert_id);
CREATE INDEX idx_notification_system ON notification_history(monitoring_system);

-- 更新時間を自動で更新するトリガー
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_cron_jobs_timestamp
BEFORE UPDATE ON cron_jobs
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_alerts_timestamp
BEFORE UPDATE ON alerts
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- Ensure updated_at column is updated automatically
-- Removed redundant ALTER COLUMN statement for updated_at in alerts table

CREATE TRIGGER update_mail_patterns_timestamp
BEFORE UPDATE ON mail_patterns
FOR EACH ROW EXECUTE FUNCTION update_timestamp();
