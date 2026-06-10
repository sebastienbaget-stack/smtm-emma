// We Work Remotely — DOM scraping, 100% full remote
async function scrape(context) {
  const page = await context.newPage()
  const jobs = []

  const urls = [
    'https://weworkremotely.com/categories/remote-marketing-jobs',
    'https://weworkremotely.com/categories/remote-business-exec-management-jobs',
    'https://weworkremotely.com/categories/remote-sales-jobs',
  ]

  const EMMA_KW = [
    'omnichannel', 'omnicanal', 'ecommerce', 'e-commerce', 'marketing manager',
    'digital project', 'traffic manager', 'cro', 'conversion', 'growth manager',
    'digital manager', 'head of digital',
  ]

  for (const url of urls) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
      await page.waitForTimeout(1500)

      const found = await page.evaluate((kws) => {
        const results = []
        document.querySelectorAll('section.jobs article, li.feature, [class*="job"]').forEach(card => {
          const titleEl = card.querySelector('span.title, h2, h3, [class*="title"]')
          const companyEl = card.querySelector('span.company, [class*="company"]')
          const regionEl = card.querySelector('span.region, [class*="region"], [class*="location"]')
          const linkEl = card.querySelector('a[href*="/remote-jobs/"]')
          if (!titleEl || !linkEl) return
          const title = titleEl.textContent.trim()
          const t = title.toLowerCase()
          if (!kws.some(k => t.includes(k))) return
          results.push({
            title,
            company: companyEl?.textContent?.trim() || '',
            location: regionEl?.textContent?.trim() || 'Remote',
            salary: '',
            description: '',
            url: 'https://weworkremotely.com' + linkEl.getAttribute('href'),
            remote: 1,
            posted_at: '',
            contract_type: 'CDI',
          })
        })
        return results
      }, EMMA_KW)

      jobs.push(...found.filter(j => j.title && j.url))
    } catch (err) {
      console.error('[weworkremotely]', err.message)
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
