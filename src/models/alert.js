const { db } = require('../../config/database');
const logger = require('../utils/logger');

class Alert {
  // 新しいアラートを作成
  static async create(alertData) {
    try {
      const newAlert = await db.one(`
        INSERT INTO alerts
        (cron_job_id, alert_time, severity, message, status)
        VALUES
        ($1, $2, $3, $4, $5)
        RETURNING *
      `, [
        alertData.cron_job_id,
        alertData.alert_time || new Date(),
        alertData.severity || 'warning',
        alertData.message,
        alertData.status || 'open'
      ]);
      
      logger.info(`クロンジョブ ID: ${alertData.cron_job_id} の新しいアラートを作成しました。ID: ${newAlert.id}`);
      return newAlert;
    } catch (error) {
      logger.error('アラートの作成に失敗しました:', error);
      throw error;
    }
  }

  // アラートの状態を更新
  static async updateStatus(id, status, notes = null, resolvedBy = null) {
    try {
      let query = `
        UPDATE alerts
        SET status = $1,
            updated_at = CURRENT_TIMESTAMP
      `;
      
      const params = [status];
      
      if (notes) {
        query += `, notes = $${params.length + 1}`;
        params.push(notes);
      }
      
      if (status === 'resolved') {
        query += `, resolved_at = CURRENT_TIMESTAMP`;
        
        if (resolvedBy) {
          query += `, resolved_by = $${params.length + 1}`;
          params.push(resolvedBy);
        }
      }
      
      query += ` WHERE id = $${params.length + 1} RETURNING *`;
      params.push(id);
      
      const updatedAlert = await db.oneOrNone(query, params);
      
      if (!updatedAlert) {
        logger.warn(`ID: ${id} のアラートが見つかりません。`);
        return null;
      }
      
      logger.info(`ID: ${id} のアラートの状態を ${status} に更新しました。`);
      return updatedAlert;
    } catch (error) {
      logger.error(`ID: ${id} のアラート状態更新に失敗しました:`, error);
      throw error;
    }
  }

  // アラートの詳細を取得
  static async getById(id) {
    try {
      const alert = await db.oneOrNone(`
        SELECT a.*, c.name as cron_job_name
        FROM alerts a
        LEFT JOIN cron_jobs c ON a.cron_job_id = c.id
        WHERE a.id = $1
      `, [id]);
      
      return alert;
    } catch (error) {
      logger.error(`ID: ${id} のアラート取得に失敗しました:`, error);
      throw error;
    }
  }

  // アクティブなアラートを取得
  static async getActive(limit = 100, offset = 0) {
    try {
      const alerts = await db.any(`
        SELECT a.*, c.name as cron_job_name
        FROM alerts a
        LEFT JOIN cron_jobs c ON a.cron_job_id = c.id
        WHERE a.status IN ('open', 'acknowledged')
        ORDER BY a.alert_time DESC
        LIMIT $1 OFFSET $2
      `, [limit, offset]);
      
      return alerts;
    } catch (error) {
      logger.error('アクティブなアラートの取得に失敗しました:', error);
      throw error;
    }
  }

  // クロンジョブのアクティブなアラートを取得
  static async getActiveByJobId(jobId) {
    try {
      const alerts = await db.any(`
        SELECT * FROM alerts
        WHERE cron_job_id = $1
        AND status IN ('open', 'acknowledged')
        ORDER BY alert_time DESC
      `, [jobId]);
      
      return alerts;
    } catch (error) {
      logger.error(`クロンジョブ ID: ${jobId} のアクティブなアラート取得に失敗しました:`, error);
      throw error;
    }
  }

  // 監視システムへの通知を記録
  static async recordNotification(notificationData) {
    try {
      const notification = await db.one(`
        INSERT INTO notification_history
        (alert_id, notification_time, monitoring_system, endpoint, payload, response_code, response_body, status, notes)
        VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [
        notificationData.alert_id,
        notificationData.notification_time || new Date(),
        notificationData.monitoring_system,
        notificationData.endpoint,
        notificationData.payload || {},
        notificationData.response_code,
        notificationData.response_body || null,
        notificationData.status,
        notificationData.notes || null
      ]);
      
      logger.info(`アラート ID: ${notificationData.alert_id} の ${notificationData.monitoring_system} 通知を記録しました。`);
      return notification;
    } catch (error) {
      logger.error(`アラート ID: ${notificationData.alert_id} の通知記録に失敗しました:`, error);
      throw error;
    }
  }

  // アラートの通知履歴を取得
  static async getNotificationHistory(alertId) {
    try {
      const history = await db.any(`
        SELECT * FROM notification_history
        WHERE alert_id = $1
        ORDER BY notification_time DESC
      `, [alertId]);
      
      return history;
    } catch (error) {
      logger.error(`アラート ID: ${alertId} の通知履歴取得に失敗しました:`, error);
      throw error;
    }
  }

  // アラート統計情報を取得（最近のN日間）
  static async getStats(days = 7) {
    try {
      const stats = await db.one(`
        SELECT
          COUNT(*) AS total_alerts,
          COUNT(*) FILTER (WHERE status = 'open') AS open_alerts,
          COUNT(*) FILTER (WHERE status = 'acknowledged') AS acknowledged_alerts,
          COUNT(*) FILTER (WHERE status = 'resolved') AS resolved_alerts,
          COUNT(*) FILTER (WHERE severity = 'info') AS info_alerts,
          COUNT(*) FILTER (WHERE severity = 'warning') AS warning_alerts,
          COUNT(*) FILTER (WHERE severity = 'critical') AS critical_alerts,
          COUNT(*) FILTER (WHERE severity = 'error') AS error_alerts,
          AVG(EXTRACT(EPOCH FROM (resolved_at - alert_time))) FILTER (WHERE resolved_at IS NOT NULL) AS avg_resolution_time_seconds
        FROM alerts
        WHERE alert_time > NOW() - INTERVAL '${days} days'
      `);
      
      return stats;
    } catch (error) {
      logger.error('アラート統計情報の取得に失敗しました:', error);
      throw error;
    }
  }
}

module.exports = Alert;

