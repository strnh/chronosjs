const express = require('express');
const router = express.Router();
const cronChecker = require('../services/cronChecker');
const alertNotifier = require('../services/alertNotifier');

// クロンジョブの一覧を取得
router.get('/jobs', async (req, res) => {
  try {
    const jobs = await cronChecker.getAllJobs();
    res.json({ status: 'success', data: jobs });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 特定のクロンジョブをチェック
router.post('/jobs/:id/check', async (req, res) => {
  try {
    const jobId = req.params.id;
    const result = await cronChecker.checkJobById(jobId);
    res.json({ status: 'success', data: result });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// アラートを送信
router.post('/alerts', async (req, res) => {
  try {
    const alert = req.body;
    await alertNotifier.notify(alert);
    res.json({ status: 'success', message: 'アラートが送信されました' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

module.exports = router;
