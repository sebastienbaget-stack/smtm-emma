// LinkedIn — Guest Jobs API (sans auth)
async function scrape(context) {
  const page = await context.newPage()
  const jobs = []

  const searches = [
    { keywords: 'omnichannel+manager', location: 'Grenoble', f_JT: 'F' },
    { keywords: 'chef+de+projet+digital', location: 'Grenoble', f_JT: 'F' },
    { keywords: 'digital+project+manager', location: 'Grenoble', f_JT: 'F' },
    { keywords: 'marketing+manager', location: 'Grenoble', f_JT: 'F' },
    { keywords: 'chef+de+projet+e-commerce', location: 'Grenoble', f_JT: 'F' },
    { keywords: 'CRO+conversion+rate', location: 'France', f_JT: 'F' },
    { keywords: 'omnichannel+manager', location: 'France', f_JT: 'F,C' },
    { keywords: 'chef+de+projet+digital+remote', location: 'France', f_JT: 'F' },
  ]

  for (const s of searches) {
    try {
      const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${s.keywords}&location=${encodeURIComponent(s.location)}&f_JT=${s.f_JT}&start=0`
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
      await page.waitForTimeout(1000)

      const found = await page.evaluate(() => {
        const results = []
        document.querySelectorAll('li').forEach(li => {
          const a = li.querySelector('a[href*="linkedin.com/jobs/view"]')
          const titleEl = li.querySelector('.base-search-card__title, h3')
          const companyEl = li.querySelector('.base-search-card__subtitle, h4')
          const locationEl = li.querySelector('.job-search-card__location')
          const dateEl = li.querySelector('time, [datetime]')
          if (!titleEl || !a) return
          const loc = locationEl?.textContent?.trim() || ''
          const isRemote = loc.toLowerCase().includes('télétravail') || loc.toLowerCase().includes('remote')
          results.push({
            title: titleEl.textContent.trim(),
            company: companyEl?.textContent?.trim() || '',
            location: loc,
            salary: '',
            description: '',
            url: a.href.split('?')[0],
            remote: isRemote ? 1 : 0,
            posted_at: dateEl?.getAttribute('datetime') || dateEl?.textContent?.trim() || '',
            contract_type: 'CDI',
          })
        })
        return results
      })
      jobs.push(...found.filter(j => j.title && j.url))
    } catch (err) {
      console.error('[linkedin]', err.message)
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
