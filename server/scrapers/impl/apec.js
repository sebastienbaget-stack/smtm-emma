// APEC — Playwright + page.evaluate (nécessite les cookies de session du browser)
// L'API APEC requiert des cookies — on les obtient en chargeant la page d'abord

const QUERIES = [
  'chef de projet digital',
  'omnicanal',
  'digital project manager',
  'marketing manager digital',
  'chef de projet e-commerce',
  'responsable e-commerce',
  'CRO manager',
  'conversion manager',
  'digital experience manager',
  'e-commerce manager',
  'responsable expérience digitale',
]

async function scrape(context) {
  const page = await context.newPage()
  const jobs = []

  try {
    // Charger la page pour obtenir les cookies de session
    await page.goto('https://www.apec.fr/candidat/recherche-emploi.html/emploi', {
      waitUntil: 'domcontentloaded', timeout: 18000
    })
    await page.click('button:has-text("Tout accepter"), button:has-text("Accepter tout")').catch(() => {})
    await page.waitForTimeout(2000)

    for (const q of QUERIES) {
      try {
        const data = await page.evaluate(async (motsCles) => {
          const resp = await fetch('https://www.apec.fr/cms/webservices/rechercheOffre', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
              motsCles,
              lieux: [{ codeRegion: '84' }], // Auvergne-Rhône-Alpes
              fonctions: [],
              statutPoste: [], // pas de filtre CDI pour avoir plus de résultats
              typesContrat: [],
              typesConvention: ['143684','143685','143686','143687','143706'],
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
          if (!resp.ok) return null
          return resp.json()
        }, q)

        // Aussi chercher avec télétravail toute France
        const dataRemote = await page.evaluate(async (motsCles) => {
          const resp = await fetch('https://www.apec.fr/cms/webservices/rechercheOffre', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
              motsCles,
              lieux: [],
              fonctions: [],
              statutPoste: [],
              typesContrat: [],
              typesConvention: ['143684','143685','143686','143687','143706'],
              niveauxExperience: [],
              idsEtablissement: [],
              secteursActivite: [],
              typesTeletravail: ['143990'], // Télétravail complet
              idNomZonesDeplacement: [],
              positionNumbersExcluded: [],
              typeClient: 'CADRE',
              sorts: [{ type: 'DATE', direction: 'DESCENDING' }],
              pagination: { startIndex: 0, range: 20 }
            })
          })
          if (!resp.ok) return null
          return resp.json()
        }, q)

        for (const dataset of [data, dataRemote]) {
          for (const r of (dataset?.resultats || [])) {
            if (!r.intitule) continue
            const loc = r.lieuTexte || ''
            const isRemote = loc.toLowerCase().includes('télétravail') ||
                             (r.typesTeletravail || []).length > 0
            jobs.push({
              title: r.intitule.trim(),
              company: r.nomCommercial || r.clientReel || '',
              location: isRemote && !loc ? 'Télétravail' : loc,
              salary: r.salaireTexte || '',
              description: (r.texteOffre || '').replace(/<[^>]+>/g, '').slice(0, 400),
              url: `https://www.apec.fr/candidat/recherche-emploi.html/emploi/${r.numeroOffre}`,
              remote: isRemote ? 1 : 0,
              posted_at: r.datePublication || '',
              contract_type: 'CDI',
            })
          }
        }

        await page.waitForTimeout(400)
      } catch (err) {
        console.error('[apec]', q, err.message)
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
