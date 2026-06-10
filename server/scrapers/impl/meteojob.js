// Meteojob — DOM scraping CDI, Grenoble + remote
async function scrape(context) {
  const page = await context.newPage()
  const jobs = []

  const queries = [
    'chef+de+projet+digital',
    'omnicanal',
    'marketing+manager',
    'e-commerce+manager',
  ]

  for (const q of queries) {
    try {
      const url = `https://www.meteojob.com/jobs?what=${q}&where=Grenoble&contractTypes=CDI`
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 18000 })
      await page.waitForTimeout(3000)

      const found = await page.evaluate(() => {
        const results = []
        document.querySelectorAll('[class*="cc-job-offer-main-cont"], [class*="job-offer"], article.job').forEach(card => {
          const titleEl = card.querySelector('h2, h3, [class*="title"]')
          const link = card.querySelector('a[href*="/jobs/"]')
          const companyEl = card.querySelector('[class*="company"], [class*="employer"], .d-inline-block')
          const allBadges = [...card.querySelectorAll('[class*="badge"], [class*="tag"]')]
          const locationBadge = allBadges.find(b => b.textContent.includes('place') || b.textContent.match(/\d{2,5}/))
          const salaryEl = card.querySelector('[class*="salary"], [class*="sky"], [class*="wage"]')
          const dateEl = card.querySelector('time, [class*="date"]')

          if (!titleEl || !link) return
          const loc = (locationBadge?.textContent?.trim() || '').replace(/^place\s*/i, '').trim()
          const isRemote = loc.toLowerCase().includes('télétravail') || loc.toLowerCase().includes('remote')

          results.push({
            title: titleEl.textContent.trim(),
            company: companyEl?.textContent?.trim() || '',
            location: loc,
            salary: salaryEl?.textContent?.trim() || '',
            description: '',
            url: link.href,
            remote: isRemote ? 1 : 0,
            posted_at: dateEl?.getAttribute('datetime') || dateEl?.textContent?.trim() || '',
            contract_type: 'CDI',
          })
        })
        return results
      })
      jobs.push(...found.filter(j => j.title && j.url))
    } catch (err) {
      console.error('[meteojob]', err.message)
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
