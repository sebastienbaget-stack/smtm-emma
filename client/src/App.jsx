import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Search, RefreshCw, ExternalLink, MapPin, Wifi,
  CheckCircle, XCircle, Star, Send, ChevronLeft,
  SlidersHorizontal, X, AlertCircle, Clock, Bell, BellOff
} from 'lucide-react'
import WolfIcon from './WolfIcon.jsx'

// ─── API ──────────────────────────────────────────────────────────────────────
const API = {
  getJobs: (params = {}) => {
    const q = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== undefined))
    )
    return fetch('/api/jobs?' + q).then(r => r.json())
  },
  getStats: () => fetch('/api/jobs/stats').then(r => r.json()),
  updateStatus: (id, status) =>
    fetch(`/api/jobs/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }).then(r => r.json()),
  generateLetter: (job) =>
    fetch('/api/apply/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job }),
    }).then(r => r.json()),
  getVapidKey: () => fetch('/api/push/vapid-key').then(r => r.json()),
  pushSubscribe: (sub) =>
    fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: sub }),
    }),
}

async function startScrapingSSE(onProgress) {
  const resp = await fetch('/api/scrape/start', { method: 'POST' })
  if (!resp.ok) throw new Error(await resp.text())
  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6))
          if (data.type === 'progress') onProgress?.(data)
          else if (data.type === 'done') return data
          else if (data.type === 'error') throw new Error(data.error)
        } catch {}
      }
    }
  }
}

// ─── Push ─────────────────────────────────────────────────────────────────────
function b64ToUint8(b64) {
  const pad = '='.repeat((4 - b64.length % 4) % 4)
  const base64 = (b64 + pad).replace(/-/g, '+').replace(/_/g, '/')
  return new Uint8Array([...atob(base64)].map(c => c.charCodeAt(0)))
}

async function registerPush() {
  const reg = await navigator.serviceWorker.ready
  const { publicKey } = await API.getVapidKey()
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(publicKey) })
  await API.pushSubscribe(sub.toJSON())
  return sub
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}))
}

// ─── Constantes ───────────────────────────────────────────────────────────────
const STATUS = {
  new:        { label: 'Nouveau',    color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  seen:       { label: 'Vu',         color: 'bg-zinc-800 text-zinc-400 border-zinc-700' },
  interested: { label: 'Peut-être',  color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  applied:    { label: 'Postulée',   color: 'bg-violet-500/20 text-violet-300 border-violet-500/30' },
  rejected:   { label: 'Ignorée',    color: 'bg-red-500/15 text-red-400 border-red-500/20' },
}

// Full remote seulement (pas hybride/partiel)
function isFullRemote(job) {
  const loc = (job.location || '').toLowerCase()
  const FULL = ['full remote', '100% remote', '100% télétravail', 'remote only', 'entièrement remote']
  const PARTIAL = ['partiel', 'hybride', 'hybrid', 'jours/semaine', 'j/semaine']
  if (PARTIAL.some(k => loc.includes(k))) return false
  if (FULL.some(k => loc.includes(k))) return true
  if (job.remote === 1 && loc === 'remote') return true
  if (job.remote === 1 && !loc) return true
  return false
}

function formatDate(s) {
  if (!s) return null
  try {
    const d = new Date(s)
    if (isNaN(d)) return null
    const diff = Math.floor((Date.now() - d) / 86400000)
    if (diff === 0) return "aujourd'hui"
    if (diff === 1) return 'hier'
    if (diff < 7) return `${diff}j`
    if (diff < 30) return `${Math.floor(diff / 7)}sem`
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  } catch { return null }
}

// ─── Bell ─────────────────────────────────────────────────────────────────────
function PushButton() {
  const [state, setState] = useState('idle')
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) { setState('unsupported'); return }
    navigator.serviceWorker.ready.then(r => r.pushManager.getSubscription()).then(sub => setState(sub ? 'on' : 'idle')).catch(() => {})
  }, [])
  const toggle = async () => {
    if (state === 'on') {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) await sub.unsubscribe()
      setState('idle'); return
    }
    setState('requesting')
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') { setState('idle'); return }
      await registerPush(); setState('on')
    } catch { setState('idle') }
  }
  if (state === 'unsupported') return null
  return (
    <button onClick={toggle} className={`w-11 h-11 flex items-center justify-center rounded-full ${state === 'on' ? 'text-violet-400' : 'text-zinc-500 active:text-white'}`}>
      {state === 'requesting' ? <RefreshCw className="w-5 h-5 animate-spin" /> : state === 'on' ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
    </button>
  )
}

// ─── Stats pills ──────────────────────────────────────────────────────────────
function StatsRow({ stats, newCount }) {
  if (!stats) return <div className="h-3" />
  const applied = stats.byStatus?.find(s => s.status === 'applied')?.n ?? 0
  return (
    <div className="flex gap-2 px-4 pb-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
      {[
        { label: 'Total',        value: stats.total,        dot: 'bg-zinc-500' },
        { label: 'Nouvelles',    value: newCount,           dot: 'bg-emerald-400' },
        { label: 'Sans salaire', value: stats.salaryMissing,dot: 'bg-amber-400' },
        { label: 'Postulées',    value: applied,            dot: 'bg-violet-400' },
      ].map(({ label, value, dot }) => (
        <div key={label} className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-full px-3 py-1.5 shrink-0">
          <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
          <span className="text-xs text-zinc-500">{label}</span>
          <span className="text-xs font-bold text-white">{value ?? '–'}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Job Card ─────────────────────────────────────────────────────────────────
function JobCard({ job, onClick }) {
  const st = STATUS[job.status] || STATUS.new
  const date = formatDate(job.posted_at || job.scraped_at)
  return (
    <button onClick={() => onClick(job)} className="w-full text-left bg-zinc-900 border border-zinc-800 rounded-2xl p-4 active:bg-zinc-800 transition-colors">
      <div className="flex items-start gap-2 mb-1">
        <span className="font-semibold text-white leading-snug flex-1 text-base">{job.title}</span>
        {job.is_new === 1 && <span className="shrink-0 bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none mt-1">NEW</span>}
      </div>
      {job.company && <p className="text-sm text-zinc-400 mb-2.5">{job.company}</p>}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3">
        {job.location && (
          <span className="flex items-center gap-1 text-xs text-zinc-500">
            <MapPin className="w-3 h-3 shrink-0" />{job.location}
          </span>
        )}
        {isFullRemote(job) && (
          <span className="flex items-center gap-1 text-xs text-violet-400">
            <Wifi className="w-3 h-3 shrink-0" />Remote
          </span>
        )}
        {job.salary
          ? <span className="text-xs text-emerald-400 font-semibold">{job.salary}</span>
          : <span className="flex items-center gap-1 text-xs text-amber-500/80"><AlertCircle className="w-3 h-3 shrink-0" />Salaire non précisé</span>
        }
      </div>
      <div className="flex items-center justify-between">
        <span className={`text-[11px] px-2.5 py-1 rounded-full border font-medium ${st.color}`}>{st.label}</span>
        <span className="text-xs text-zinc-600">{date ? `${date} · ` : ''}{job.source}</span>
      </div>
    </button>
  )
}

// ─── Scraping progress ────────────────────────────────────────────────────────
function ScrapeProgress({ progress }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2">
      <p className="text-sm font-semibold flex items-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin text-violet-400" />Scraping en cours…
      </p>
      <div className="space-y-1 max-h-32 overflow-y-auto">
        {progress.map((p, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className={p.status === 'done' ? 'text-emerald-400' : p.status === 'error' ? 'text-red-400' : p.status === 'running' ? 'text-amber-400' : 'text-zinc-700'}>
              {p.status === 'done' ? '✓' : p.status === 'error' ? '✗' : p.status === 'running' ? '…' : '–'}
            </span>
            <span className="text-zinc-400 flex-1">{p.source}</span>
            {p.status === 'done' && <span className="text-zinc-600">{p.new} new</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Job Detail — page complète ───────────────────────────────────────────────
function JobDetail({ job, onBack, onStatusChange }) {
  const [letter, setLetter] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const generate = async () => {
    setLoading(true)
    try { const { letter: l } = await API.generateLetter(job); setLetter(l) } catch {}
    setLoading(false)
  }

  const copy = () => { navigator.clipboard.writeText(letter); setCopied(true); setTimeout(() => setCopied(false), 2000) }

  return (
    <div className="fixed inset-0 z-40 bg-[#0a0a0a] flex flex-col">
      {/* Nav bar */}
      <div className="flex items-center px-2 py-2 border-b border-zinc-800/60" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        <button onClick={onBack} className="flex items-center gap-1 px-2 py-2 text-violet-400 active:text-violet-200 rounded-xl active:bg-zinc-800/60 min-w-[80px]">
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Retour</span>
        </button>
        <span className="flex-1 text-center text-sm text-zinc-500 truncate">{job.source}</span>
        <a href={job.url} target="_blank" rel="noreferrer" className="p-2 text-zinc-500 active:text-white min-w-[44px] flex justify-center">
          <ExternalLink className="w-5 h-5" />
        </a>
      </div>

      {/* Scroll content */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="px-4 py-5 space-y-4 max-w-lg mx-auto">

          <div>
            <h1 className="text-2xl font-bold leading-tight mb-1">{job.title}</h1>
            {job.company && <p className="text-zinc-400 text-base">{job.company}</p>}
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2">
            {job.location && (
              <span className="flex items-center gap-1.5 text-sm text-zinc-300 bg-zinc-800 px-3 py-1.5 rounded-full">
                <MapPin className="w-3.5 h-3.5 text-zinc-500 shrink-0" />{job.location}
              </span>
            )}
            {isFullRemote(job) && (
              <span className="flex items-center gap-1.5 text-sm text-violet-300 bg-violet-500/10 border border-violet-500/20 px-3 py-1.5 rounded-full">
                <Wifi className="w-3.5 h-3.5 shrink-0" />Remote
              </span>
            )}
            {(() => { const d = formatDate(job.posted_at || job.scraped_at); return d ? (
              <span className="flex items-center gap-1.5 text-sm text-zinc-400 bg-zinc-800 px-3 py-1.5 rounded-full">
                <Clock className="w-3.5 h-3.5 text-zinc-500 shrink-0" />{d}
              </span>
            ) : null })()}
          </div>

          {/* Salary */}
          {job.salary ? (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-4 py-3.5">
              <p className="text-xs text-emerald-500/70 uppercase tracking-wide mb-0.5">Salaire</p>
              <p className="text-emerald-300 font-bold text-xl">{job.salary}</p>
            </div>
          ) : (
            <div className="bg-amber-500/8 border border-amber-500/20 rounded-2xl px-4 py-3.5 flex gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-300 font-medium text-sm">Salaire non précisé</p>
                <p className="text-amber-600 text-xs mt-0.5">À demander lors de l'entretien (objectif : 45k+)</p>
              </div>
            </div>
          )}

          {/* Description */}
          {job.description && (
            <div className="bg-zinc-900 rounded-2xl p-4">
              <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2.5">Description</p>
              <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line">{job.description}</p>
            </div>
          )}

          {/* Bouton postuler */}
          <a
            href={job.url}
            target="_blank"
            rel="noreferrer"
            className="w-full flex items-center justify-center gap-2 bg-zinc-100 active:bg-zinc-300 text-black font-semibold py-4 rounded-2xl text-base"
          >
            <ExternalLink className="w-4 h-4" />
            Voir l'annonce et postuler
          </a>

          {/* Lettre */}
          <button onClick={generate} disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-violet-600 active:bg-violet-700 disabled:opacity-50 text-white font-semibold py-4 rounded-2xl text-base">
            <Send className="w-4 h-4" />
            {loading ? 'Génération…' : 'Générer ma lettre de motivation'}
          </button>

          {letter && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
              <p className="text-xs text-zinc-500 uppercase tracking-wide">Lettre de motivation</p>
              <pre className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap font-sans">{letter}</pre>
              <button onClick={copy} className="w-full py-3 text-sm text-violet-400 active:text-violet-200 border border-violet-500/30 rounded-xl">
                {copied ? '✓ Copié !' : 'Copier'}
              </button>
            </div>
          )}

          <div className="h-4" />
        </div>
      </div>

      {/* Decision bar */}
      <div className="border-t border-zinc-800 px-4 pt-3" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
        <p className="text-xs text-zinc-600 text-center mb-3">Ma décision</p>
        <div className="grid grid-cols-3 gap-2 max-w-lg mx-auto">
          {[
            { key: 'rejected',   label: 'Ignorer',    icon: <XCircle className="w-5 h-5" />,      color: 'red' },
            { key: 'interested', label: 'Peut-être',  icon: <Star className="w-5 h-5" />,          color: 'amber' },
            { key: 'applied',    label: 'Postulée',   icon: <CheckCircle className="w-5 h-5" />,   color: 'violet' },
          ].map(({ key, label, icon, color }) => (
            <DecisionBtn key={key} label={label} icon={icon} color={color} active={job.status === key} onPress={() => onStatusChange(job, key)} />
          ))}
        </div>
      </div>
    </div>
  )
}

function DecisionBtn({ label, icon, color, active, onPress }) {
  const styles = {
    red:    active ? 'bg-red-500 text-white border-red-500'       : 'bg-zinc-900 border-zinc-800 text-red-400 active:bg-red-500/10',
    amber:  active ? 'bg-amber-500 text-white border-amber-500'   : 'bg-zinc-900 border-zinc-800 text-amber-400 active:bg-amber-500/10',
    violet: active ? 'bg-violet-600 text-white border-violet-600' : 'bg-zinc-900 border-zinc-800 text-violet-400 active:bg-violet-500/10',
  }
  return (
    <button onClick={onPress} className={`flex flex-col items-center gap-1.5 py-3.5 rounded-2xl border transition-colors ${styles[color]}`}>
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </button>
  )
}

// ─── Page Filtres ─────────────────────────────────────────────────────────────
function FilterPage({ filters, setFilters, sources, onClose }) {
  const [local, setLocal] = useState(filters)
  const apply = () => { setFilters(local); onClose() }
  const reset = () => setLocal({ status: '', remote: '', source: '', dateRange: '30', salary: '' })
  const activeCount = Object.entries(local).filter(([k, v]) => v !== '' && !(k === 'dateRange' && v === '30')).length

  const Chip = ({ label, active, onClick }) => (
    <button onClick={onClick} className={`px-4 py-2.5 rounded-2xl border text-sm font-medium min-h-[44px] transition-colors ${
      active ? 'bg-white text-black border-white' : 'border-zinc-800 text-zinc-400 bg-zinc-900 active:border-zinc-600 active:text-white'
    }`}>{label}</button>
  )

  const Section = ({ label, note, children }) => (
    <div>
      <p className="text-sm font-semibold text-white mb-1">{label}</p>
      {note && <p className="text-xs text-zinc-500 mb-2.5">{note}</p>}
      {!note && <div className="mb-2.5" />}
      {children}
    </div>
  )

  return (
    <div className="fixed inset-0 z-40 bg-[#0a0a0a] flex flex-col">
      {/* Nav */}
      <div className="flex items-center px-2 py-2 border-b border-zinc-800/60" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        <button onClick={onClose} className="flex items-center gap-1 px-2 py-2 text-violet-400 active:text-violet-200 rounded-xl active:bg-zinc-800/60 min-w-[80px]">
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Retour</span>
        </button>
        <span className="flex-1 text-center font-semibold text-white">Filtres</span>
        <button onClick={reset} className="px-3 py-2 text-sm text-zinc-500 active:text-white min-w-[80px] text-right">
          Réinitialiser
        </button>
      </div>

      {/* Contenu */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-6 space-y-8 max-w-lg mx-auto w-full">

        <Section label="Type de contrat" note="Emma cherche uniquement des CDI.">
          <div className="flex flex-wrap gap-2">
            <Chip label="✓ CDI" active={true} onClick={() => {}} />
          </div>
        </Section>

        <Section label="Statut de l'offre">
          <div className="flex flex-wrap gap-2">
            {[['', 'Toutes'], ...Object.entries(STATUS).map(([k, v]) => [k, v.label])].map(([val, label]) => (
              <Chip key={val} label={label} active={local.status === val} onClick={() => setLocal(p => ({ ...p, status: val }))} />
            ))}
          </div>
        </Section>

        <Section label="Localisation">
          <div className="flex flex-wrap gap-2">
            {[['', 'Toutes'], ['0', '📍 Grenoble / présentiel'], ['1', '🌐 Remote']].map(([val, label]) => (
              <Chip key={val} label={label} active={local.remote === val} onClick={() => setLocal(p => ({ ...p, remote: val }))} />
            ))}
          </div>
        </Section>

        <Section label="Salaire" note="Objectif : 45 000 € brut annuel minimum.">
          <div className="flex flex-wrap gap-2">
            {[['', 'Toutes'], ['specified', "Précisé dans l'annonce"], ['missing', 'Non précisé']].map(([val, label]) => (
              <Chip key={val} label={label} active={local.salary === val} onClick={() => setLocal(p => ({ ...p, salary: val }))} />
            ))}
          </div>
        </Section>

        <Section label="Date de publication">
          <div className="flex flex-wrap gap-2">
            {[['7', '7 jours'], ['14', '14 jours'], ['30', '30 jours'], ['', 'Toutes']].map(([val, label]) => (
              <Chip key={val} label={label} active={local.dateRange === val} onClick={() => setLocal(p => ({ ...p, dateRange: val }))} />
            ))}
          </div>
        </Section>

        {sources.length > 0 && (
          <Section label="Source">
            <div className="flex flex-wrap gap-2">
              <Chip label="Toutes" active={local.source === ''} onClick={() => setLocal(p => ({ ...p, source: '' }))} />
              {sources.map(s => (
                <Chip key={s} label={s} active={local.source === s} onClick={() => setLocal(p => ({ ...p, source: s }))} />
              ))}
            </div>
          </Section>
        )}

      </div>

      {/* Valider */}
      <div className="px-4 pt-3 border-t border-zinc-800" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
        <button onClick={apply} className="w-full bg-violet-600 active:bg-violet-700 text-white font-bold py-4 rounded-2xl text-base max-w-lg mx-auto block">
          {activeCount > 0 ? `Valider · ${activeCount} filtre${activeCount > 1 ? 's' : ''}` : 'Valider'}
        </button>
      </div>
    </div>
  )
}

// ─── App principale ───────────────────────────────────────────────────────────
export default function App() {
  const [jobs, setJobs] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [scraping, setScraping] = useState(false)
  const [progress, setProgress] = useState([])
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ status: '', remote: '', source: '', dateRange: '30', salary: '' })
  const [selectedJob, setSelectedJob] = useState(null)
  const [showFilters, setShowFilters] = useState(false)

  const loadJobs = useCallback(async () => {
    setLoading(true)
    try {
      const params = { jobOnly: true }
      if (filters.status) params.status = filters.status
      if (filters.remote !== '') params.remote = filters.remote
      if (filters.source) params.source = filters.source
      if (filters.dateRange) params.dateFrom = new Date(Date.now() - Number(filters.dateRange) * 86400000).toISOString()
      setJobs(Array.isArray(await API.getJobs(params)) ? await API.getJobs(params) : [])
    } catch {}
    setLoading(false)
  }, [filters])

  const loadStats = useCallback(async () => { try { setStats(await API.getStats()) } catch {} }, [])

  useEffect(() => { loadJobs(); loadStats() }, [loadJobs, loadStats])

  const filtered = useMemo(() => {
    let list = jobs
    if (search.trim()) {
      const s = search.toLowerCase()
      list = list.filter(j => j.title?.toLowerCase().includes(s) || j.company?.toLowerCase().includes(s))
    }
    if (filters.salary === 'specified') list = list.filter(j => j.salary?.trim())
    if (filters.salary === 'missing') list = list.filter(j => !j.salary?.trim())
    return list
  }, [jobs, search, filters.salary])

  const sources = useMemo(() => [...new Set(jobs.map(j => j.source))].sort(), [jobs])
  const newCount = useMemo(() => jobs.filter(j => j.is_new === 1).length, [jobs])
  const activeFilters = Object.entries(filters).filter(([k, v]) => v !== '' && !(k === 'dateRange' && v === '30')).length

  const handleScrape = async () => {
    setScraping(true); setProgress([])
    try {
      await startScrapingSSE(p => setProgress(prev => {
        const i = prev.findIndex(x => x.source === p.source)
        if (i >= 0) { const n = [...prev]; n[i] = p; return n }
        return [...prev, p]
      }))
      await loadJobs(); await loadStats()
    } catch {}
    setScraping(false); setProgress([])
  }

  const handleStatusChange = async (job, status) => {
    await API.updateStatus(job.id, status)
    setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status, is_new: 0 } : j))
    if (selectedJob?.id === job.id) setSelectedJob(s => ({ ...s, status, is_new: 0 }))
  }

  const openJob = (job) => {
    if (job.status === 'new') handleStatusChange(job, 'seen')
    setSelectedJob(job)
  }

  return (
    <>
      {/* Fond plein écran */}
      <div className="min-h-screen bg-[#0a0a0a]" />

      {/* Colonne mobile centrée */}
      <div className="fixed inset-0 flex flex-col bg-[#0a0a0a] max-w-md mx-auto">

        {/* ── Header sticky ── */}
        <div className="shrink-0 bg-[#0a0a0a]/95 backdrop-blur border-b border-zinc-800/50 z-20">
          {/* Logo row */}
          <div className="flex items-center gap-2 px-4 pb-2" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
            <div className="text-violet-400 shrink-0 w-7 h-7">
              <WolfIcon size={28} />
            </div>
            <span className="font-black text-lg tracking-tight flex-1">SMTM</span>
            {newCount > 0 && (
              <span className="bg-violet-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {newCount}
              </span>
            )}
            <PushButton />
            <button onClick={handleScrape} disabled={scraping} className="w-11 h-11 flex items-center justify-center text-zinc-500 active:text-white disabled:opacity-40">
              <RefreshCw className={`w-5 h-5 ${scraping ? 'animate-spin text-violet-400' : ''}`} />
            </button>
          </div>

          {/* Stats */}
          <StatsRow stats={stats} newCount={newCount} />

          {/* Search + filter */}
          <div className="flex gap-2 px-4 pb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 pointer-events-none" />
              <input
                type="search"
                placeholder="Titre, société…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
              />
            </div>
            <button
              onClick={() => setShowFilters(true)}
              className={`h-11 px-3.5 flex items-center gap-1.5 rounded-xl border text-sm font-medium ${
                activeFilters > 0
                  ? 'bg-violet-600 border-violet-600 text-white'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 active:border-zinc-600'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              {activeFilters > 0 && <span>{activeFilters}</span>}
            </button>
          </div>
        </div>

        {/* ── Liste ── */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 flex flex-col gap-3" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
          {scraping && <ScrapeProgress progress={progress} />}

          {loading ? (
            <div className="flex-1 flex items-center justify-center py-20">
              <RefreshCw className="w-6 h-6 animate-spin text-zinc-600" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-16 gap-4 text-center">
              <div className="text-zinc-700"><WolfIcon size={52} /></div>
              <div>
                <p className="text-zinc-300 font-semibold mb-1">Aucune offre</p>
                <p className="text-zinc-600 text-sm">Lance le scraping pour trouver des offres.</p>
              </div>
              <button onClick={handleScrape} disabled={scraping}
                className="flex items-center gap-2 px-6 py-3.5 bg-violet-600 active:bg-violet-700 disabled:opacity-40 text-white font-semibold rounded-2xl">
                <RefreshCw className="w-4 h-4" />Lancer la recherche
              </button>
            </div>
          ) : (
            <>
              <p className="text-xs text-zinc-600">{filtered.length} offre{filtered.length > 1 ? 's' : ''}</p>
              {filtered.map(job => <JobCard key={job.id} job={job} onClick={openJob} />)}
            </>
          )}
        </div>
      </div>

      {/* ── Pages superposées ── */}
      {selectedJob && (
        <JobDetail job={selectedJob} onBack={() => setSelectedJob(null)} onStatusChange={handleStatusChange} />
      )}
      {showFilters && (
        <FilterPage filters={filters} setFilters={setFilters} sources={sources} onClose={() => setShowFilters(false)} />
      )}
    </>
  )
}
