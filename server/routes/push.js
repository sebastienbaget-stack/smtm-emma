const express = require('express')
const router = express.Router()
const push = require('../push')

router.get('/vapid-key', (req, res) => {
  res.json({ publicKey: push.getPublicKey() })
})

router.post('/subscribe', (req, res) => {
  const { subscription } = req.body
  if (!subscription?.endpoint) return res.status(400).json({ error: 'subscription manquante' })
  push.subscribe(subscription)
  res.json({ ok: true })
})

router.post('/unsubscribe', (req, res) => {
  const { endpoint } = req.body
  if (endpoint) push.unsubscribe(endpoint)
  res.json({ ok: true })
})

// Test manuel (dev only)
router.post('/test', async (req, res) => {
  try {
    await push.notify({
      title: 'SMTM — Test 🐺',
      body: 'Les notifications fonctionnent !',
      url: '/',
    })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
