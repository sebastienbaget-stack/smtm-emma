// Jobgether — plateforme remote-first européenne, API Algolia
async function scrape(context) {
  const page = await context.newPage()
  const jobs = []

  const EMMA_KW = [
    'omnichannel', 'ecommerce', 'e-commerce', 'marketing manager',
    'digital project manager', 'traffic manager', 'cro', 'conversion',
    'growth manager', 'digital manager', 'chef de projet',
  ]

  try {
    await page.goto('https://jobgether.com/jobs', { waitUntil: 'domcontentloaded', timeout: 15000 })
    await page.waitForTimeout(1500)

    for (const q of EMMA_KW.slice(0, 6)) {
      try {
        const data = await page.evaluate(async (query) => {
          const resp = await fetch(`https://jobgether.com/api/jobs/search?query=${encodeURIComponent(query)}&remote=true&page=1`, {
            headers: { 'Accept': 'application/json' }
          })
          if (!resp.ok) return null
          return resp.json()
        }, q)

        const offers = data?.jobs || data?.results || data?.hits || []
        for (const o of offers) {
          if (!o.title) continue
          jobs.push({
            title: o.title.trim(),
            company: o.company?.name || o.companyName || '',
            location: o.location || 'Remote',
            salary: o.salary || o.compensation || '',
            description: (o.description || o.summary || '').replace(/<[^>]+>/g, '').slice(0, 400),
            url: o.url || o.applyUrl || `https://jobgether.com/offer/${o.id || o.slug}`,
            remote: 1,
            posted_at: o.publishedAt || o.createdAt || '',
            contract_type: 'CDI',
          })
        }
      } catch {}
    }
  } catch (err) {
    console.error('[jobgether]', err.message)
  }

  await page.close()
  return dedupe(jobs)
}

function dedupe(jobs) {
  const seen = new Set()
  return jobs.filter(j => j.url && j.title && !seen.has(j.url) && seen.add(j.url))
}

module.exports = { scrape }
