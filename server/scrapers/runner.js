const { chromium } = require('playwright-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
chromium.use(StealthPlugin())

const { SOURCES } = require('./sources')
const { upsertJob } = require('../db/database')

const scrapers = {
  remotive:       require('./impl/remotive'),
  weworkremotely: require('./impl/weworkremotely'),
  jobgether:      require('./impl/jobgether'),
  himalayas:      require('./impl/himalayas'),
  euremotejobs:   require('./impl/euremotejobs'),
  linkedin:       require('./impl/linkedin'),
  wttj:         require('./impl/wttj'),
  indeed:       require('./impl/indeed'),
  apec:         require('./impl/apec'),
  cadremploi:   require('./impl/cadremploi'),
  cadresonline: require('./impl/cadresonline'),
  hellowork:    require('./impl/hellowork'),
  monster:      require('./impl/monster'),
  jobteaser:    require('./impl/jobteaser'),
  figaro:       require('./impl/figaro'),
  francetravail:require('./impl/francetravail'),
  meteojob:     require('./impl/meteojob'),
  jooble:       require('./impl/jooble'),
  talentio:     require('./impl/talentio'),
  freework:     require('./impl/freework'),
  collective:   require('./impl/collective'),
  regionsjob:   require('./impl/regionsjob'),
}

const SCRAPER_TIMEOUT_MS = 30000

async function runWithTimeout(fn, ms) {
  return Promise.race([
    fn(),
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout ${ms / 1000}s`)), ms))
  ])
}

async function runAllScrapers(onProgress) {
  let browser
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    })

    const results = { total: 0, new: 0, errors: [] }
    const activeSources = SOURCES.filter(s => scrapers[s.id])

    const CONCURRENCY = 3
    for (let i = 0; i < activeSources.length; i += CONCURRENCY) {
      const chunk = activeSources.slice(i, i + CONCURRENCY)
      await Promise.all(chunk.map(async (source) => {
        const context = await browser.newContext({
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          locale: 'fr-FR',
          timezoneId: 'Europe/Paris',
          extraHTTPHeaders: { 'Accept-Language': 'fr-FR,fr;q=0.9' }
        })
        try {
          onProgress?.({ source: source.name, status: 'running' })
          // Certains scrapers (remotive, himalayas) n'utilisent pas Playwright
          const scraper = scrapers[source.id]
          const jobs = await runWithTimeout(
            () => scraper.noBrowser ? scraper.scrape() : scraper.scrape(context),
            SCRAPER_TIMEOUT_MS
          )
          let newCount = 0
          for (const job of (jobs || [])) {
            if (!job.title || !job.url) continue
            const isNew = upsertJob({ ...job, source: source.id, source_priority: source.priority })
            if (isNew) newCount++
          }
          results.total += (jobs || []).length
          results.new += newCount
          console.log(`[${source.id}] ✓ ${(jobs || []).length} offres, ${newCount} nouvelles`)
          onProgress?.({ source: source.name, status: 'done', found: (jobs || []).length, new: newCount })
        } catch (err) {
          console.error(`[${source.id}] ✗ ${err.message}`)
          results.errors.push({ source: source.id, error: err.message })
          onProgress?.({ source: source.name, status: 'error', error: err.message })
        } finally {
          await context.close().catch(() => {})
        }
      }))
    }

    console.log(`\n✓ Scraping terminé: ${results.total} offres, ${results.new} nouvelles, ${results.errors.length} erreurs`)
    return results
  } finally {
    await browser?.close().catch(() => {})
  }
}

module.exports = { runAllScrapers }
