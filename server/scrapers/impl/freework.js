// Free-Work — API interne, CDI + freelance, mots-clés Emma
async function scrape(context) {
  const page = await context.newPage()
  const jobs = []

  const searches = [
    { kw: 'omnicanal',              ref: 'https://www.free-work.com/fr/tech-it/jobs' },
    { kw: 'chef+de+projet+digital', ref: 'https://www.free-work.com/fr/tech-it/jobs' },
    { kw: 'marketing+manager',      ref: 'https://www.free-work.com/fr/tech-it/jobs' },
    { kw: 'e-commerce+manager',     ref: 'https://www.free-work.com/fr/tech-it/jobs' },
    { kw: 'traffic+manager',        ref: 'https://www.free-work.com/fr/tech-it/jobs' },
  ]

  for (const { kw, ref } of searches) {
    try {
      await page.goto(ref, { waitUntil: 'domcontentloaded', timeout: 15000 })
      await page.waitForTimeout(1000)

      // Appel API interne (CDI + freelance)
      const data = await page.evaluate(async (keyword) => {
        const url = `https://www.free-work.com/api/job_postings?page=1&itemsPerPage=20&searchKeywords=${keyword}`
        const resp = await fetch(url, { headers: { 'Accept': 'application/json' } })
        if (!resp.ok) return []
        const json = await resp.json()
        return Array.isArray(json) ? json : (json['hydra:member'] || [])
      }, kw)

      for (const item of (data || [])) {
        if (!item.title) continue

        // Garder CDI et freelance (pas les missions courtes type <1 mois)
        const contract = (item.contractType || '').toLowerCase()
        if (contract && contract !== 'permanent' && contract !== 'freelance' && contract !== 'cdi') {
          // skip CDD courts, stages, etc.
          if (contract.includes('intern') || contract.includes('stage')) continue
        }

        const locObj = item.location || {}
        const loc = typeof locObj === 'string' ? locObj : (locObj.locality || locObj.shortLabel || locObj.label || '')

        const isRemote = item.remoteMode === 'full' || item.remoteMode === 'full_remote'

        // Salaire annuel (CDI) ou TJM (freelance)
        let salary = ''
        if (item.minAnnualSalary && item.maxAnnualSalary) {
          salary = `${item.minAnnualSalary}–${item.maxAnnualSalary}€/an`
        } else if (item.minAnnualSalary) {
          salary = `${item.minAnnualSalary}€/an`
        } else if (item.minDailySalary && item.maxDailySalary) {
          salary = `${item.minDailySalary}–${item.maxDailySalary}€/j`
        } else if (item.minDailySalary) {
          salary = `${item.minDailySalary}€/j`
        }

        const jobCatSlug = item.job?.slug || 'jobs'
        const url = item.slug
          ? `https://www.free-work.com/fr/tech-it/${jobCatSlug}/job-mission/${item.slug}`
          : ''
        if (!url) continue

        jobs.push({
          title: item.title,
          company: item.company?.name || '',
          location: loc || (isRemote ? 'Remote' : 'France'),
          salary,
          description: (item.description || '').replace(/<[^>]+>/g, '').slice(0, 300),
          url,
          remote: isRemote ? 1 : 0,
          posted_at: item.publishedAt || '',
          contract_type: contract.includes('permanent') || contract === 'cdi' ? 'CDI' : 'Freelance',
        })
      }
    } catch (err) {
      console.error('[freework]', err.message)
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
