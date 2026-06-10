// EuroRemoteJobs — agrégateur 100% remote Europe
async function scrape(context) {
  const page = await context.newPage()
  const jobs = []

  const EMMA_KW = [
    'omnichannel', 'ecommerce', 'marketing manager', 'digital project',
    'traffic manager', 'growth', 'conversion', 'digital manager',
  ]

  const urls = [
    'https://euromotejobs.com/jobs?category=marketing&remote=true',
    'https://euremotejobs.com/?s=marketing+manager&remote=1',
    'https://remoteur.com/jobs/?search=marketing+manager',
  ]

  for (const url of urls) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
      await page.waitForTimeout(2000)

      const found = await page.evaluate((kws) => {
        const results = []
        const cards = document.querySelectorAll('article, .job, [class*="job-card"], [class*="job_card"]')
        cards.forEach(card => {
          const titleEl = card.querySelector('h2, h3, [class*="title"]')
          const companyEl = card.querySelector('[class*="company"]')
          const linkEl = card.querySelector('a')
          if (!titleEl || !linkEl) return
          const title = titleEl.textContent.trim()
          if (!kws.some(k => title.toLowerCase().includes(k))) return
          results.push({
            title,
            company: companyEl?.textContent?.trim() || '',
            location: 'Remote',
            salary: '',
            description: '',
            url: linkEl.href || '',
            remote: 1,
            posted_at: '',
            contract_type: 'CDI',
          })
        })
        return results
      }, EMMA_KW)

      jobs.push(...found.filter(j => j.title && j.url && j.url.startsWith('http')))
    } catch (err) {
      console.error('[euremotejobs]', err.message)
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
