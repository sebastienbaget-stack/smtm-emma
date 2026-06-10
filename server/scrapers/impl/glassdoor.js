// Glassdoor FR — DOM scraping, CDI, Grenoble + remote
async function scrape(context) {
  const page = await context.newPage()
  const jobs = []

  const searches = [
    'chef-de-projet-digital-grenoble',
    'omnicanal-manager-france',
    'marketing-manager-grenoble',
    'digital-project-manager-remote',
    'chef-de-projet-e-commerce-grenoble',
  ]

  for (const q of searches) {
    try {
      const url = `https://www.glassdoor.fr/Emploi/${q}-emplois-SRCH_KO0,${q.length}.htm`
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })
      await page.waitForTimeout(3000)
      await page.click('button:has-text("Accepter"), [id*="accept"]').catch(() => {})
      await page.waitForTimeout(500)

      const found = await page.evaluate(() => {
        const results = []
        const cards = document.querySelectorAll('[data-test="jobListing"], li[data-id], [class*="job-search-key"]')
        cards.forEach(card => {
          const titleEl = card.querySelector('[data-test="job-title"], a[class*="JobCard_jobTitle"], h3')
          const companyEl = card.querySelector('[data-test="employer-name"], [class*="EmployerProfile"]')
          const locationEl = card.querySelector('[data-test="emp-location"], [class*="location"]')
          const salaryEl = card.querySelector('[data-test="detailSalary"], [class*="salary"], [class*="Salary"]')
          const linkEl = card.querySelector('a[href*="/Emploi/"], a[href*="/job-listing/"]')
          if (!titleEl) return
          const loc = locationEl?.textContent?.trim() || ''
          const href = linkEl?.href || ''
          if (!href) return
          results.push({
            title: titleEl.textContent.trim(),
            company: companyEl?.textContent?.trim() || '',
            location: loc,
            salary: salaryEl?.textContent?.trim() || '',
            description: '',
            url: href,
            remote: loc.toLowerCase().includes('remote') || loc.toLowerCase().includes('télétravail') ? 1 : 0,
            posted_at: '',
            contract_type: 'CDI',
          })
        })
        return results
      })
      jobs.push(...found.filter(j => j.title && j.url))
    } catch (err) {
      console.error('[glassdoor]', err.message)
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
