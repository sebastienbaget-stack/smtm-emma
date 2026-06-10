const express = require('express')
const router = express.Router()
const { runAllScrapers } = require('../scrapers/runner')

let scraping = false

// SSE endpoint pour le progress en temps réel
router.post('/start', async (req, res) => {
  if (scraping) return res.status(409).json({ error: 'Scraping déjà en cours' })

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  scraping = true
  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`)

  try {
    const results = await runAllScrapers((progress) => {
      send({ type: 'progress', ...progress })
    })
    send({ type: 'done', ...results })
  } catch (err) {
    send({ type: 'error', error: err.message })
  } finally {
    scraping = false
    res.end()
  }
})

router.get('/status', (req, res) => {
  res.json({ scraping })
})

module.exports = router
