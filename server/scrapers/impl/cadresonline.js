// Cadresonline — DOM scraping CDI, Grenoble + remote
async function scrape(context) {
  const page = await context.newPage()
  const jobs = []

  const searches = [
    'https://www.cadresonline.com/emploi/chef-projet-digital/?contrat=CDI&localisation=Grenoble',
    'https://www.cadresonline.com/emploi/omnicanal/?contrat=CDI',
    'https://www.cadresonline.com/emploi/marketing-manager/?contrat=CDI&localisation=Grenoble',
    'https://www.cadresonline.com/emploi/responsable-ecommerce/?contrat=CDI&localisation=Grenoble',
    'https://www.cadresonline.com/emploi/chef-projet-digital/?contrat=CDI&teletravail=full',
    'https://www.cadresonline.com/emploi/digital-marketing-manager/?contrat=CDI',
  ]

  for (const url of searches) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 18000 })
      await page.waitForTimeout(2000)
      await page.click('button:has-text("Accepter"), button:has-text("Accept all")').catch(() => {})

      const found = await page.evaluate(() => {
        const results = []
        const cards = document.querySelectorAll('.offer-item, [class*="job-card"], [class*="offer-card"], article[class*="job"]')
        cards.forEach(card => {
          const titleEl = card.querySelector('h2 a, h3 a, [class*="title"] a, .offer-title a')
          const companyEl = card.querySelector('[class*="company"], [class*="employer"], .offer-company')
          const locationEl = card.querySelector('[class*="location"], [class*="city"], .offer-location')
          const salaryEl = card.querySelector('[class*="salary"], [class*="remuneration"], .offer-salary')
          const descEl = card.querySelector('[class*="description"], [class*="excerpt"], .offer-description')
          const dateEl = card.querySelector('[class*="date"], time')
          if (!titleEl) return
          const href = titleEl.href || titleEl.closest('a')?.href || ''
          if (!href) return
          const loc = locationEl?.textContent?.trim() || ''
          const isRemote = loc.toLowerCase().includes('télétravail') || loc.toLowerCase().includes('remote')
          results.push({
            title: titleEl.textContent.trim(),
            company: companyEl?.textContent?.trim() || '',
            location: loc,
            salary: salaryEl?.textContent?.trim() || '',
            description: descEl?.textContent?.trim().slice(0, 400) || '',
            url: href.startsWith('http') ? href : `https://www.cadresonline.com${href}`,
            remote: isRemote ? 1 : 0,
            posted_at: dateEl?.textContent?.trim() || '',
            contract_type: 'CDI',
          })
        })
        return results
      })
      jobs.push(...found.filter(j => j.title && j.url))
    } catch (err) {
      console.error('[cadresonline]', err.message)
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
