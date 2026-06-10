const SOURCES = [
  // ── Grenoble + national ─────────────────────────────────────────────────────
  // Priority 1 — Gros généralistes
  { id: 'linkedin',      name: 'LinkedIn',              priority: 1 },
  { id: 'wttj',          name: 'Welcome to the Jungle', priority: 1 },
  { id: 'indeed',        name: 'Indeed',                priority: 1 },
  // Priority 2 — Cadres spécialisés
  { id: 'apec',          name: 'APEC',                  priority: 2 },
  { id: 'cadremploi',    name: 'Cadremploi',            priority: 2 },
  { id: 'cadresonline',  name: 'Cadresonline',          priority: 2 },
  { id: 'hellowork',     name: 'HelloWork',             priority: 2 },
  // Priority 3 — Job boards complémentaires
  { id: 'monster',       name: 'Monster',               priority: 3 },
  { id: 'jobteaser',     name: 'JobTeaser',             priority: 3 },
  { id: 'figaro',        name: 'Figaro Emploi',         priority: 3 },
  { id: 'francetravail', name: 'France Travail',        priority: 3 },
  { id: 'meteojob',      name: 'Meteojob',              priority: 3 },
  { id: 'jooble',        name: 'Jooble',                priority: 3 },
  { id: 'regionsjob',    name: 'RegionsJob',            priority: 3 },

  // ── Full remote uniquement ──────────────────────────────────────────────────
  // Priority 1 — Plateformes remote-first majeures
  { id: 'remotive',        name: 'Remotive',            priority: 1 },
  { id: 'weworkremotely',  name: 'We Work Remotely',    priority: 1 },
  { id: 'jobgether',       name: 'Jobgether',           priority: 1 },
  { id: 'himalayas',       name: 'Himalayas',           priority: 1 },
  // Priority 2 — Startups / digital remote
  { id: 'talentio',        name: 'talent.io',           priority: 2 },
  { id: 'freework',        name: 'Free-Work',           priority: 2 },
  { id: 'collective',      name: 'Collective',          priority: 2 },
  // Priority 3 — Europe remote
  { id: 'euremotejobs',    name: 'EuroRemoteJobs',      priority: 3 },
]

module.exports = { SOURCES }
