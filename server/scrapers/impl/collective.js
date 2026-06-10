// Collective.work — GraphQL, CDI uniquement (isPermanentContract)
const GQL_QUERY = `
  query SearchJobs($data: PublicPages_SearchJobsInputType!) {
    results: PublicPages_SearchJobs(data: $data) {
      projects {
        id slug name sumUp description budgetBrief workPreferences
        isPermanentContract publishedAt
        company { name }
        location { fullNameFrench }
      }
      pagination { from total }
    }
  }
`

const BASE_VARS = {
  from: 0, sort: 'Relevance',
  dailyRates: { from: 0, to: null },
  exclusive: false, locations: [], skills: [], workPreferences: [],
  hasDailyRate: false, companies: [], fromTopRecruiter: false,
  idealStartDate: [], contractType: 'Permanent',
  offerLanguages: [], recruiterOrganizationId: null,
}

async function scrape(context) {
  const page = await context.newPage()
  const jobs = []

  try {
    await page.goto('https://www.collective.work/jobs', { waitUntil: 'domcontentloaded', timeout: 15000 })
    await page.waitForTimeout(1000)
  } catch {}

  const searches = [
    'omnicanal', 'chef de projet digital', 'marketing manager',
    'e-commerce manager', 'digital project manager', 'traffic manager',
  ]

  for (const q of searches) {
    try {
      const data = await page.evaluate(async ({ query, gql, vars }) => {
        const resp = await fetch('https://api.collective.work/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: gql, variables: { data: { ...vars, query } } })
        })
        if (!resp.ok) return null
        return resp.json()
      }, { query: q, gql: GQL_QUERY, vars: BASE_VARS })

      const projects = data?.data?.results?.projects || []
      for (const p of projects) {
        if (!p.name || !p.isPermanentContract) continue
        const loc = p.location?.fullNameFrench || ''
        const isRemote = (p.workPreferences || []).some(w =>
          typeof w === 'string' && w.toLowerCase().includes('remote')
        )
        jobs.push({
          title: p.name.trim(),
          company: p.company?.name || '',
          location: loc || (isRemote ? 'Remote' : 'France'),
          salary: p.budgetBrief || '',
          description: (p.sumUp || p.description || '').replace(/<[^>]+>/g, '').slice(0, 300),
          url: `https://www.collective.work/jobs/fr/${p.slug}`,
          remote: isRemote ? 1 : 0,
          posted_at: p.publishedAt || '',
          contract_type: 'CDI',
        })
      }
    } catch (err) {
      console.error('[collective]', err.message)
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
