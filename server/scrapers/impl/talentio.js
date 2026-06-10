// talent.io — API publique, startups tech/digital
async function scrape(context) {
  const page = await context.newPage()
  const jobs = []

  try {
    await page.goto('https://www.talent.io/p/fr-fr/jobs', { waitUntil: 'domcontentloaded', timeout: 15000 })
    await page.waitForTimeout(1000)

    const searches = ['omnicanal', 'marketing manager', 'chef de projet digital', 'e-commerce', 'product manager digital']

    for (const q of searches) {
      try {
        const data = await page.evaluate(async (query) => {
          const resp = await fetch('https://api.talent.io/api/v1/jobs/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
              query,
              filters: { contract_types: ['full_time'], remote: ['full'] },
              pagination: { page: 0, per_page: 20 }
            })
          })
          if (!resp.ok) return null
          return resp.json()
        }, q)

        const offers = data?.jobs || data?.results || []
        for (const o of offers) {
          if (!o.title) continue
          const salary = o.salary_range
            ? `${o.salary_range.min}–${o.salary_range.max}€/an`
            : ''
          jobs.push({
            title: o.title.trim(),
            company: o.company?.name || '',
            location: o.city || (o.remote ? 'Remote' : 'France'),
            salary,
            description: (o.summary || o.description || '').replace(/<[^>]+>/g, '').slice(0, 400),
            url: o.url || `https://www.talent.io/p/fr-fr/jobs/${o.id}`,
            remote: o.remote ? 1 : 0,
            posted_at: o.published_at || '',
            contract_type: 'CDI',
          })
        }
      } catch {}
    }
  } catch (err) {
    console.error('[talentio]', err.message)
  }

  await page.close()
  return dedupe(jobs)
}

function dedupe(jobs) {
  const seen = new Set()
  return jobs.filter(j => j.url && j.title && !seen.has(j.url) && seen.add(j.url))
}

module.exports = { scrape }
