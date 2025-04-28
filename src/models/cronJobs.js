const { db } = require('../../config/database');
const logger = require('../utils/logger');

class cronJob {
  // 全てのアクティブなクロンジョブを取得
  static async getAllActive() {
    try {
      const jobs = await db.any(`
        SELECT * FROM cron_jobs 
        WHERE active = TRUE 
        ORDER BY id
      `);
      return jobs;
    } catch (error) {
      logger.error('アクティブなクロンジョブの取得に失敗しました:', error);
      throw error;
    }
  }

  // クロンジョブをIDで取得
  static async getById(id) {
    try {
      const job = await db.oneOrNone('SELECT * FROM cron_jobs WHERE id = $1', [id]);
      return job;
    } catch (error) {
      logger.error(`ID: ${id} のクロンジョブ取得に失敗しました:`, error);
      throw error;
    }
  }

  // 新しいクロンジョブの作成
  static async create(jobData) {
    try {
      const newJob = await db.one(`
        INSERT INTO cron_jobs
        (name, description, expected_schedule, expected_subject_pattern, 
         expected_content_pattern, tolerance_minutes, active)
        VALUES
        ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [
        jobData.name,
        jobData.description || '',
        jobData.expected_schedule,
        jobData.expected_subject_pattern || null,
        jobData.expected_content_pattern || null,
        jobData.tolerance_minutes || 10,
        jobData.active !== undefined ? jobData.active : true
      ]);
      
      logger.info(`新しいクロンジョブ「${newJob.name}」を作成しました。ID: ${newJob.id}`);
      return newJob;
    } catch (error) {
      logger.error('クロンジョブの作成に失敗しました:', error);
      throw error;
    }
  }

  // クロンジョブの更新
  static async update(id, jobData) {
    try {
      const updatedJob = await db.oneOrNone(`
        UPDATE cron_jobs
        SET name = $1,
            description = $2,
            expected_schedule = $3,
            expected_subject_pattern = $4,
            expected_content_pattern = $5,
            tolerance_minutes = $6,
            active = $7,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $8
        RETURNING *
      `, [
        jobData.name,
        jobData.description || '',
        jobData.expected_schedule,
        jobData.expected_subject_pattern || null,
        jobData.expected_content_pattern || null,
        jobData.tolerance_minutes || 10,
        jobData.active !== undefined ? jobData.active : true,
        id
      ]);
      
      if (!updatedJob) {
        logger.warn(`ID: ${id} のクロンジョブが見つかりません。`);
        return null;
      }
      
      logger.info(`ID: ${id} のクロンジョブを更新しました。`);
      return updatedJob;
    } catch (error) {
      logger.error(`ID: ${id} のクロンジョブの更新に失敗しました:`, error);
      throw error;
    }
  }

  // クロンジョブの削除
  static async delete(id) {
    try {
      const result = await db.result('DELETE FROM cron_jobs WHERE id = $1', [id]);
      
      if (result.rowCount === 0) {
        logger.warn(`ID: ${id} のクロンジョブが見つかりません。`);
        return false;
      }
      
      logger.info(`ID: ${id} のクロンジョブを削除しました。`);
      return true;
    } catch (error) {
      logger.error(`ID: ${id} のクロンジョブの削除に失敗しました:`, error);
      throw error;
    }
  }

  // クロンジョブのアクティブ状態を切り替え
  static async toggleActive(id, active) {
    try {
      const updatedJob = await db.oneOrNone(`
        UPDATE cron_jobs
        SET active = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `, [active, id]);
      
      if (!updatedJob) {
        logger.warn(`ID: ${id} のクロンジョブが見つかりません。`);
        return null;
      }
      
      logger.info(`ID: ${id} のクロンジョブのアクティブ状態を ${active} に変更しました。`);
      return updatedJob;
    } catch (error) {
      logger.error(`ID: ${id} のクロンジョブのアクティブ状態変更に失敗しました:`, error);
      throw error;
    }
  }

  // クロンジョブの実行結果を記録
  static async recordExecution(jobId, data) {
    try {
      const execution = await db.one(`
        INSERT INTO job_executions
        (cron_job_id, execution_time, status, extracted_data, execution_duration, message_id, notes)
        VALUES
        ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [
        jobId,
        data.execution_time || new Date(),
        data.status,
        data.extracted_data || {},
        data.execution_duration || null,
        data.message_id || null,
        data.notes || null
      ]);
      
      logger.info(`クロンジョブ ID: ${jobId} の実行結果を記録しました。ステータス: ${data.status}`);
      return execution;
    } catch (error) {
      logger.error(`クロンジョブ ID: ${jobId} の実行結果記録に失敗しました:`, error);
      throw error;
    }
  }

  // 最新の実行結果を取得
  static async getLatestExecution(jobId) {
    try {
      const execution = await db.oneOrNone(`
        SELECT * FROM job_executions
        WHERE cron_job_id = $1
        ORDER BY execution_time DESC
        LIMIT 1
      `, [jobId]);
      
      return execution;
    } catch (error) {
      logger.error(`クロンジョブ ID: ${jobId} の最新実行結果取得に失敗しました:`, error);
      throw error;
    }
  }

  // 特定期間の実行結果を取得
  static async getExecutionHistory(jobId, days = 7) {
    try {
      const history = await db.any(`
        SELECT * FROM job_executions
        WHERE cron_job_id = $1
        AND execution_time > NOW() - INTERVAL '${days} days'
        ORDER BY execution_time DESC
      `, [jobId]);
      
      return history;
    } catch (error) {
      logger.error(`クロンジョブ ID: ${jobId} の実行履歴取得に失敗しました:`, error);
      throw error;
    }
  }

  // クロンジョブのパターン設定を取得
  static async getMailPatterns(jobId) {
    try {
      const patterns = await db.any(`
        SELECT * FROM mail_patterns
        WHERE cron_job_id = $1
        ORDER BY priority DESC
      `, [jobId]);
      
      return patterns;
    } catch (error) {
      logger.error(`クロンジョブ ID: ${jobId} のメールパターン取得に失敗しました:`, error);
      throw error;
    }
  }

  // パターン設定の追加
  static async addMailPattern(jobId, patternData) {
    try {
      const pattern = await db.one(`
        INSERT INTO mail_patterns
        (cron_job_id, pattern_name, pattern_type, pattern_value, target_field, extraction_name, priority)
        VALUES
        ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [
        jobId,
        patternData.pattern_name,
        patternData.pattern_type,
        patternData.pattern_value,
        patternData.target_field,
        patternData.extraction_name || null,
        patternData.priority || 0
      ]);
      
      logger.info(`クロンジョブ ID: ${jobId} に新しいメールパターンを追加しました。パターン名: ${patternData.pattern_name}`);
      return pattern;
    } catch (error) {
      logger.error(`クロンジョブ ID: ${jobId} へのメールパターン追加に失敗しました:`, error);
      throw error;
    }
  }
}

module.exports = cronJob;
