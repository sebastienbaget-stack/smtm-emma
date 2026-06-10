// Cadremploi — DOM scraping
async function scrape(context) {
  const page = await context.newPage()
  const jobs = []

  const searches = [
    'https://www.cadremploi.fr/emploi/liste_offres.html?s=1&kw=chef+de+projet+digital&vl=Grenoble+(38)',
    'https://www.cadremploi.fr/emploi/liste_offres.html?s=1&kw=omnicanal&vl=Grenoble+(38)',
    'https://www.cadremploi.fr/emploi/liste_offres.html?s=1&kw=marketing+manager&vl=Grenoble+(38)',
    'https://www.cadremploi.fr/emploi/liste_offres.html?s=1&kw=chef+de+projet+e-commerce&vl=Auvergne-Rhône-Alpes',
    'https://www.cadremploi.fr/emploi/liste_offres.html?s=1&kw=omnichannel+manager&vl=France&tt=1', // télétravail
  ]

  for (const url of searches) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 18000 })
      await page.waitForTimeout(1500)

      const found = await page.evaluate(() => {
        const results = []
        const cards = document.querySelectorAll('[class*="offer-card"], [class*="job-card"], article[data-id]')
        cards.forEach(card => {
          const titleEl = card.querySelector('h2 a, h3 a, [class*="title"] a, [class*="job-title"]')
          const companyEl = card.querySelector('[class*="company"], [class*="employer"]')
          const locationEl = card.querySelector('[class*="location"], [class*="place"]')
          const salaryEl = card.querySelector('[class*="salary"], [class*="wage"]')
          const dateEl = card.querySelector('[class*="date"], time')
          if (!titleEl) return
          const loc = locationEl?.textContent?.trim() || ''
          const isRemote = loc.toLowerCase().includes('télétravail') || loc.toLowerCase().includes('remote')
          const href = titleEl.href || titleEl.closest('a')?.href || ''
          if (!href) return
          results.push({
            title: titleEl.textContent.trim(),
            company: companyEl?.textContent?.trim() || '',
            location: loc,
            salary: salaryEl?.textContent?.trim() || '',
            description: '',
            url: href.startsWith('http') ? href : `https://www.cadremploi.fr${href}`,
            remote: isRemote ? 1 : 0,
            posted_at: dateEl?.textContent?.trim() || dateEl?.getAttribute('datetime') || '',
            contract_type: 'CDI',
          })
        })
        return results
      })
      jobs.push(...found.filter(j => j.title && j.url))
    } catch (err) {
      console.error('[cadremploi]', err.message)
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
