const nodemailer = require('nodemailer');
const logger = require('../utils/logger');
const config = require('../../config/config');

class AlertNotifier {
  constructor() {
    // メール送信設定
    this.transporter = nodemailer.createTransport({
      host: config.mail.host,
      port: config.mail.port,
      secure: config.mail.secure, // true for 465, false for other ports
      auth: {
        user: config.mail.user,
        pass: config.mail.password,
      },
    });
  }

  /**
   * アラートを通知する
   * @param {Object} alert - アラートオブジェクト
   * @param {string} alert.job_id - ジョブID
   * @param {string} alert.message - アラートメッセージ
   * @param {string} alert.severity - アラートの重要度 (例: 'low', 'medium', 'high')
   * @param {Date} alert.timestamp - アラート発生時刻
   */
  async notify(alert) {
    try {
      logger.info(`アラート通知を送信中: ${alert.message}`);

      // メールの内容を構築
      const mailOptions = {
        from: config.mail.from, // 送信元アドレス
        to: config.mail.recipients.join(','), // 受信者リスト
        subject: `【${alert.severity.toUpperCase()}】クロンジョブアラート: ${alert.job_id}`,
        text: `ジョブID: ${alert.job_id}\n\nメッセージ: ${alert.message}\n\n発生時刻: ${alert.timestamp}`,
      };

      // メールを送信
      await this.transporter.sendMail(mailOptions);

      logger.info('アラート通知を送信しました');
    } catch (error) {
      logger.error('アラート通知の送信中にエラーが発生しました:', error);
    }
  }
}

module.exports = new AlertNotifier();