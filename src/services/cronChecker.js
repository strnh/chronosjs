const nodeCron = require('node-cron');
const CronJob = require('../models/cronJobs');
const Alert = require('../models/alert');
const mailParser = require('./mailParser');
const alertNotifier = require('./alertNotifier');
const logger = require('../utils/logger');
const config = require('../../config/config');

class CronChecker {
  constructor() {
    // スケジュールされたタスクを保持
    this.scheduledTasks = new Map();
  }

  // 全てのアクティブなクロンジョブのチェック開始
  async startAll() {
    try {
      // 既存のタスクをクリア
      this.stopAll();
      
      // アクティブなクロンジョブを取得
      const jobs = await CronJob.getAllActive();
      logger.info(`${jobs.length}件のアクティブなクロンジョブを検出しました`);
      
      // 各ジョブをスケジュール
      for (const job of jobs) {
        this.scheduleJobCheck(job);
      }
      
      // 全てのクロンジョブの定期チェックをスケジュール（例：1時間ごと）
      this.schedulePeriodicCheck();
      
      return true;
    } catch (error) {
      logger.error('クロンジョブのチェック開始に失敗しました:', error);
      return false;
    }
  }

  // 個別のクロンジョブのチェックをスケジュール
  scheduleJobCheck(job) {
    // クロンスケジュールの解析と検証
    try {
      // クロン形式の検証
      if (!this._validateCronExpression(job.expected_schedule)) {
        logger.error(`クロンジョブ「${job.name}」のスケジュール形式が無効です: ${job.expected_schedule}`);
        return false;
      }
      
      // クロンの次回実行時間を計算
      const nextRuntime = this._calculateNextRuntime(job.expected_schedule);
      if (!nextRuntime) {
        logger.error(`クロンジョブ「${job.name}」の次回実行時間の計算に失敗しました`);
        return false;
      }
      
      // 監視スケジュールを設定（次回実行予定時間 + 許容時間）
      const checkTime = new Date(nextRuntime.getTime() + (job.tolerance_minutes * 60 * 1000));
      
      // 既存のタスクがあれば停止
      if (this.scheduledTasks.has(job.id)) {
        this.scheduledTasks.get(job.id).stop();
      }
      
      // スケジュールタスクを作成
      logger.info(`クロンジョブ「${job.name}」の次回チェック時間: ${checkTime.toLocaleString()}`);
      
      // 特定の時間にチェックするタスクを作成（ここではNode-cronを使用）
      const task = this._createScheduledTask(job, checkTime);
      this.scheduledTasks.set(job.id, task);
      
      return true;
    } catch (error) {
      logger.error(`クロンジョブ「${job.name}」のスケジュール設定中にエラーが発生しました:`, error);
      return false;
    }
  }

  // 定期的なチェックをスケジュール（例：1時間ごと）
  schedulePeriodicCheck() {
    const schedule = '0 * * * *'; // 毎時0分
    
    // 既存のタスクがあれば停止
    if (this.scheduledTasks.has('periodic')) {
      this.scheduledTasks.get('periodic').stop();
    }
    
    // 定期チェックタスクを作成
    const task = nodeCron.schedule(schedule, async () => {
      logger.info('全クロンジョブの定期チェックを実行します');
      await this.checkAllJobs();
    });
    
    this.scheduledTasks.set('periodic', task);
    logger.info('定期チェックをスケジュールしました');
  }

  // 全てのアクティブなクロンジョブのチェック
  async checkAllJobs() {
    try {
      const jobs = await CronJob.getAllActive();
      logger.info(`${jobs.length}件のアクティブなクロンジョブをチェックします`);
      
      for (const job of jobs) {
        await this.checkJob(job);
      }
      
      return true;
    } catch (error) {
      logger.error('クロンジョブのチェック中にエラーが発生しました:', error);
      return false;
    }
  }

  // 特定のクロンジョブをチェック
   // 特定のクロンジョブをチェック
   async checkJob(job) {
    try {
      logger.info(`クロンジョブ「${job.name}」をチェックします`);
      
      // 最新の実行結果を取得
      const latestExecution = await CronJob.getLatestExecution(job.id);

      if (!latestExecution) {
        logger.warn(`クロンジョブ「${job.name}」の最新実行結果が見つかりません`);
        return;
      }

      const expectedNextRun = this._calculateNextRuntime(job.expected_schedule);
      if (!expectedNextRun) {
        logger.error(`クロンジョブ「${job.name}」の次回実行時間を計算できません`);
        return;
      }

      const toleranceTime = new Date(expectedNextRun.getTime() + job.tolerance_minutes * 60 * 1000);

      if (latestExecution.end_time > toleranceTime) {
        logger.warn(`クロンジョブ「${job.name}」が許容時間を超えて実行されました`);

        // アラートを作成
        const alert = await Alert.create({
          job_id: job.id,
          message: `クロンジョブ「${job.name}」が許容時間を超えて実行されました`,
          severity: 'high',
          timestamp: new Date(),
        });

        // アラート通知を送信
        await alertNotifier.notify(alert);
      } else {
        logger.info(`クロンジョブ「${job.name}」は正常に実行されました`);
      }
    } catch (error) {
      logger.error(`クロンジョブ「${job.name}」のチェック中にエラーが発生しました:`, error);
    }
  }

  // クロン式の検証
  _validateCronExpression(expression) {
    try {
      return nodeCron.validate(expression);
    } catch (error) {
      logger.error(`クロン式の検証中にエラーが発生しました: ${expression}`, error);
      return false;
    }
  }

  // 次回実行時間を計算
  _calculateNextRuntime(expression) {
    try {
      const now = new Date();
      const nextDate = nodeCron.schedule(expression, () => {}).nextDates(1).toDate();
      return nextDate > now ? nextDate : null;
    } catch (error) {
      logger.error(`次回実行時間の計算中にエラーが発生しました: ${expression}`, error);
      return null;
    }
  }

  // スケジュールされたタスクを作成
  _createScheduledTask(job, checkTime) {
    return nodeCron.schedule(checkTime, async () => {
      logger.info(`クロンジョブ「${job.name}」のスケジュールされたチェックを実行します`);
      await this.checkJob(job);
    });
  }

  // 全てのスケジュールされたタスクを停止
  stopAll() {
    for (const [id, task] of this.scheduledTasks) {
      task.stop();
      this.scheduledTasks.delete(id);
    }
    logger.info('全てのスケジュールされたタスクを停止しました');
  }
}

module.exports = CronChecker;
