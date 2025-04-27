const Imap = require('imap');
const { simpleParser } = require('mailparser');
const logger = require('./logger');
const config = require('../../config/config');

class EmailFetcher {
  constructor(imapConfig = config.email.imap) {
    this.imapConfig = imapConfig;
    this.imap = null;
  }

  // IMAP接続の初期化
  connect() {
    return new Promise((resolve, reject) => {
      this.imap = new Imap(this.imapConfig);

      this.imap.once('ready', () => {
        logger.info('IMAP接続が準備完了しました');
        resolve(this.imap);
      });

      this.imap.once('error', (err) => {
        logger.error('IMAP接続エラー:', err);
        reject(err);
      });

      this.imap.once('end', () => {
        logger.info('IMAP接続が終了しました');
      });

      this.imap.connect();
    });
  }

  // 接続を閉じる
  disconnect() {
    if (this.imap && this.imap.state !== 'disconnected') {
      this.imap.end();
      logger.debug('IMAP接続を閉じました');
    }
  }

  // メールボックスを開く
  openMailbox(mailbox = config.email.mailbox, readonly = true) {
    return new Promise((resolve, reject) => {
      this.imap.openBox(mailbox, readonly, (err, box) => {
        if (err) {
          logger.error(`メールボックス「${mailbox}」を開けませんでした:`, err);
          reject(err);
          return;
        }
        logger.debug(`メールボックス「${mailbox}」を開きました`);
        resolve(box);
      });
    });
  }

  // 特定の期間の未読メールを検索
  searchUnreadMailsSince(since = '1d') {
    return new Promise((resolve, reject) => {
      // 日付文字列を作成（例: '1d'は1日前、'4h'は4時間前）
      const sinceDate = this._parseDateString(since);
      
      const searchCriteria = [
        'UNSEEN',
        ['SINCE', sinceDate]
      ];

      this.imap.search(searchCriteria, (err, results) => {
        if (err) {
          logger.error('メール検索エラー:', err);
          reject(err);
          return;
        }
        
        logger.debug(`${results.length}件の未読メールが見つかりました`);
        resolve(results);
      });
    });
  }

  // 特定の件名を持つメールを検索
  searchMailsBySubject(subject, since = '1d') {
    return new Promise((resolve, reject) => {
      const sinceDate = this._parseDateString(since);
      
      const searchCriteria = [
        ['SUBJECT', subject],
        ['SINCE', sinceDate]
      ];

      this.imap.search(searchCriteria, (err, results) => {
        if (err) {
          logger.error('メール検索エラー:', err);
          reject(err);
          return;
        }
        
        logger.debug(`件名「${subject}」で${results.length}件のメールが見つかりました`);
        resolve(results);
      });
    });
  }

  // メールの詳細を取得
  fetchMails(uids) {
    return new Promise((resolve, reject) => {
      if (!uids || uids.length === 0) {
        resolve([]);
        return;
      }

      const messages = [];
      const fetch = this.imap.fetch(uids, { 
        bodies: '',
        markSeen: false // メールを既読にしない
      });

      fetch.on('message', (msg, seqno) => {
        logger.debug(`メッセージ #${seqno} の処理を開始`);
        const message = {};

        msg.on('body', (stream, info) => {
          let buffer = '';
          
          stream.on('data', (chunk) => {
            buffer += chunk.toString('utf8');
          });

          stream.once('end', () => {
            // mailparserでメールを解析
            simpleParser(buffer)
              .then((parsed) => {
                Object.assign(message, parsed);
              })
              .catch(err => {
                logger.error('メール解析エラー:', err);
              });
          });
        });

        msg.once('attributes', (attrs) => {
          message.attributes = attrs;
        });

        msg.once('end', () => {
          logger.debug(`メッセージ #${seqno} の処理が完了`);
          messages.push(message);
        });
      });

      fetch.once('error', (err) => {
        logger.error('メール取得エラー:', err);
        reject(err);
      });

      fetch.once('end', () => {
        logger.debug('全てのメッセージの取得が完了しました');
        resolve(messages);
      });
    });
  }

  // 日付文字列をパース（例: '1d'は1日前）
  _parseDateString(dateStr) {
    const now = new Date();
    const unit = dateStr.slice(-1);
    const value = parseInt(dateStr.slice(0, -1), 10);
    
    switch (unit) {
      case 'd': // 日
        now.setDate(now.getDate() - value);
        break;
      case 'h': // 時間
        now.setHours(now.getHours() - value);
        break;
      case 'm': // 分
        now.setMinutes(now.getMinutes() - value);
        break;
      default:
        // デフォルトは1日前
        now.setDate(now.getDate() - 1);
    }
    
    return now;
  }

  // 特定のパターンに一致するメールを検索して解析
  async findAndParseMails(subjectPattern, sinceTime = '1d') {
    let imap;
    try {
      imap = await this.connect();
      await this.openMailbox();
      
      // 正規表現で検索する場合
      if (subjectPattern.startsWith('/') && subjectPattern.endsWith('/')) {
        const regex = new RegExp(subjectPattern.slice(1, -1));
        // まずは全てのメールを取得してからフィルタリング
        const allUids = await this.searchMailsSince(sinceTime);
        const allMails = await this.fetchMails(allUids);
        
        // 件名でフィルタリング
        return allMails.filter(mail => regex.test(mail.subject));
      } else {
        // 通常の文字列検索
        const uids = await this.searchMailsBySubject(subjectPattern, sinceTime);
        return await this.fetchMails(uids);
      }
    } catch (error) {
      logger.error('メール検索・解析中にエラーが発生しました:', error);
      throw error;
    } finally {
      this.disconnect();
    }
  }
}

module.exports = new EmailFetcher();

