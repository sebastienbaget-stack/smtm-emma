// Jooble — API publique, agrégateur
async function scrape(context) {
  const page = await context.newPage()
  const jobs = []

  const searches = [
    { keywords: 'chef de projet digital', location: 'Grenoble' },
    { keywords: 'omnicanal manager', location: 'Grenoble' },
    { keywords: 'marketing manager digital', location: 'Grenoble' },
    { keywords: 'e-commerce manager', location: 'Grenoble' },
    { keywords: 'digital project manager', location: 'France remote' },
    { keywords: 'traffic manager CRO', location: 'France' },
  ]

  try {
    await page.goto('https://fr.jooble.org', { waitUntil: 'domcontentloaded', timeout: 15000 })
    await page.waitForTimeout(1000)

    for (const { keywords, location } of searches) {
      try {
        const data = await page.evaluate(async ({ kw, loc }) => {
          const resp = await fetch('https://fr.jooble.org/api/-1', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keywords: kw, location: loc, page: 1 })
          })
          if (!resp.ok) return null
          return resp.json()
        }, { kw: keywords, loc: location })

        const offers = data?.jobs || []
        for (const o of offers) {
          if (!o.title) continue
          const loc = o.location || ''
          const isRemote = loc.toLowerCase().includes('télétravail') || loc.toLowerCase().includes('remote')
          jobs.push({
            title: o.title.trim(),
            company: o.company || '',
            location: loc,
            salary: o.salary || '',
            description: (o.snippet || o.description || '').replace(/<[^>]+>/g, '').slice(0, 400),
            url: o.link || '',
            remote: isRemote ? 1 : 0,
            posted_at: o.updated || o.date || '',
            contract_type: 'CDI',
          })
        }
      } catch {}
    }
  } catch (err) {
    console.error('[jooble]', err.message)
  }

  await page.close()
  return dedupe(jobs.filter(j => j.url))
}

function dedupe(jobs) {
  const seen = new Set()
  return jobs.filter(j => j.url && j.title && !seen.has(j.url) && seen.add(j.url))
}

module.exports = { scrape }
