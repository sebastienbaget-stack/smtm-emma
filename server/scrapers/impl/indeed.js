// Indeed FR — extraction via JSON embarqué dans la page (plus fiable que DOM)
// Indeed injecte les données jobs dans window.mosaic.providerData

async function scrape(context) {
  const page = await context.newPage()
  const jobs = []

  const searches = [
    { q: 'chef+de+projet+digital',        l: 'Grenoble+(38)' },
    { q: 'omnicanal+manager',             l: 'Grenoble' },
    { q: 'marketing+manager+digital',     l: 'Grenoble' },
    { q: 'responsable+ecommerce',         l: 'Isere' },
    { q: 'digital+project+manager',       l: 'Grenoble' },
    { q: 'cro+manager',                   l: 'Grenoble' },
    { q: 'conversion+manager',            l: 'Grenoble' },
    { q: 'digital+experience+manager',    l: 'Grenoble' },
    { q: 'ecommerce+manager',             l: 'Grenoble' },
    { q: 'omnichannel+manager',           l: 'France',    remote: true },
    { q: 'chef+de+projet+digital',        l: 'France',    remote: true },
    { q: 'ecommerce+manager',             l: 'France',    remote: true },
    { q: 'CRO+manager',                   l: 'France',    remote: true },
    { q: 'conversion+manager',            l: 'France',    remote: true },
    { q: 'digital+experience+manager',    l: 'France',    remote: true },
  ]

  for (const s of searches) {
    try {
      const remoteParam = s.remote ? '&sc=0kf%3Aattr%28DSQF7%29%3B' : ''
      const url = `https://fr.indeed.com/jobs?q=${s.q}&l=${encodeURIComponent(s.l)}&sort=date&fromage=30${remoteParam}`
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })
      await page.waitForTimeout(2500)
      await page.click('#onetrust-accept-btn-handler, button:has-text("Accepter")').catch(() => {})
      await page.waitForTimeout(500)

      const found = await page.evaluate(() => {
        // 1. Tenter d'extraire depuis le JSON embarqué (plus fiable)
        const scripts = document.querySelectorAll('script')
        let jsonJobs = null
        for (const s of scripts) {
          const txt = s.textContent || ''
          if (txt.includes('mosaic-provider-jobcards') && txt.includes('"results"')) {
            try {
              const match = txt.match(/window\.mosaic\.providerData\["mosaic-provider-jobcards"\]=({[\s\S]*?});/)
              if (match) {
                const data = JSON.parse(match[1])
                jsonJobs = data?.metaData?.mosaicProviderJobCardsModel?.results || data?.results || null
              }
            } catch {}
            if (jsonJobs) break
          }
        }

        if (jsonJobs && jsonJobs.length > 0) {
          return jsonJobs.map(j => {
            const loc = j.jobLocationModel?.displayLocation || j.formattedLocation || ''
            const salary = j.estimatedSalary
              ? `${j.estimatedSalary.min || '?'}–${j.estimatedSalary.max || '?'}€/${j.estimatedSalary.type === 'YEARLY' ? 'an' : 'mois'}`
              : j.salarySnippet?.text || ''
            return {
              title: j.normTitle || j.title || '',
              company: j.company || '',
              location: loc,
              salary,
              description: (j.snippet || '').replace(/<[^>]+>/g, '').slice(0, 400),
              url: j.isSponsoredJob !== undefined && j.jobkey
                ? `https://fr.indeed.com/viewjob?jk=${j.jobkey}`
                : '',
              remote: (loc.toLowerCase().includes('télétravail') || loc.toLowerCase().includes('remote')) ? 1 : 0,
              posted_at: j.pubDate ? new Date(j.pubDate).toISOString() : '',
              contract_type: 'CDI',
            }
          }).filter(j => j.title && j.url)
        }

        // 2. Fallback DOM si le JSON n'est pas disponible
        const results = []
        document.querySelectorAll('[data-jk]').forEach(card => {
          const jk = card.getAttribute('data-jk') || card.querySelector('[data-jk]')?.getAttribute('data-jk')
          if (!jk) return
          const titleEl = card.querySelector('[id^="jobTitle"], h2 a')
          const companyEl = card.querySelector('[data-testid="company-name"]')
          const locationEl = card.querySelector('[data-testid="text-location"]')
          const salaryEl = card.querySelector('[class*="salary"], [data-testid*="salary"]')
          const snippetEl = card.querySelector('[class*="snippet"]')
          if (!titleEl) return
          const loc = locationEl?.textContent?.trim() || ''
          results.push({
            title: titleEl.textContent.trim(),
            company: companyEl?.textContent?.trim() || '',
            location: loc,
            salary: salaryEl?.textContent?.trim() || '',
            description: snippetEl?.textContent?.trim() || '',
            url: `https://fr.indeed.com/viewjob?jk=${jk}`,
            remote: loc.toLowerCase().includes('télétravail') || loc.toLowerCase().includes('remote') ? 1 : 0,
            posted_at: '',
            contract_type: 'CDI',
          })
        })
        return results
      })

      jobs.push(...(found || []).filter(j => j.title && j.url))
    } catch (err) {
      console.error('[indeed]', err.message)
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
