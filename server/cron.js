const cron = require('node-cron')
const { runAllScrapers } = require('./scrapers/runner')
const { notify } = require('./push')

// Scraping auto toutes les 4h (8h, 12h, 16h, 20h)
const SCHEDULE = '0 8,12,16,20 * * *'

function start() {
  cron.schedule(SCHEDULE, async () => {
    console.log('[cron] Scraping automatique démarré…')
    try {
      const results = await runAllScrapers()
      console.log(`[cron] Terminé : ${results.new} nouvelles offres`)

      if (results.new > 0) {
        await notify({
          title: `SMTM — ${results.new} nouvelle${results.new > 1 ? 's' : ''} offre${results.new > 1 ? 's' : ''}`,
          body: `${results.new} offre${results.new > 1 ? 's correspondent' : ' correspond'} à ton profil. Tape pour voir.`,
          url: '/',
        })
      }
    } catch (err) {
      console.error('[cron] Erreur:', err.message)
    }
  }, { timezone: 'Europe/Paris' })

  console.log(`[cron] Scraping automatique programmé (${SCHEDULE}, Europe/Paris)`)
}

module.exports = { start }
