// Génération de résumé IA d'une offre — Claude Haiku (rapide + économique)
// Les résumés sont mis en cache dans la DB pour éviter les appels répétés

const Anthropic = require('@anthropic-ai/sdk')
const { load, save } = require('./db/database')

// On expose load/save depuis database.js (sinon on accède direct au cache)
// Pour éviter le couplage, on stocke les résumés dans un fichier séparé
const fs = require('fs')
const path = require('path')
const SUMMARIES_PATH = path.join(__dirname, '../emma-summaries.json')

function loadSummaries() {
  if (fs.existsSync(SUMMARIES_PATH)) {
    try { return JSON.parse(fs.readFileSync(SUMMARIES_PATH, 'utf8')) } catch {}
  }
  return {}
}

function saveSummaries(data) {
  fs.writeFileSync(SUMMARIES_PATH, JSON.stringify(data, null, 2))
}

async function generateSummary(job) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return null // Pas de clé API configurée
  }

  // Vérifier le cache
  const cache = loadSummaries()
  const cacheKey = String(job.id || job.url)
  if (cache[cacheKey]) return cache[cacheKey]

  const client = new Anthropic()

  const jobText = [
    `Poste : ${job.title}`,
    job.company ? `Entreprise : ${job.company}` : null,
    job.location ? `Lieu : ${job.location}` : null,
    job.salary ? `Salaire : ${job.salary}` : null,
    job.description ? `Description : ${job.description.slice(0, 600)}` : null,
  ].filter(Boolean).join('\n')

  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Tu es une assistante de recherche d'emploi. Résume cette offre en exactement 3 bullet points ultra-courts (max 12 mots chacun), en français. Format strict :
• [périmètre / missions clés]
• [conditions : lieu, remote, salaire si connu]
• [point différenciant ou environnement]

Offre :
${jobText}

Réponds UNIQUEMENT avec les 3 bullet points, rien d'autre.`,
      }],
    })

    const text = msg.content[0]?.text?.trim() || null
    if (text) {
      cache[cacheKey] = text
      saveSummaries(cache)
    }
    return text
  } catch (err) {
    console.error('[summary] Erreur API:', err.message)
    return null
  }
}

module.exports = { generateSummary }
