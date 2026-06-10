// Welcome to the Jungle — Algolia direct API
const https = require('https')

const ALGOLIA_APP_ID = 'CSEKHVMS53'
const ALGOLIA_API_KEY = '4bd8f6215d0cc52b26430765769e65a0'
const ALGOLIA_INDEX = 'wttj_jobs_production_fr'

function algoliaSearch(queries) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ requests: queries })
    const options = {
      hostname: 'csekhvms53-dsn.algolia.net',
      path: '/1/indexes/*/queries',
      method: 'POST',
      headers: {
        'x-algolia-application-id': ALGOLIA_APP_ID,
        'x-algolia-api-key': ALGOLIA_API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Referer': 'https://www.welcometothejungle.com/',
        'Origin': 'https://www.welcometothejungle.com',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      }
    }
    const req = https.request(options, res => {
      let d = ''
      res.on('data', c => d += c)
      res.on('end', () => { try { resolve(JSON.parse(d)) } catch { resolve(null) } })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

const EMMA_QUERIES = [
  'omnicanal',
  'omnichannel',
  'chef de projet digital',
  'digital project manager',
  'marketing manager',
  'chef de projet e-commerce',
  'CRO conversion',
  'traffic manager',
]

const EMMA_KEYWORDS = [
  'omnicanal', 'omnichannel', 'chef de projet digital', 'digital project',
  'marketing manager', 'e-commerce', 'ecommerce', 'cro', 'conversion', 'traffic manager',
]

async function scrape(context) {
  const jobs = []
  const queries = EMMA_QUERIES.map(q => ({
    indexName: ALGOLIA_INDEX,
    query: q,
    params: 'hitsPerPage=15',
  }))

  try {
    const data = await algoliaSearch(queries)
    const allHits = (data?.results || []).flatMap(r => r.hits || [])

    for (const hit of allHits) {
      if (!hit.name) continue
      const titleLow = hit.name.toLowerCase()
      if (!EMMA_KEYWORDS.some(k => titleLow.includes(k))) continue

      const office = hit.offices?.[0] || {}
      const loc = office.city || office.local_city || ''
      const country = office.country_code || ''
      const isRemote = hit.remote === 'full' || hit.has_remote === true
      const isGrenoble = loc.toLowerCase().includes('grenoble') || loc.toLowerCase().includes('isère')

      // Garder si Grenoble ou remote ou France
      if (!isRemote && !isGrenoble && country !== 'FR' && loc) continue

      const orgSlug = hit.organization?.slug || hit.organization?.reference || ''
      const jobSlug = hit.slug || hit.reference || hit.objectID || ''

      jobs.push({
        title: hit.name.trim(),
        company: hit.organization?.name || '',
        location: loc || (isRemote ? 'Remote' : 'France'),
        salary: hit.salary_minimum ? `${hit.salary_minimum}–${hit.salary_maximum || '?'}€` : '',
        description: (hit.summary || hit.key_missions || '').replace(/<[^>]+>/g, '').slice(0, 300),
        url: orgSlug && jobSlug
          ? `https://www.welcometothejungle.com/fr/companies/${orgSlug}/jobs/${jobSlug}`
          : `https://www.welcometothejungle.com/fr/jobs?query=${encodeURIComponent(hit.name)}`,
        remote: isRemote ? 1 : 0,
        posted_at: hit.published_at_date || hit.published_at || '',
        contract_type: 'CDI',
      })
    }
  } catch (err) {
    console.error('[wttj]', err.message)
  }

  return dedupe(jobs)
}

function dedupe(jobs) {
  const seen = new Set()
  return jobs.filter(j => j.url && j.title && !seen.has(j.url) && seen.add(j.url))
}

module.exports = { scrape }
