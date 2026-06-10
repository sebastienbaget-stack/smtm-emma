// Monster FR — DOM scraping CDI, Grenoble + remote
async function scrape(context) {
  const page = await context.newPage()
  const jobs = []

  const searches = [
    'https://www.monster.fr/emploi/recherche/?q=chef-de-projet-digital&where=Grenoble__2C-Auvergne-Rh__F4ne-Alpes&cy=fr&ct=CDI',
    'https://www.monster.fr/emploi/recherche/?q=marketing-manager&where=Grenoble__2C-Auvergne-Rh__F4ne-Alpes&cy=fr&ct=CDI',
    'https://www.monster.fr/emploi/recherche/?q=omnicanal&where=France&cy=fr&ct=CDI',
    'https://www.monster.fr/emploi/recherche/?q=ecommerce-manager&where=Grenoble&cy=fr&ct=CDI',
    'https://www.monster.fr/emploi/recherche/?q=digital-project-manager&cy=fr&ct=CDI&tm=remote',
  ]

  for (const url of searches) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 18000 })
      await page.waitForTimeout(2500)
      await page.click('button:has-text("Accepter"), #onetrust-accept-btn-handler').catch(() => {})

      const found = await page.evaluate(() => {
        const results = []
        document.querySelectorAll('[data-testid="jobCard"], .job-cardstyle__JobCard, [class*="JobCard"], article.job').forEach(card => {
          const titleEl = card.querySelector('h2 a, h3 a, [data-testid="jobTitle"], a[class*="title"]')
          const companyEl = card.querySelector('[data-testid="company"], [class*="company"], [class*="Company"]')
          const locationEl = card.querySelector('[data-testid="location"], [class*="location"], [class*="Location"]')
          const salaryEl = card.querySelector('[data-testid="salary"], [class*="salary"], [class*="Salary"]')
          const descEl = card.querySelector('[data-testid="snippet"], [class*="snippet"], [class*="description"]')
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
            url: href.startsWith('http') ? href : `https://www.monster.fr${href}`,
            remote: isRemote ? 1 : 0,
            posted_at: '',
            contract_type: 'CDI',
          })
        })
        return results
      })
      jobs.push(...found.filter(j => j.title && j.url))
    } catch (err) {
      console.error('[monster]', err.message)
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
