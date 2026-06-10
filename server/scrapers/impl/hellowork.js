// HelloWork — DOM scraping
async function scrape(context) {
  const page = await context.newPage()
  const jobs = []

  const urls = [
    'https://www.hellowork.com/fr-fr/emploi/recherche.html?k=chef+de+projet+digital&l=Grenoble+%2838%29&c=CDI&s=date',
    'https://www.hellowork.com/fr-fr/emploi/recherche.html?k=omnicanal&l=Grenoble+%2838%29&c=CDI&s=date',
    'https://www.hellowork.com/fr-fr/emploi/recherche.html?k=marketing+manager&l=Grenoble+%2838%29&c=CDI&s=date',
    'https://www.hellowork.com/fr-fr/emploi/recherche.html?k=digital+project+manager&l=France&c=CDI&s=date&tt=1',
  ]

  for (const url of urls) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 18000 })
      await page.waitForTimeout(1500)

      const found = await page.evaluate(() => {
        const results = []
        const cards = document.querySelectorAll('[data-id-storage], article.job, [class*="JobCard"]')
        cards.forEach(card => {
          const titleEl = card.querySelector('a[title], h2 a, h3 a, [class*="title"] a')
          const companyEl = card.querySelector('[class*="company"], [class*="employer"]')
          const locationEl = card.querySelector('[class*="location"]')
          const salaryEl = card.querySelector('[class*="salary"], [class*="wage"]')
          const dateEl = card.querySelector('[class*="date"], time')
          if (!titleEl) return
          const loc = locationEl?.textContent?.trim() || ''
          const isRemote = loc.toLowerCase().includes('télétravail') || loc.toLowerCase().includes('remote')
          const href = titleEl.href || ''
          if (!href) return
          results.push({
            title: (titleEl.textContent || titleEl.getAttribute('title') || '').trim(),
            company: companyEl?.textContent?.trim() || '',
            location: loc,
            salary: salaryEl?.textContent?.trim() || '',
            description: '',
            url: href.startsWith('http') ? href : `https://www.hellowork.com${href}`,
            remote: isRemote ? 1 : 0,
            posted_at: dateEl?.textContent?.trim() || dateEl?.getAttribute('datetime') || '',
            contract_type: 'CDI',
          })
        })
        return results
      })
      jobs.push(...found.filter(j => j.title && j.url))
    } catch (err) {
      console.error('[hellowork]', err.message)
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
