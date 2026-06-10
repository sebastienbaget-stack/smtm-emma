// JobTeaser — API interne, très fort sur marketing/digital
async function scrape(context) {
  const page = await context.newPage()
  const jobs = []

  try {
    await page.goto('https://www.jobteaser.com/fr/job-offers', { waitUntil: 'domcontentloaded', timeout: 15000 })
    await page.waitForTimeout(1000)

    const searches = [
      { q: 'omnicanal', loc: 'Grenoble' },
      { q: 'chef de projet digital', loc: 'Grenoble' },
      { q: 'marketing manager', loc: 'Grenoble' },
      { q: 'e-commerce manager', loc: 'Grenoble' },
      { q: 'digital project manager', loc: '' },
      { q: 'traffic manager', loc: 'Grenoble' },
    ]

    for (const { q, loc } of searches) {
      try {
        const data = await page.evaluate(async ({ query, location }) => {
          const params = new URLSearchParams({
            'filter[keywords]': query,
            'filter[contract_type][]': 'permanent',
            'filter[radius]': '30',
            ...(location ? { 'filter[location]': location } : {}),
            'page': '1',
            'per_page': '20',
          })
          const resp = await fetch(`https://www.jobteaser.com/api/v2/job-offers?${params}`, {
            headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
          })
          if (!resp.ok) return null
          return resp.json()
        }, { query: q, location: loc })

        const offers = data?.data || data?.job_offers || []
        for (const o of offers) {
          if (!o.title && !o.name) continue
          const city = o.city || o.location?.city || ''
          const country = o.country || o.location?.country || 'FR'
          const isRemote = o.remote_friendly === true || o.remote === 'full'
          jobs.push({
            title: (o.title || o.name || '').trim(),
            company: o.company?.name || o.organization?.name || '',
            location: city || (isRemote ? 'Remote' : 'France'),
            salary: o.salary || o.compensation || '',
            description: (o.summary || o.description || '').replace(/<[^>]+>/g, '').slice(0, 400),
            url: o.url || o.apply_url || `https://www.jobteaser.com/fr/job-offers/${o.id || o.slug}`,
            remote: isRemote ? 1 : 0,
            posted_at: o.published_at || o.created_at || '',
            contract_type: 'CDI',
          })
        }
      } catch (err) {
        console.error('[jobteaser] search error', err.message)
      }
    }
  } catch (err) {
    console.error('[jobteaser]', err.message)
  }

  await page.close()
  return dedupe(jobs)
}

function dedupe(jobs) {
  const seen = new Set()
  return jobs.filter(j => j.url && j.title && !seen.has(j.url) && seen.add(j.url))
}

module.exports = { scrape }
