// RegionsJob — DOM scraping
async function scrape(context) {
  const page = await context.newPage()
  const jobs = []

  const urls = [
    'https://www.regionsjob.com/offres-emploi/chef-de-projet-digital-grenoble.html',
    'https://www.regionsjob.com/offres-emploi/marketing-manager-grenoble.html',
    'https://www.regionsjob.com/offres-emploi/omnicanal-auvergne-rhone-alpes.html',
  ]

  for (const url of urls) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 18000 })
      await page.waitForTimeout(1500)

      const found = await page.evaluate(() => {
        const results = []
        const cards = document.querySelectorAll('.job-item, [class*="offer"], article')
        cards.forEach(card => {
          const titleEl = card.querySelector('h2 a, h3 a, .title a, [class*="title"] a')
          const companyEl = card.querySelector('[class*="company"], [class*="employer"]')
          const locationEl = card.querySelector('[class*="location"], [class*="city"]')
          const salaryEl = card.querySelector('[class*="salary"]')
          const dateEl = card.querySelector('[class*="date"], time')
          if (!titleEl) return
          const href = titleEl.href || ''
          if (!href) return
          const loc = locationEl?.textContent?.trim() || ''
          const isRemote = loc.toLowerCase().includes('télétravail') || loc.toLowerCase().includes('remote')
          results.push({
            title: titleEl.textContent.trim(),
            company: companyEl?.textContent?.trim() || '',
            location: loc,
            salary: salaryEl?.textContent?.trim() || '',
            description: '',
            url: href.startsWith('http') ? href : `https://www.regionsjob.com${href}`,
            remote: isRemote ? 1 : 0,
            posted_at: dateEl?.textContent?.trim() || '',
            contract_type: 'CDI',
          })
        })
        return results
      })
      jobs.push(...found.filter(j => j.title && j.url))
    } catch (err) {
      console.error('[regionsjob]', err.message)
    }
  }

  await page.close()
  return dedupe(jobs)
}

function dedupe(jobs) {
  const seen = new Set()
  return jobs.filter(j => j.url && j.title && !seen.has(j.url) && seen.add(j.url))
}

module.exports = { scrape }
