// Figaro Emploi — DOM scraping CDI, Grenoble + remote
async function scrape(context) {
  const page = await context.newPage()
  const jobs = []

  const searches = [
    'https://emploi.lefigaro.fr/annonce/emploi-chef-de-projet-digital-grenoble.html?typeContrat=CDI',
    'https://emploi.lefigaro.fr/annonce/emploi-marketing-manager-grenoble.html?typeContrat=CDI',
    'https://emploi.lefigaro.fr/annonce/emploi-omnicanal.html?typeContrat=CDI',
    'https://emploi.lefigaro.fr/annonce/emploi-ecommerce-manager.html?typeContrat=CDI&teletravail=full',
  ]

  for (const url of searches) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 18000 })
      await page.waitForTimeout(2000)
      await page.click('button:has-text("Accepter"), button:has-text("Accept")').catch(() => {})

      const found = await page.evaluate(() => {
        const results = []
        document.querySelectorAll('[class*="offer"], article.job, .job-offer').forEach(card => {
          const titleEl = card.querySelector('h2 a, h3 a, a[class*="title"]')
          const companyEl = card.querySelector('[class*="company"], [class*="employer"]')
          const locationEl = card.querySelector('[class*="location"], [class*="city"]')
          const salaryEl = card.querySelector('[class*="salary"], [class*="remuneration"]')
          const descEl = card.querySelector('[class*="description"], [class*="excerpt"]')
          if (!titleEl) return
          const href = titleEl.href || ''
          if (!href) return
          const loc = locationEl?.textContent?.trim() || ''
          results.push({
            title: titleEl.textContent.trim(),
            company: companyEl?.textContent?.trim() || '',
            location: loc,
            salary: salaryEl?.textContent?.trim() || '',
            description: descEl?.textContent?.trim().slice(0, 400) || '',
            url: href.startsWith('http') ? href : `https://emploi.lefigaro.fr${href}`,
            remote: loc.toLowerCase().includes('télétravail') || loc.toLowerCase().includes('remote') ? 1 : 0,
            posted_at: '',
            contract_type: 'CDI',
          })
        })
        return results
      })
      jobs.push(...found.filter(j => j.title && j.url))
    } catch (err) {
      console.error('[figaro]', err.message)
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
