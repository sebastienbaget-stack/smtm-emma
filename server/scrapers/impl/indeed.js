// Indeed FR — avec descriptions et salaires améliorés
async function scrape(context) {
  const page = await context.newPage()
  const jobs = []

  const searches = [
    'https://fr.indeed.com/jobs?q=omnicanal+manager&l=Grenoble&sort=date&fromage=30',
    'https://fr.indeed.com/jobs?q=chef+de+projet+digital&l=Grenoble+(38)&sort=date&fromage=30',
    'https://fr.indeed.com/jobs?q=digital+project+manager&l=Grenoble&sort=date&fromage=30',
    'https://fr.indeed.com/jobs?q=marketing+manager+digital&l=Grenoble&sort=date&fromage=30',
    'https://fr.indeed.com/jobs?q=chef+de+projet+e-commerce&l=Grenoble&sort=date&fromage=30',
    'https://fr.indeed.com/jobs?q=responsable+e-commerce&l=Grenoble&sort=date&fromage=30',
    'https://fr.indeed.com/jobs?q=traffic+manager&l=Grenoble&sort=date&fromage=30',
    'https://fr.indeed.com/jobs?q=responsable+omnicanal&l=Isere&sort=date&fromage=30',
    // Full remote France
    'https://fr.indeed.com/jobs?q=omnichannel+manager&l=France&sc=0kf%3Aattr%28DSQF7%29%3B&sort=date&fromage=30',
    'https://fr.indeed.com/jobs?q=chef+de+projet+digital&l=France&sc=0kf%3Aattr%28DSQF7%29%3B&sort=date&fromage=30',
    'https://fr.indeed.com/jobs?q=CRO+conversion+manager&l=France&sc=0kf%3Aattr%28DSQF7%29%3B&sort=date&fromage=30',
    'https://fr.indeed.com/jobs?q=e-commerce+manager&l=France&sc=0kf%3Aattr%28DSQF7%29%3B&sort=date&fromage=30',
  ]

  for (const url of searches) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })
      await page.waitForTimeout(2000)
      await page.click('button#onetrust-accept-btn-handler, button:has-text("Accepter")').catch(() => {})
      await page.waitForTimeout(500)

      const found = await page.evaluate(() => {
        const results = []

        // JSON-LD sur la page de liste (parfois présent)
        const jsonLdData = {}
        document.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
          try {
            const d = JSON.parse(s.textContent)
            const items = Array.isArray(d) ? d : [d]
            items.forEach(item => {
              if (item['@type'] !== 'JobPosting') return
              const bs = item.baseSalary?.value
              if (bs) {
                let salary = ''
                if (bs.minValue && bs.maxValue) salary = `${Math.round(bs.minValue)}–${Math.round(bs.maxValue)}€/${bs.unitText === 'YEAR' ? 'an' : 'mois'}`
                else if (bs.value) salary = `${Math.round(bs.value)}€/${bs.unitText === 'YEAR' ? 'an' : 'mois'}`
                if (salary && item.url) jsonLdData[item.url] = { salary, description: item.description?.replace(/<[^>]+>/g, '').slice(0, 400) || '' }
              }
            })
          } catch {}
        })

        const cards = document.querySelectorAll('.cardOutline, .tapItem, [data-jk]')
        cards.forEach(card => {
          const jk = card.getAttribute('data-jk') || card.querySelector('[data-jk]')?.getAttribute('data-jk')
          if (!jk) return

          const titleEl = card.querySelector('[id^="jobTitle"], h2 a, [data-testid="job-title"]')
          const companyEl = card.querySelector('[data-testid="company-name"], [class*="companyName"]')
          const locationEl = card.querySelector('[data-testid="text-location"], [class*="companyLocation"]')
          const dateEl = card.querySelector('[class*="date"]')

          // Tous les sélecteurs salary possibles
          let salaryText = ''
          const salarySelectors = [
            '[class*="salary-snippet"]', '[data-testid*="salary"]',
            '[class*="salarySnippet"]', '[class*="estimated-salary"]',
            'div[class*="attribute_snippet"]', '[class*="remuneration"]',
            '[class*="metadata"] svg[aria-label*="alaire"] + span',
          ]
          for (const sel of salarySelectors) {
            const el = card.querySelector(sel)
            if (el?.textContent?.trim()) { salaryText = el.textContent.trim(); break }
          }
          // Scan metadata pour €
          if (!salaryText) {
            card.querySelectorAll('[class*="metadata"], [class*="attribute"]').forEach(el => {
              const t = el.textContent.trim()
              if (/\d.*€|€.*\d/i.test(t) && t.length < 80) salaryText = t
            })
          }

          // Description snippet
          const snippetEl = card.querySelector('[class*="snippet"], [data-testid="snippet"], .job-snippet')
          const snippet = snippetEl?.textContent?.trim() || ''

          if (!titleEl) return
          const loc = locationEl?.textContent?.trim() || ''
          const jobUrl = `https://fr.indeed.com/viewjob?jk=${jk}`
          const ldInfo = jsonLdData[jobUrl] || {}

          results.push({
            title: titleEl.textContent.trim(),
            company: companyEl?.textContent?.trim() || '',
            location: loc,
            salary: salaryText || ldInfo.salary || '',
            description: snippet || ldInfo.description || '',
            url: jobUrl,
            remote: loc.toLowerCase().includes('télétravail') || loc.toLowerCase().includes('remote') ? 1 : 0,
            posted_at: dateEl?.textContent?.trim() || '',
            contract_type: 'CDI',
          })
        })
        return results
      })

      jobs.push(...found.filter(j => j.title && j.url))
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
