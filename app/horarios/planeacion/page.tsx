'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase-browser'

interface Asignatura {
  id: number
  licenciatura: string
  plan: string
  semestre: string
  nombre: string
  clave_base: string
  horas_semana: number
  num_sesiones: number
  capacidad_max: number | null
  capacidad_grupo: number | null
  grupos_necesarios: number | null
  licenciaturas_inscritos: Record<string, number> | null
  requisitos: string[]
  tipo?: string | null
}

interface Grupo {
  id: number
  asignatura_id: number
  aula_id: number | null
  dia: string | null
  hora_inicio: string | null
  hora_fin: string | null
  grupo_num: number
  inscritos_estimados: number | null
  num_sesiones: number | null
  horas_sesiones: number[] | null
  licenciaturas: string[] | null
  num_grupos: number | null
}

const LIC_COLORS: Record<string, string> = {
  ARQ: '#B5D4F4', CC: '#9FE1CB', MP: '#FAC775', CV: '#F5C4B3',
  DI: '#C0DD97', AI: '#F4C0D1', DTM: '#CDD0F4', CT: '#E1C0F4',
  EI: '#C0EDF4', POSG: '#FAE0A0',
}
const LIC_TEXT: Record<string, string> = {
  ARQ: '#0C447C', CC: '#085041', MP: '#633806', CV: '#712B13',
  DI: '#27500A', AI: '#72243E', DTM: '#26215C', CT: '#5A2689',
  EI: '#085060', POSG: '#7A5000',
}
const LIC_NAMES: Record<string, string> = {
  ARQ: 'Arquitectura', CC: 'Computación Creativa', MP: 'Mercadotecnia y Publicidad',
  CV: 'Comunicación Visual', DI: 'Diseño Industrial', AI: 'Arquitectura de Interiores',
  DTM: 'Diseño Textil y Moda', CT: 'Cine y Televisión', EI: 'Estudios Integrales',
  POSG: 'Posgrado', NC: 'Negocios e Industrias Creativas',
}
const LICS_ORDER = ['ARQ','CC','MP','CV','DI','AI','DTM','CT','EI','NC']
const LICS_PARA_EI = ['ARQ','CC','MP','CV','DI','AI','DTM','CT','NC']
const SEM_ORDER = ['1°','2°','3°','4°','5°','6°','7°','8°','9°','10°']

type Tab = 'seleccion' | 'activas'

export default function PlaneacionPage() {
  const [asignaturas, setAsignaturas] = useState<Asignatura[]>([])
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<number | null>(null)
  const [tab, setTab] = useState<Tab>('seleccion')

  const [filtLic, setFiltLic] = useState('')
  const [filtSem, setFiltSem] = useState('')
  const [filtPlan, setFiltPlan] = useState('')
  const [filtActivas, setFiltActivas] = useState(false)
  const [busqueda, setBusqueda] = useState('')

  // Estado de edición: grupoId → { num_sesiones, horas_sesiones, licenciaturas }
  const [edits, setEdits] = useState<Record<number, { num_sesiones: number; horas_sesiones: number[]; licenciaturas: string[]; num_grupos: number }>>({})
  const [saving, setSaving] = useState<number | null>(null)
  const [savedSet, setSavedSet] = useState<Set<number>>(new Set())
  const [dirtySet, setDirtySet] = useState<Set<number>>(new Set())

  useEffect(() => {
    async function load() {
      try {
        const [a, gRes] = await Promise.all([
          supabase.from('plan_asignaturas').select('*')
            .order('licenciatura').order('semestre').order('nombre'),
          fetch('/api/plan-grupos?periodo=2027-2'),
        ])
        const raw = (a.data as Asignatura[]) || []
        const dedup = raw.filter(x =>
          x.licenciatura === 'EI' || !x.clave_base?.toUpperCase().startsWith('EI')
        )
        setAsignaturas(dedup)

        let gruposData: Grupo[] = []
        if (gRes.ok) {
          const gJson = await gRes.json().catch(() => ({}))
          gruposData = (gJson.data as Grupo[]) || []
        }
        setGrupos(gruposData)

        const initEdits: typeof edits = {}
        for (const gr of gruposData) {
          initEdits[gr.id] = {
            num_sesiones: gr.num_sesiones ?? 1,
            horas_sesiones: gr.horas_sesiones ?? [2],
            licenciaturas: gr.licenciaturas ?? [],
            num_grupos: gr.num_grupos ?? 1,
          }
        }
        setEdits(initEdits)
      } catch (e) {
        console.error('Error cargando planeación:', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const seleccionadasSet = useMemo(() => new Set(grupos.map(g => g.asignatura_id)), [grupos])
  const grupoByAsig = useMemo(() => {
    const m: Record<number, Grupo> = {}
    for (const g of grupos) m[g.asignatura_id] = g
    return m
  }, [grupos])

  async function toggleApertura(a: Asignatura) {
    setToggling(a.id)
    if (seleccionadasSet.has(a.id)) {
      await fetch(`/api/plan-grupos?asignatura_id=${a.id}&periodo=2027-2`, { method: 'DELETE' })
      setGrupos(prev => prev.filter(g => g.asignatura_id !== a.id))
    } else {
      const res = await fetch('/api/plan-grupos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asignatura_id: a.id, periodo: '2027-2', grupo_num: 1 }),
      })
      const json = await res.json()
      if (json.data) {
        const gr = json.data as Grupo
        setGrupos(prev => [...prev, gr])
        setEdits(prev => ({ ...prev, [gr.id]: { num_sesiones: 1, horas_sesiones: [2], licenciaturas: [], num_grupos: 1 } }))
      }
    }
    setToggling(null)
  }

  function markDirty(grupoId: number) {
    setDirtySet(prev => new Set([...prev, grupoId]))
    setSavedSet(prev => { const s = new Set(prev); s.delete(grupoId); return s })
  }

  function updateNumSesiones(grupoId: number, n: number) {
    setEdits(prev => {
      const cur = prev[grupoId] || { num_sesiones: 1, horas_sesiones: [2], licenciaturas: [], num_grupos: 1 }
      const horas = Array.from({ length: n }, (_, i) => cur.horas_sesiones[i] ?? 2)
      return { ...prev, [grupoId]: { num_sesiones: n, horas_sesiones: horas, licenciaturas: cur.licenciaturas } }
    })
    markDirty(grupoId)
  }

  function updateHoraSesion(grupoId: number, idx: number, h: number) {
    setEdits(prev => {
      const cur = prev[grupoId] || { num_sesiones: 1, horas_sesiones: [2], licenciaturas: [], num_grupos: 1 }
      const horas = [...cur.horas_sesiones]
      horas[idx] = h
      return { ...prev, [grupoId]: { ...cur, horas_sesiones: horas } }
    })
    markDirty(grupoId)
  }

  function toggleLicenciatura(grupoId: number, lic: string, todas: string[]) {
    setEdits(prev => {
      const cur = prev[grupoId] || { num_sesiones: 1, horas_sesiones: [2], licenciaturas: [], num_grupos: 1 }
      let lics = cur.licenciaturas
      if (lic === 'TODAS') {
        lics = lics.length === todas.length ? [] : [...todas]
      } else {
        lics = lics.includes(lic) ? lics.filter(l => l !== lic) : [...lics, lic]
      }
      return { ...prev, [grupoId]: { ...cur, licenciaturas: lics } }
    })
    markDirty(grupoId)
  }

  async function saveGrupo(grupoId: number) {
    setSaving(grupoId)
    const ed = edits[grupoId]
    await fetch('/api/plan-grupos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: grupoId, num_sesiones: ed.num_sesiones, horas_sesiones: ed.horas_sesiones, licenciaturas: ed.licenciaturas, num_grupos: ed.num_grupos }),
    })
    setSaving(null)
    setSavedSet(prev => new Set([...prev, grupoId]))
    setDirtySet(prev => { const s = new Set(prev); s.delete(grupoId); return s })
  }

  const asignaturasFiltradas = useMemo(() => asignaturas.filter(a => {
    if (filtLic && a.licenciatura !== filtLic) return false
    if (filtSem && a.semestre !== filtSem) return false
    if (filtPlan && a.plan !== filtPlan) return false
    if (filtActivas && !seleccionadasSet.has(a.id)) return false
    if (busqueda && !a.nombre.toLowerCase().includes(busqueda.toLowerCase())) return false
    return true
  }), [asignaturas, filtLic, filtSem, filtPlan, filtActivas, busqueda, seleccionadasSet])

  const porLic = useMemo(() => {
    const map: Record<string, Record<string, Asignatura[]>> = {}
    for (const a of asignaturasFiltradas) {
      if (!map[a.licenciatura]) map[a.licenciatura] = {}
      if (!map[a.licenciatura][a.semestre]) map[a.licenciatura][a.semestre] = []
      map[a.licenciatura][a.semestre].push(a)
    }
    return map
  }, [asignaturasFiltradas])

  const licsPresentes = LICS_ORDER.filter(l => porLic[l])

  // Para la pestaña "activas": aplica los mismos filtros
  const activasFiltradas = useMemo(() => asignaturas.filter(a => {
    if (!seleccionadasSet.has(a.id)) return false
    if (filtLic && a.licenciatura !== filtLic) return false
    if (filtSem && a.semestre !== filtSem) return false
    if (filtPlan && a.plan !== filtPlan) return false
    if (busqueda && !a.nombre.toLowerCase().includes(busqueda.toLowerCase())) return false
    return true
  }), [asignaturas, seleccionadasSet, filtLic, filtSem, filtPlan, busqueda])

  const activasPorLic = useMemo(() => {
    const map: Record<string, Record<string, Asignatura[]>> = {}
    for (const a of activasFiltradas) {
      if (!map[a.licenciatura]) map[a.licenciatura] = {}
      if (!map[a.licenciatura][a.semestre]) map[a.licenciatura][a.semestre] = []
      map[a.licenciatura][a.semestre].push(a)
    }
    return map
  }, [activasFiltradas])
  const licsActivas = LICS_ORDER.filter(l => activasPorLic[l])

  const totalSel = asignaturasFiltradas.filter(a => seleccionadasSet.has(a.id)).length
  const total = asignaturasFiltradas.length
  const totalActivas = asignaturas.filter(a => seleccionadasSet.has(a.id)).length

  if (loading) return <div className="text-center py-20 text-gray-400">Cargando...</div>

  return (
    <div className="flex gap-5">
      {/* Panel izquierdo */}
      <div className="w-64 flex-shrink-0 space-y-4">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Filtros</h3>
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Plan</label>
              <div className="flex gap-1">
                {['', '21', '25'].map(p => (
                  <button key={p} onClick={() => setFiltPlan(p)}
                    className={`flex-1 py-1 rounded text-xs font-medium transition ${filtPlan === p ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                    {p || 'Todos'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Licenciatura</label>
              <select value={filtLic} onChange={e => setFiltLic(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-orange-400">
                <option value="">Todas</option>
                {LICS_ORDER.map(l => <option key={l} value={l}>{l} — {LIC_NAMES[l]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Semestre</label>
              <select value={filtSem} onChange={e => setFiltSem(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-orange-400">
                <option value="">Todos</option>
                {SEM_ORDER.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Buscar materia</label>
              <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                placeholder="Nombre..."
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
            <button
              onClick={() => setFiltActivas(v => !v)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-medium transition ${filtActivas ? 'bg-green-50 border-green-400 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'}`}>
              <span>Solo activas</span>
              <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition ${filtActivas ? 'border-green-500 bg-green-500' : 'border-gray-300'}`}>
                {filtActivas && <span className="w-2 h-2 rounded-full bg-white" />}
              </span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-xs text-gray-500 mb-2 font-medium">Progreso</p>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">Seleccionadas</span>
            <span className="font-semibold text-gray-800">{totalSel} / {total}</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-1">
            <div className="h-full bg-orange-500 rounded-full transition-all"
              style={{ width: `${total ? (totalSel / total) * 100 : 0}%` }} />
          </div>
          <p className="text-xs text-gray-400">{total - totalSel} sin seleccionar</p>

          <div className="mt-3 space-y-1.5">
            {licsPresentes.map(lic => {
              const asSel = asignaturasFiltradas.filter(a => a.licenciatura === lic && seleccionadasSet.has(a.id)).length
              const asTotal = asignaturasFiltradas.filter(a => a.licenciatura === lic).length
              return (
                <div key={lic} className="flex items-center gap-2">
                  <span className="text-xs font-mono px-1.5 py-0.5 rounded font-medium flex-shrink-0"
                    style={{ background: LIC_COLORS[lic], color: LIC_TEXT[lic] }}>{lic}</span>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${asTotal ? (asSel / asTotal) * 100 : 0}%`, background: LIC_TEXT[lic] }} />
                  </div>
                  <span className="text-xs text-gray-500 w-10 text-right">{asSel}/{asTotal}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Panel derecho */}
      <div className="flex-1 min-w-0">
        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-white rounded-xl shadow-sm p-1 w-fit">
          <button onClick={() => setTab('seleccion')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === 'seleccion' ? 'bg-orange-500 text-white' : 'text-gray-500 hover:text-gray-700'}`}>
            Catálogo
          </button>
          <button onClick={() => setTab('activas')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${tab === 'activas' ? 'bg-green-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}>
            Materias activas
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${tab === 'activas' ? 'bg-white text-green-700' : 'bg-green-100 text-green-700'}`}>{totalActivas}</span>
          </button>
        </div>

        {/* Catálogo — selección */}
        {tab === 'seleccion' && (
          <div className="space-y-6">
            {licsPresentes.length === 0 && (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-400">
                <p className="text-3xl mb-3">📋</p>
                <p>Sin asignaturas para los filtros seleccionados.</p>
              </div>
            )}

            {licsPresentes.map(lic => {
              const semsPresentes = SEM_ORDER.filter(s => porLic[lic]?.[s]?.length)
              const licSel = asignaturasFiltradas.filter(a => a.licenciatura === lic && seleccionadasSet.has(a.id)).length
              const licTotal = asignaturasFiltradas.filter(a => a.licenciatura === lic).length

              return (
                <div key={lic} className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <div className="px-5 py-3 flex items-center justify-between border-b border-gray-100"
                    style={{ background: LIC_COLORS[lic] + '55' }}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold px-2 py-0.5 rounded"
                        style={{ background: LIC_COLORS[lic], color: LIC_TEXT[lic] }}>{lic}</span>
                      <span className="font-semibold text-gray-700 text-sm">{LIC_NAMES[lic]}</span>
                    </div>
                    <span className="text-xs font-medium text-gray-500">{licSel}/{licTotal} seleccionadas</span>
                  </div>

                  {semsPresentes.map(sem => {
                    const asigs = porLic[lic][sem]
                    return (
                      <div key={sem}>
                        <div className="px-5 py-1.5 bg-gray-50 border-b border-gray-100">
                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{sem} Semestre</span>
                        </div>
                        <div className="divide-y divide-gray-50">
                          {asigs.map(a => {
                            const abierta = seleccionadasSet.has(a.id)
                            const cargando = toggling === a.id
                            return (
                              <div key={a.id}
                                className={`px-5 py-3 flex items-center gap-3 transition ${abierta ? 'bg-green-50' : 'hover:bg-gray-50'}`}>
                                <button
                                  onClick={() => toggleApertura(a)}
                                  disabled={cargando}
                                  className={`w-10 h-6 rounded-full flex-shrink-0 relative transition-colors duration-200 focus:outline-none ${abierta ? 'bg-green-500' : 'bg-gray-200'} ${cargando ? 'opacity-50' : ''}`}>
                                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${abierta ? 'translate-x-5' : 'translate-x-1'}`} />
                                </button>

                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-medium leading-snug ${abierta ? 'text-gray-800' : 'text-gray-500'}`}>
                                    {a.nombre}
                                  </p>
                                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                    <span className="text-xs font-mono text-gray-400">{a.clave_base}</span>
                                    {a.horas_semana && <span className="text-xs text-gray-400">⏱ {a.horas_semana}h</span>}
                                    <span className="text-xs text-gray-300">Plan {a.plan}</span>
                                  </div>
                                </div>

                                <div className="flex-shrink-0 text-right">
                                  {abierta ? (
                                    <span className="text-xs font-semibold text-green-600">✓ Abierta</span>
                                  ) : (
                                    <span className="text-xs text-gray-300">—</span>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}

        {/* Materias activas — configuración de sesiones */}
        {tab === 'activas' && (
          <div className="space-y-6">
            {licsActivas.length === 0 && (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-400">
                <p className="text-3xl mb-3">✅</p>
                <p>No hay materias seleccionadas aún. Ve al Catálogo y activa las que se abrirán.</p>
              </div>
            )}

            {licsActivas.map(lic => {
              const semsPresentes = SEM_ORDER.filter(s => activasPorLic[lic]?.[s]?.length)
              return (
                <div key={lic} className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <div className="px-5 py-3 flex items-center gap-2 border-b border-gray-100"
                    style={{ background: LIC_COLORS[lic] + '55' }}>
                    <span className="text-sm font-bold px-2 py-0.5 rounded"
                      style={{ background: LIC_COLORS[lic], color: LIC_TEXT[lic] }}>{lic}</span>
                    <span className="font-semibold text-gray-700 text-sm">{LIC_NAMES[lic]}</span>
                  </div>

                  {semsPresentes.map(sem => {
                    const asigs = activasPorLic[lic][sem]
                    return (
                      <div key={sem}>
                        <div className="px-5 py-1.5 bg-gray-50 border-b border-gray-100">
                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{sem} Semestre</span>
                        </div>
                        <div className="p-4 grid grid-cols-4 gap-3 items-stretch">
                          {asigs.map(a => {
                            const gr = grupoByAsig[a.id]
                            if (!gr) return null
                            const ed = edits[gr.id] || { num_sesiones: 1, horas_sesiones: [2], licenciaturas: [], num_grupos: 1 }
                            const isSaving = saving === gr.id
                            const isSaved = savedSet.has(gr.id) && !dirtySet.has(gr.id)
                            const isDirty = dirtySet.has(gr.id)
                            const esEI = a.licenciatura === 'EI'
                            const licsDisponibles = esEI ? LICS_PARA_EI : []
                            const todasSel = ed.licenciaturas.length === licsDisponibles.length
                            return (
                              <div key={a.id} className="border border-gray-100 rounded-xl p-3 flex flex-col bg-white shadow-sm hover:shadow-md transition-shadow">
                                {/* Nombre y clave — altura fija para uniformidad */}
                                <div className="min-h-[3.5rem] mb-2.5">
                                  <p className="text-sm font-semibold text-gray-800 leading-snug line-clamp-2">{a.nombre}</p>
                                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                    <span className="text-[10px] font-mono text-gray-400">{a.clave_base}</span>
                                    {a.horas_semana && <span className="text-[10px] text-gray-300">·{a.horas_semana}h</span>}
                                  </div>
                                </div>

                                {/* Grupos + Clases/sem + Horas en una fila */}
                                <div className="flex items-end gap-3 mb-2.5">
                                  <div>
                                    <label className="block text-[10px] text-gray-400 mb-1">Grupos</label>
                                    <input
                                      type="number" min={1} max={20}
                                      value={ed.num_grupos}
                                      onChange={e => {
                                        const v = Math.max(1, Number(e.target.value))
                                        setEdits(prev => ({ ...prev, [gr.id]: { ...prev[gr.id], num_grupos: v } }))
                                        markDirty(gr.id)
                                      }}
                                      className="w-12 border border-gray-200 rounded px-1 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] text-gray-400 mb-1">Clases / sem.</label>
                                    <input
                                      type="number" min={1} max={10}
                                      value={ed.num_sesiones}
                                      onChange={e => updateNumSesiones(gr.id, Math.max(1, Number(e.target.value)))}
                                      className="w-12 border border-gray-200 rounded px-1 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                    />
                                  </div>
                                  <div className="flex-1">
                                    <label className="block text-[10px] text-gray-400 mb-1">
                                      {ed.num_sesiones === 1 ? 'Horas' : `Horas (${ed.num_sesiones} clases)`}
                                    </label>
                                    <div className="flex gap-1 items-center flex-wrap">
                                      {Array.from({ length: ed.num_sesiones }).map((_, i) => (
                                        <div key={i} className="flex items-center gap-0.5">
                                          {ed.num_sesiones > 1 && <span className="text-[10px] text-gray-400">C{i+1}</span>}
                                          <input
                                            type="number" min={1} max={8}
                                            value={ed.horas_sesiones[i] ?? 2}
                                            onChange={e => updateHoraSesion(gr.id, i, Number(e.target.value))}
                                            className="w-10 border border-gray-200 rounded px-1 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                          />
                                          <span className="text-[10px] text-gray-400">h</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>

                                {/* Licenciaturas (solo EI) */}
                                {esEI && (
                                  <div className="mb-2.5">
                                    <label className="block text-[10px] text-gray-400 mb-1">Licenciaturas</label>
                                    <div className="flex gap-1 flex-wrap">
                                      <button
                                        onClick={() => toggleLicenciatura(gr.id, 'TODAS', licsDisponibles)}
                                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition ${todasSel ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                                        Todas
                                      </button>
                                      {licsDisponibles.map(l => {
                                        const activa = ed.licenciaturas.includes(l)
                                        return (
                                          <button key={l}
                                            onClick={() => toggleLicenciatura(gr.id, l, licsDisponibles)}
                                            className="px-1.5 py-0.5 rounded text-[10px] font-semibold transition"
                                            style={{
                                              background: activa ? LIC_COLORS[l] : '#f3f4f6',
                                              color: activa ? LIC_TEXT[l] : '#9ca3af',
                                            }}>
                                            {l}
                                          </button>
                                        )
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* Guardar — siempre al fondo */}
                                <button
                                  onClick={() => saveGrupo(gr.id)}
                                  disabled={isSaving}
                                  className={`mt-auto w-full h-7 text-[10px] font-semibold rounded-lg disabled:opacity-50 transition-all ${isSaved ? 'bg-green-500 text-white' : isDirty ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                  {isSaving ? '...' : isSaved ? '✓ Guardado' : 'Guardar'}
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
