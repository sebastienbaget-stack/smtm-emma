const express = require('express')
const router = express.Router()
const { getConfig } = require('../config')

// Génère une lettre de motivation CDI personnalisée pour une offre
router.post('/generate', (req, res) => {
  try {
    const { job } = req.body
    if (!job) return res.status(400).json({ error: 'job manquant' })

    const config = getConfig()
    const { user } = config

    const letter = generateLetter(user, job)
    res.json({ letter })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/config', (req, res) => {
  const config = getConfig()
  res.json(config)
})

router.post('/config', (req, res) => {
  try {
    const { saveConfig } = require('../config')
    saveConfig(req.body)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

function generateLetter(user, job) {
  const title = job.title || 'ce poste'
  const company = job.company || 'votre entreprise'

  return `${user.name ? `Objet : Candidature ${title} — ${user.name}\n\n` : ''}Bonjour,

Votre offre pour le poste de ${title} chez ${company} a retenu toute mon attention, et je me permets de vous adresser ma candidature.

${user.defaultMessage || `Forte d'une expérience en gestion de projets digitaux, marketing omnicanal et e-commerce, j'ai piloté des initiatives à fort impact sur la conversion, le trafic et la satisfaction client. Je suis attachée à des approches orientées données et à une coordination efficace entre les équipes métiers, techniques et créatives.`}

Je reste disponible pour un échange à votre convenance.

Cordialement,
${user.name || 'Emma'}`
}

module.exports = router
