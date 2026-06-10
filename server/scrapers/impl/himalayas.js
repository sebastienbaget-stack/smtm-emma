// Himalayas — API publique, 100% remote, bonne couverture Europe
async function scrape(context) {
  const jobs = []

  const searches = [
    'marketing manager',
    'ecommerce manager',
    'digital project manager',
    'omnichannel',
    'traffic manager',
    'growth manager',
    'conversion rate',
  ]

  for (const q of searches) {
    try {
      const resp = await fetch(
        `https://himalayas.app/jobs/api?q=${encodeURIComponent(q)}&remote=true&limit=20`,
        { headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' } }
      )
      if (!resp.ok) continue
      const data = await resp.json()

      for (const job of (data.jobs || [])) {
        if (!job.title) continue
        // Vérifier eligibilité Europe/France/Remote
        const region = (job.locationRestrictions || []).join(' ').toLowerCase()
        if (region && !region.includes('europe') && !region.includes('france') &&
            !region.includes('worldwide') && !region.includes('anywhere')) continue

        jobs.push({
          title: job.title.trim(),
          company: job.company?.name || '',
          location: job.locationRestrictions?.join(', ') || 'Remote',
          salary: job.salary
            ? `${job.salary.min || '?'}–${job.salary.max || '?'}${job.salary.currency || '€'}`
            : '',
          description: (job.description || '').replace(/<[^>]+>/g, '').slice(0, 400),
          url: job.applicationLink || job.canonicalUrl || `https://himalayas.app/jobs/${job.slug}`,
          remote: 1,
          posted_at: job.createdAt || '',
          contract_type: 'CDI',
        })
      }
    } catch (err) {
      console.error('[himalayas]', err.message)
    }
  }

  return dedupe(jobs)
}

function dedupe(jobs) {
  const seen = new Set()
  return jobs.filter(j => j.url && j.title && !seen.has(j.url) && seen.add(j.url))
}

module.exports = { scrape }
module.exports.noBrowser = true
