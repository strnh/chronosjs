const emailFetcher = require('../utils/emailFetcher');
const CronJob = require('../models/cronJobs');
const logger = require('../utils/logger');

class MailParser {
  // 特定のクロンジョブのメールを解析して結果を抽出
  async parseMailsForJob(job) {
    try {
      logger.info(`クロンジョブ「${job.name}」のメール解析を開始します`);
      
      // メールパターンを取得
      const patterns = await CronJob.getMailPatterns(job.id);
      if (!patterns || patterns.length === 0) {
        logger.warn(`クロンジョブ ID: ${job.id} にメールパターンが設定されていません`);
        return null;
      }
      
      // 件名パターンでメールを検索（最近24時間のメール）
      let mails = [];
      try {
        mails = await emailFetcher.findAndParseMails(job.expected_subject_pattern, '24h');
      } catch (error) {
        logger.error(`メール検索中にエラーが発生しました:`, error);
        return null;
      }
      
      if (mails.length === 0) {
        logger.info(`クロンジョブ「${job.name}」に一致するメールは見つかりませんでした`);
        return null;
      }
      
      logger.info(`クロンジョブ「${job.name}」に一致するメールが ${mails.length} 件見つかりました`);
      
      // 最新のメールを処理
      const latestMail = mails[0];
      const extractedData = await this._extractDataFromMail(latestMail, patterns);
      
      // 特定の条件で成功または失敗を判断（ここではサンプル実装）
      const hasRequiredData = this._validateExtractedData(extractedData, patterns);
      const status = hasRequiredData ? 'success' : 'partial';
      
      const result = {
        mail: latestMail,
        extracted_data: extractedData,
        status: status,
        message_id: latestMail.messageId
      };
      
      return result;
    } catch (error) {
      logger.error(`メール解析中にエラーが発生しました:`, error);
      return {
        status: 'failure',
        error: error.message
      };
    }
  }
  
  // メールからデータを抽出するプライベートメソッド
  async _extractDataFromMail(mail, patterns) {
    const extractedData = {};
    
    for (const pattern of patterns) {
      let content;
      
      // 対象フィールドの選択
      switch (pattern.target_field) {
        case 'subject':
          content = mail.subject;
          break;
        case 'body':
          content = mail.text || mail.html;
          break;
        case 'from':
          content = mail.from?.text;
          break;
        case 'to':
          content = mail.to?.text;
          break;
        case 'headers':
          content = JSON.stringify(mail.headers);
          break;
        default:
          content = mail.text || mail.html;
      }
      
      if (!content) continue;
      
      // パターンタイプに応じた抽出
      try {
        switch (pattern.pattern_type) {
          case 'regex': {
            const regex = new RegExp(pattern.pattern_value);
            const match = content.match(regex);
            if (match && match.length > 0) {
              // キャプチャグループがある場合は最初のキャプチャグループを使用
              extractedData[pattern.extraction_name] = match[1] || match[0];
            }
            break;
          }
          case 'keyword': {
            // キーワードが含まれているかどうか
            const included = content.includes(pattern.pattern_value);
            extractedData[pattern.extraction_name] = included;
            break;
          }
          case 'json_path': {
            // JSONパスを使用してJSONから値を抽出（簡易実装）
            if (mail.html) {
              try {
                // JSON部分を探す（例: <pre>{...}</pre>タグ内）
                const jsonMatch = mail.html.match(/<pre>([\s\S]*?)<\/pre>/);
                if (jsonMatch && jsonMatch[1]) {
                  const jsonContent = JSON.parse(jsonMatch[1]);
                  const paths = pattern.pattern_value.split('.');
                  let value = jsonContent;
                  for (const path of paths) {
                    value = value[path];
                    if (value === undefined) break;
                  }
                  if (value !== undefined) {
                    extractedData[pattern.extraction_name] = value;
                  }
                }
              } catch (e) {
                logger.debug(`JSON解析エラー: ${e.message}`);
              }
            }
            break;
          }
          default:
            logger.warn(`未対応のパターンタイプ: ${pattern.pattern_type}`);
        }
      } catch (error) {
        logger.error(`パターン「${pattern.pattern_name}」の処理中にエラーが発生しました:`, error);
      }
    }
    
    return extractedData;
  }
  
  // 抽出データのバリデーション
  _validateExtractedData(data, patterns) {
    // 必須の抽出項目が全て取得できたかチェック
    const requiredPatterns = patterns.filter(p => p.required);
    if (requiredPatterns.length === 0) return true;
    
    for (const pattern of requiredPatterns) {
      if (data[pattern.extraction_name] === undefined) {
        return false;
      }
    }
    
    return true;
  }
  
  // メール本文から実行時間を抽出（例：「処理時間: 123秒」）
  _extractExecutionDuration(text) {
    if (!text) return null;
    
    const durationMatches = [
      text.match(/処理時間[：:]\s*(\d+)秒/),
      text.match(/実行時間[：:]\s*(\d+)秒/),
      text.match(/所要時間[：:]\s*(\d+)秒/),
      text.match(/Execution time[：:]\s*(\d+)/i),
      text.match(/Processing time[：:]\s*(\d+)/i)
    ];
    
    for (const match of durationMatches) {
      if (match && match[1]) {
        return parseInt(match[1], 10);
      }
    }
    
    return null;
  }
}

module.exports = new MailParser();

