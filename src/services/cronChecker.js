const nodeCron = require('node-cron');
const cronParser = require('cron-parser'); // 追加
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

  // 指定されたジョブのチェックをスケジュール
  scheduleJobCheck(job) {
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
      const checkTime = new Date(nextRuntime.getTime() + job.tolerance_minutes * 60 * 1000);

      // 既存のタスクがあれば停止
      if (this.scheduledTasks.has(job.id)) {
        this.scheduledTasks.get(job.id).stop();
      }

      // スケジュールタスクを作成
      logger.info(`クロンジョブ「${job.name}」の次回チェック時間: ${checkTime.toLocaleString()}`);
      const task = this._createScheduledTask(job, checkTime);
      this.scheduledTasks.set(job.id, task);

      return true;
    } catch (error) {
      logger.error(`クロンジョブ「${job.name}」のスケジュール設定中にエラーが発生しました:`, error);
      return false;
    }
  }

  // 次回実行時間を計算
  _calculateNextRuntime(expression) {
    try {
      const interval = cronParser.parseExpression(expression);
      return interval.next().toDate();
    } catch (error) {
      logger.error(`次回実行時間の計算中にエラーが発生しました: ${expression}`, error);
      return null;
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
