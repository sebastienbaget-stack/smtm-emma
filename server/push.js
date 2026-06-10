const webpush = require('web-push')
const fs = require('fs')
const path = require('path')

const KEYS_PATH = path.join(__dirname, '../push-keys.json')
const SUBS_PATH = path.join(__dirname, '../push-subscriptions.json')

function getKeys() {
  if (fs.existsSync(KEYS_PATH)) {
    return JSON.parse(fs.readFileSync(KEYS_PATH, 'utf8'))
  }
  const keys = webpush.generateVAPIDKeys()
  fs.writeFileSync(KEYS_PATH, JSON.stringify(keys, null, 2))
  console.log('[push] Clés VAPID générées')
  return keys
}

const KEYS = getKeys()

webpush.setVapidDetails(
  'mailto:emma@smtm.app',
  KEYS.publicKey,
  KEYS.privateKey
)

function getPublicKey() {
  return KEYS.publicKey
}

function loadSubs() {
  if (fs.existsSync(SUBS_PATH)) {
    try { return JSON.parse(fs.readFileSync(SUBS_PATH, 'utf8')) } catch {}
  }
  return []
}

function saveSubs(subs) {
  fs.writeFileSync(SUBS_PATH, JSON.stringify(subs, null, 2))
}

function subscribe(subscription) {
  const subs = loadSubs()
  const exists = subs.find(s => s.endpoint === subscription.endpoint)
  if (!exists) {
    subs.push(subscription)
    saveSubs(subs)
    console.log('[push] Nouvel abonnement enregistré')
  }
  return true
}

function unsubscribe(endpoint) {
  const subs = loadSubs().filter(s => s.endpoint !== endpoint)
  saveSubs(subs)
}

async function notify(payload) {
  const subs = loadSubs()
  if (subs.length === 0) return
  const data = JSON.stringify(payload)
  const dead = []
  await Promise.all(subs.map(async sub => {
    try {
      await webpush.sendNotification(sub, data)
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        dead.push(sub.endpoint)
      } else {
        console.error('[push] Erreur envoi:', err.message)
      }
    }
  }))
  if (dead.length > 0) {
    saveSubs(loadSubs().filter(s => !dead.includes(s.endpoint)))
  }
}

module.exports = { getPublicKey, subscribe, unsubscribe, notify }
