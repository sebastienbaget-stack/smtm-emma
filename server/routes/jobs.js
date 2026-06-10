const express = require('express')
const router = express.Router()
const { getJobs, updateJobStatus, getStats } = require('../db/database')

router.get('/', (req, res) => {
  try {
    const filters = {
      status: req.query.status || '',
      remote: req.query.remote,
      source: req.query.source || '',
      search: req.query.search || '',
      dateFrom: req.query.dateFrom || '',
      jobOnly: req.query.jobOnly !== 'false',
    }
    const jobs = getJobs(filters)
    res.json(jobs)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/stats', (req, res) => {
  try {
    res.json(getStats())
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.patch('/:id/status', (req, res) => {
  try {
    const { status } = req.body
    const validStatuses = ['new', 'seen', 'interested', 'applied', 'rejected']
    if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Statut invalide' })
    updateJobStatus(Number(req.params.id), status)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
