// Remotive — API publique, 100% full remote
// https://remotive.com/api/remote-jobs
async function scrape(context) {
  const jobs = []

  const categories = ['marketing', 'product', 'business-development']
  const keywords = [
    'omnichannel', 'omnicanal', 'ecommerce', 'e-commerce',
    'marketing manager', 'digital project', 'traffic manager',
    'cro', 'conversion', 'growth', 'chef de projet',
  ]

  try {
    for (const cat of categories) {
      const resp = await fetch(`https://remotive.com/api/remote-jobs?category=${cat}&limit=50`)
      if (!resp.ok) continue
      const data = await resp.json()

      for (const job of (data.jobs || [])) {
        if (!job.title) continue
        const t = job.title.toLowerCase()
        const desc = (job.description || '').toLowerCase()
        if (!keywords.some(k => t.includes(k) || desc.includes(k))) continue

        jobs.push({
          title: job.title.trim(),
          company: job.company_name || '',
          location: job.candidate_required_location || 'Remote',
          salary: job.salary || '',
          description: (job.description || '').replace(/<[^>]+>/g, '').slice(0, 400),
          url: job.url || '',
          remote: 1,
          posted_at: job.publication_date || '',
          contract_type: 'CDI',
        })
      }
    }
  } catch (err) {
    console.error('[remotive]', err.message)
  }

  return dedupe(jobs)
}

function dedupe(jobs) {
  const seen = new Set()
  return jobs.filter(j => j.url && j.title && !seen.has(j.url) && seen.add(j.url))
}

module.exports = { scrape }
module.exports.noBrowser = true
