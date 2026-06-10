const fs = require('fs')
const path = require('path')

const DB_PATH = path.join(__dirname, '../../emma-db.json')
let _cache = null

function load() {
  if (_cache) return _cache
  if (fs.existsSync(DB_PATH)) {
    try { _cache = JSON.parse(fs.readFileSync(DB_PATH, 'utf8')) } catch { _cache = { jobs: [], nextId: 1 } }
  } else {
    _cache = { jobs: [], nextId: 1 }
  }
  return _cache
}

function save() {
  fs.writeFileSync(DB_PATH, JSON.stringify(_cache, null, 2))
}

function initDB() { load(); return true }

function normalizeDate(dateStr) {
  if (!dateStr) return null
  const s = (dateStr || '').toLowerCase().trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (s.includes('aujourd') || s.includes('today')) return today.toISOString()
  if (s.includes('hier') || s.includes('yesterday')) {
    const d = new Date(today); d.setDate(d.getDate() - 1); return d.toISOString()
  }
  const match = s.match(/il y a\s+(\d+)\s*(heure|jour|semaine|mois|an)/i) ||
                s.match(/(\d+)\s*(hour|day|week|month|year)s?\s*ago/i)
  if (match) {
    const n = parseInt(match[1])
    const unit = (match[2] || '').toLowerCase()
    const d = new Date(today)
    if (unit.startsWith('heur')) d.setHours(d.getHours() - n)
    else if (unit.startsWith('jour') || unit === 'd' || unit === 'day') d.setDate(d.getDate() - n)
    else if (unit.startsWith('sem') || unit === 'week') d.setDate(d.getDate() - n * 7)
    else if (unit.startsWith('mois') || unit === 'month') d.setMonth(d.getMonth() - n)
    else if (unit.startsWith('an') || unit === 'year') d.setFullYear(d.getFullYear() - n)
    return d.toISOString()
  }
  if (s.includes('mois')) { const d = new Date(today); d.setMonth(d.getMonth() - 1); return d.toISOString() }
  if (s.includes('semaine')) { const d = new Date(today); d.setDate(d.getDate() - 7); return d.toISOString() }
  try { const p = new Date(dateStr); if (!isNaN(p)) return p.toISOString() } catch {}
  return null
}

// ── Mots-clés POSITIFS (au moins un doit matcher dans le titre) ──────────────
const JOB_KEYWORDS = [
  'omnicanal', 'omnichannel', 'omni-canal', 'omni-channel',
  'chef de projet digital', 'cheffe de projet digital',
  'chef de projet web', 'cheffe de projet web',
  'chef de projet e-commerce', 'cheffe de projet e-commerce',
  'chef de projet ecommerce',
  'digital project manager',
  'web project manager',
  'marketing manager',
  'responsable marketing digital',
  'responsable e-commerce',
  'responsable ecommerce',
  'responsable omnicanal',
  'digital manager',
  'e-commerce manager',
  'ecommerce manager',
  'traffic manager',
  'acquisition manager',
  'cro manager',
  'conversion rate',
  'growth manager',
  'growth hacker',
  'head of digital',
  'head of e-commerce',
  'directeur digital',
  'directrice digitale',
  'directeur e-commerce',
]

// ── Filtre géographique ──────────────────────────────────────────────────────
// Règle :
//   - Zone Grenoble (≤20km) : TOUT mode de travail accepté
//   - Hors Grenoble : FULL remote uniquement (hybride/partiel = refusé)
const GRENOBLE_AREA = [
  'grenoble', 'isère', 'isere', '(38)', '38000', '38100', '38130',
  'meylan', 'échirolles', 'echirolles', 'gières', 'gieres',
  'seyssinet', 'crolles', 'domène', 'domene', 'saint-égrève', 'saint-egreve',
  'claix', 'vizille', 'voreppe', 'sassenage', 'fontaine',
  'poisat', 'saint-martin-d\'hères', 'saint martin d\'hères',
  'auvergne-rhône-alpes', 'auvergne rhône alpes', 'auvergne-rhone-alpes',
]

// Full remote uniquement (hybride et partiel exclus)
const FULL_REMOTE_KEYWORDS = [
  'full remote', 'full-remote', '100% remote', '100% télétravail',
  '100% teletravail', 'full télétravail', 'entièrement remote',
  'entièrement à distance', 'remote only', 'remote first',
]

// Mots qui indiquent du remote PARTIEL → ne compte pas pour hors-Grenoble
const PARTIAL_REMOTE_KEYWORDS = [
  'télétravail partiel', 'teletravail partiel',
  'hybride', 'hybrid', 'partiel',
  '1 jour', '2 jour', '3 jour', '4 jour',
  'jours par semaine', 'j/semaine',
]

// Grandes villes hors zone Grenoble
const FAR_CITIES = [
  'paris', 'île-de-france', 'ile-de-france', '75000', '75001', '75002',
  'boulogne-billancourt', 'neuilly', 'levallois', 'courbevoie', 'puteaux',
  'issy-les-moulineaux', 'vincennes', 'saint-denis', 'pantin', 'montreuil',
  'lyon', 'marseille', 'toulouse', 'bordeaux', 'nantes', 'lille',
  'strasbourg', 'rennes', 'montpellier', 'nice', 'toulon',
  'rouen', 'reims', 'dijon', 'angers', 'clermont-ferrand', 'limoges',
  'nancy', 'caen', 'metz', 'perpignan', 'brest', 'le havre',
  'saint-étienne', 'saint etienne', 'tours', 'amiens', 'poitiers',
  'chambéry', 'chambery', 'annecy', 'valence', 'gap', 'albertville',
  'london', 'amsterdam', 'brussels', 'bruxelles', 'madrid', 'berlin',
  'birmingham', 'toronto', 'montreal', 'ottawa', 'zürich', 'zurich', 'genève', 'geneve',
  'luxembourg', 'dubai', 'new york', 'san francisco', 'lisbon', 'lisbonne',
  'arras', 'dreux', 'benfeld', 'colmar', 'mulhouse', 'metz', 'thionville',
  'besançon', 'besancon', 'belfort', 'épinal', 'epinal',
  'pau', 'bayonne', 'biarritz', 'tarbes', 'auch',
  'orléans', 'orleans', 'chartres', 'blois',
  'nîmes', 'nimes', 'avignon', 'aix-en-provence', 'arles',
  'bayeux', 'cherbourg', 'laval', 'le mans', 'alençon',
]

function isLocationOk(job) {
  const loc = (job.location || '').toLowerCase()

  // Localisation vide → garder (on ne peut pas décider)
  if (!loc || loc.trim() === '' || loc === 'france' || loc === 'fr' || loc === 'france entière') {
    return true
  }

  // Zone Grenoble → toujours OK (remote ou pas)
  if (GRENOBLE_AREA.some(k => loc.includes(k))) return true

  // Full remote explicite → OK même hors Grenoble
  if (FULL_REMOTE_KEYWORDS.some(k => loc.includes(k))) return true

  // job.remote=1 positionné par le scraper, mais vérifier que ce n'est pas partiel
  if (job.remote === 1) {
    // Si la localisation contient "partiel" ou "hybride", c'est pas full remote
    if (PARTIAL_REMOTE_KEYWORDS.some(k => loc.includes(k))) return false
    // Si c'est une ville hors Grenoble, vérifier que c'est vraiment remote
    if (FAR_CITIES.some(k => loc.includes(k))) {
      // remote=1 sur une ville connue = suspect, rejeter
      return false
    }
    return true
  }

  // Télétravail dans la localisation mais pas forcément full
  if (loc.includes('télétravail') || loc.includes('teletravail') || loc.includes('remote')) {
    // Si c'est partiel sur une ville lointaine → rejeter
    if (PARTIAL_REMOTE_KEYWORDS.some(k => loc.includes(k))) {
      if (FAR_CITIES.some(k => loc.includes(k))) return false
    }
    // Si c'est full remote sans ville connue → OK
    if (!FAR_CITIES.some(k => loc.includes(k))) return true
    // Télétravail sur ville lointaine : accepter seulement si full
    return FULL_REMOTE_KEYWORDS.some(k => loc.includes(k))
  }

  // Grande ville hors zone → rejeter
  if (FAR_CITIES.some(k => loc.includes(k))) return false

  // Localisation inconnue/ambiguë → garder par défaut
  return true
}

// ── Mots-clés NÉGATIFS dans le titre → exclure l'offre ──────────────────────
const EXCLUDE_IN_TITLE = [
  // Contrats non CDI
  'alternance', 'alternant', 'alternante', 'apprentissage', 'apprenti', 'apprentie',
  'stage', 'stagiaire', 'contrat pro', 'professionnalisation',
  ' cdd', '(cdd)', '- cdd', 'en cdd',
  // Catégories de postes hors scope
  'conseiller', 'conseillère',
  'vendeur', 'vendeuse',
  'commercial', 'commerciale',
  'technicien', 'technicienne',
  'assistant', 'assistante',
  'analyste',
  'data analyst',
  'ingénieur', 'ingénieure',
  'développeur', 'développeuse', 'developer',
  'graphiste', 'infographiste',
  'comptable', 'juriste',
  // Temps partiel
  'temps partiel', 'mi-temps', 'temps réduit',
  '20h/semaine', '24h/semaine', '25h/semaine', '30h/semaine',
  '20h semaine', '24h semaine', '25h semaine',
  'mi temps',
  // Formation
  'master ', 'bachelor ', 'bac+', 'mba ',
  // Géo hors scope si explicitement mentionné ailleurs
]

// ── Titres qui commencent par des mots exclus ────────────────────────────────
const EXCLUDE_TITLE_STARTS = [
  'conseiller', 'conseillère',
  'vendeur', 'vendeuse',
  'commercial ', 'commerciale ',
  'assistant ', 'assistante ',
  'technicien', 'technicienne',
  'développeur', 'développeuse',
  'graphiste',
  'chargé de', 'chargée de',   // souvent trop junior
]

function matchesJobKeywords(title) {
  if (!title) return false
  const t = title.toLowerCase()
  return JOB_KEYWORDS.some(kw => t.includes(kw))
}

function isExcluded(title) {
  if (!title) return false
  const t = title.toLowerCase().trim()
  // Titre commence par un mot exclu
  if (EXCLUDE_TITLE_STARTS.some(kw => t.startsWith(kw))) return true
  // Titre contient un mot exclu
  if (EXCLUDE_IN_TITLE.some(kw => t.includes(kw))) return true
  return false
}

// ── Filtre salaire minimum ────────────────────────────────────────────────────
// Si le salaire est précisé et clairement sous 45k → exclure
function parseSalaryMax(salaryStr) {
  if (!salaryStr) return null
  const s = salaryStr.toLowerCase().replace(/\s/g, '')
  // Extraire tous les nombres
  const nums = []
  // Format "26000€à36000€" ou "26 000 - 36 000" etc.
  const matches = s.match(/[\d]+[.,]?[\d]*/g) || []
  matches.forEach(m => {
    let n = parseFloat(m.replace(',', '.'))
    // Si le nombre est en milliers (< 500 et contient 'k'), multiplier
    if (s.includes('k') && n < 500) n *= 1000
    // Si le nombre semble être en milliers annuels (30–150k range)
    if (n >= 20 && n <= 500) n *= 1000  // "30" → 30000
    if (n >= 20000) nums.push(n)
  })
  return nums.length > 0 ? Math.max(...nums) : null
}

function isSalaryOk(salary) {
  if (!salary || salary.trim() === '') return true // inconnu → garder
  const max = parseSalaryMax(salary)
  if (max === null) return true // pas parseable → garder
  // Si le max est clairement sous 45k → exclure
  return max >= 45000
}

function getJobs(filters = {}) {
  const db = load()
  let jobs = db.jobs

  if (filters.jobOnly !== false) jobs = jobs.filter(j => matchesJobKeywords(j.title))
  jobs = jobs.filter(j => !isExcluded(j.title))
  jobs = jobs.filter(j => isLocationOk(j))
  jobs = jobs.filter(j => isSalaryOk(j.salary))

  if (filters.status) jobs = jobs.filter(j => j.status === filters.status)
  if (filters.source) jobs = jobs.filter(j => j.source === filters.source)
  if (filters.remote !== undefined && filters.remote !== null && filters.remote !== '') {
    const r = filters.remote === '1' || filters.remote === true || filters.remote === 1
    jobs = jobs.filter(j => (j.remote ? 1 : 0) === (r ? 1 : 0))
  }
  if (filters.search) {
    const s = filters.search.toLowerCase()
    jobs = jobs.filter(j => j.title?.toLowerCase().includes(s) || j.company?.toLowerCase().includes(s))
  }
  if (filters.dateFrom) {
    const cutoff = new Date(filters.dateFrom)
    jobs = jobs.filter(j => {
      const d = j.posted_at ? new Date(j.posted_at) : new Date(j.scraped_at)
      return d >= cutoff
    })
  }

  return [...jobs].sort((a, b) => {
    const da = a.posted_at ? new Date(a.posted_at) : new Date(a.scraped_at)
    const db2 = b.posted_at ? new Date(b.posted_at) : new Date(b.scraped_at)
    return db2 - da
  })
}

function upsertJob(job) {
  // ── Rejet immédiat si hors zone et pas full remote ──
  if (!isLocationOk(job)) return false
  const db = load()
  const idx = db.jobs.findIndex(j => j.url === job.url)
  const normalizedDate = normalizeDate(job.posted_at)
  const salaryMissing = !job.salary || job.salary.trim() === ''

  if (idx >= 0) {
    db.jobs[idx] = {
      ...db.jobs[idx],
      title: job.title, company: job.company, location: job.location,
      remote: job.remote, description: job.description,
      salary: job.salary, salary_missing: salaryMissing,
      posted_at: normalizedDate, scraped_at: new Date().toISOString(),
      source_priority: job.source_priority,
    }
    save(); return false
  }

  db.jobs.push({
    id: db.nextId++,
    external_id: job.external_id || null,
    source: job.source,
    source_priority: job.source_priority || 3,
    title: job.title,
    company: job.company || null,
    location: job.location || null,
    remote: job.remote ? 1 : 0,
    url: job.url,
    description: job.description || null,
    salary: job.salary || null,
    salary_missing: salaryMissing,
    posted_at: normalizedDate || null,
    scraped_at: new Date().toISOString(),
    status: 'new',
    is_new: 1,
    contract_type: job.contract_type || 'CDI',
  })
  save(); return true
}

function updateJobStatus(id, status) {
  const db = load()
  const job = db.jobs.find(j => j.id === id)
  if (job) { job.status = status; job.is_new = 0; save() }
  return true
}

function getStats() {
  const db = load()
  const jobs = db.jobs
  const total = jobs.length
  const newJobs = jobs.filter(j => j.is_new).length
  const salaryMissing = jobs.filter(j => j.salary_missing).length
  const sourceMap = {}
  jobs.forEach(j => { sourceMap[j.source] = (sourceMap[j.source] || 0) + 1 })
  const bySource = Object.entries(sourceMap).map(([source, n]) => ({ source, n })).sort((a, b) => b.n - a.n)
  const statusMap = {}
  jobs.forEach(j => { statusMap[j.status] = (statusMap[j.status] || 0) + 1 })
  const byStatus = Object.entries(statusMap).map(([status, n]) => ({ status, n }))
  return { total, newJobs, salaryMissing, bySource, byStatus }
}

module.exports = { initDB, getJobs, upsertJob, updateJobStatus, getStats }
