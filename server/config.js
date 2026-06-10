const fs = require('fs')
const path = require('path')

const CONFIG_PATH = path.join(__dirname, '../emma-config.json')

const DEFAULT_CONFIG = {
  user: {
    name: 'Emma',
    email: '',
    phone: '',
    title: 'Omnichannel & Digital Project Manager',
    cv: '',
    defaultMessage: `Bonjour,

Votre offre a retenu toute mon attention et je pense correspondre au profil que vous recherchez.

Forte d'une expérience en gestion de projets digitaux, marketing omnicanal et e-commerce, j'ai eu l'occasion de piloter des initiatives à fort impact sur la conversion, le trafic et la satisfaction client. Je suis attachée à des approches orientées données et à une coordination efficace entre les équipes métiers, techniques et créatives.

Je vous adresse mon CV en pièces jointes et reste disponible pour échanger à votre convenance.

Cordialement,
Emma`,
  },
  filters: {
    salaryMin: 45000,
    locations: ['Grenoble', 'Isère', 'Rhône-Alpes', 'Auvergne-Rhône-Alpes'],
    remoteAllowed: true,
  }
}

function getConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const saved = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))
      return { ...DEFAULT_CONFIG, ...saved, user: { ...DEFAULT_CONFIG.user, ...saved.user }, filters: { ...DEFAULT_CONFIG.filters, ...saved.filters } }
    } catch {}
  }
  return DEFAULT_CONFIG
}

function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2))
}

module.exports = { getConfig, saveConfig, DEFAULT_CONFIG }
