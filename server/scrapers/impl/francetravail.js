// France Travail — DOM scraping CDI, Grenoble + remote
async function scrape(context) {
  const page = await context.newPage()
  const jobs = []

  const queries = [
    'chef+de+projet+digital',
    'omnicanal',
    'marketing+manager',
    'chef+de+projet+e-commerce',
    'digital+project+manager',
    'traffic+manager',
  ]

  for (const q of queries) {
    try {
      // typeContrat=CDI, lieu = Isère (38) ou remote
      const url = `https://candidat.francetravail.fr/offres/recherche?motsCles=${q}&typeContrat=CDI&lieuTravail=38&sort=1`
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 18000 })
      await page.waitForTimeout(3000)

      const found = await page.evaluate(() => {
        const results = []
        document.querySelectorAll('li.result, article.result').forEach(card => {
          const titleEl = card.querySelector('.media-heading-title, h2 span, h3 span, h2 a')
          const link = card.querySelector('a[href*="/offres/recherche/detail/"]')
          const subtextEl = card.querySelector('.subtext')
          const descEl = card.querySelector('.description, p.description')
          const salaryEl = card.querySelector('.salary, [class*="salaire"], [class*="salary"]')

          if (!titleEl || !link) return

          const subtextText = subtextEl?.textContent?.trim() || ''
          const parts = subtextText.split(/\s*[-–]\s*/).map(s => s.trim()).filter(Boolean)
          const company = parts[0] || ''
          const location = parts.filter(p => p.length > 2).pop() || ''
          const isRemote = (subtextText + (descEl?.textContent || '')).toLowerCase().includes('télétravail')

          const href = link.getAttribute('href')
          const jobUrl = href?.startsWith('http') ? href : `https://candidat.francetravail.fr${href}`

          results.push({
            title: titleEl.textContent.trim(),
            company,
            location,
            salary: salaryEl?.textContent?.trim() || '',
            description: (descEl?.textContent?.trim() || '').slice(0, 300),
            url: jobUrl,
            remote: isRemote ? 1 : 0,
            posted_at: '',
            contract_type: 'CDI',
          })
        })
        return results
      })

      jobs.push(...found.filter(j => j.title && j.url))
    } catch (err) {
      console.error('[francetravail]', err.message)
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
