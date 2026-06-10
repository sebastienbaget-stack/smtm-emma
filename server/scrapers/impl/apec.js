// APEC — API JSON POST
async function scrape(context) {
  const page = await context.newPage()
  const jobs = []

  try {
    await page.goto('https://www.apec.fr/candidat/recherche-emploi.html/emploi?motsCles=chef+de+projet+digital', {
      waitUntil: 'domcontentloaded', timeout: 15000
    })
    await page.click('button:has-text("Tout accepter")').catch(() => {})
    await page.waitForTimeout(1500)

    const queries = [
      'chef de projet digital',
      'omnicanal',
      'digital project manager',
      'marketing manager digital',
      'chef de projet e-commerce',
      'CRO conversion',
    ]

    for (const q of queries) {
      const data = await page.evaluate(async (motsCles) => {
        const resp = await fetch('https://www.apec.fr/cms/webservices/rechercheOffre', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({
            motsCles,
            lieux: [{ label: 'Auvergne-Rhône-Alpes', codeRegion: '84' }],
            fonctions: [],
            statutPoste: ['143810'],  // CDI
            typesContrat: [],
            typesConvention: ['143684', '143685', '143686', '143687', '143706'],
            niveauxExperience: [],
            idsEtablissement: [],
            secteursActivite: [],
            typesTeletravail: [],
            idNomZonesDeplacement: [],
            positionNumbersExcluded: [],
            typeClient: 'CADRE',
            sorts: [{ type: 'DATE', direction: 'DESCENDING' }],
            pagination: { startIndex: 0, range: 20 }
          })
        })
        if (!resp.ok) return { error: resp.status }
        return resp.json()
      }, q)

      if (data?.error) { console.error('[apec] HTTP', data.error); continue }
      const resultats = data?.resultats || []
      for (const r of resultats) {
        if (!r.intitule) continue
        const loc = r.lieuTexte || ''
        const isRemote = loc.toLowerCase().includes('télétravail') || r.typesTeletravail?.length > 0
        jobs.push({
          title: r.intitule.trim(),
          company: r.nomCommercial || r.clientReel || '',
          location: loc,
          salary: r.salaireTexte || '',
          description: (r.texteOffre || '').replace(/<[^>]+>/g, '').slice(0, 300),
          url: `https://www.apec.fr/candidat/recherche-emploi.html/emploi/${r.numeroOffre || r.id}`,
          remote: isRemote ? 1 : 0,
          posted_at: r.datePublication || r.dateValidation || '',
          contract_type: 'CDI',
        })
      }
    }
  } catch (err) {
    console.error('[apec]', err.message)
  }

  await page.close()
  return dedupe(jobs)
}

function dedupe(jobs) {
  const seen = new Set()
  return jobs.filter(j => j.url && j.title && !seen.has(j.url) && seen.add(j.url))
}

module.exports = { scrape }
