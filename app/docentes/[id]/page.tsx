'use client'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
interface HorarioFila {
  clave: string
  materia: string
  salon: string
}

interface SegMateria {
  id?: number
  asistencia: string | null
  temarios_oficina: string | null
  temarios_bs: string | null
  materiales_bibliografia: string | null
  evaluacion_intermedia: string | null
  evaluacion_final: string | null
  publicacion_calificaciones: string | null
  observaciones: string | null
}

interface Grupo {
  id: number
  clave: string
  materia: string
  semestre: string
  grupo: number
  enlace: string | null
  bloque: string | null
  seguimiento: SegMateria | null
}

const ETIQUETAS = [
  { value: 'Nuevo Ingreso a EI',   color: 'bg-purple-100 text-purple-700 border-purple-300' },
  { value: 'Seguimiento especial', color: 'bg-red-100 text-red-700 border-red-300' },
  { value: 'Ruta de Desarrollo',   color: 'bg-teal-100 text-teal-700 border-teal-300' },
]

interface Docente {
  id: number
  id_centro: string
  nombre: string
  correo_centro: string
  correo_personal: string
  contacto: string
  forma_pago: string
  tabulador: string
  fecha_ingreso: string
  extranjero: string
  etiqueta: string | null
  grupos: Grupo[]
  porcentaje: number
}

const CAMPOS = [
  { key: 'asistencia', label: 'Asistencia' },
  { key: 'temarios_oficina', label: 'Acuse de Programa' },
  { key: 'temarios_bs', label: 'Temario en Brightspace' },
  { key: 'materiales_bibliografia', label: 'Método de Evaluación' },
  { key: 'evaluacion_intermedia', label: 'Apartado de Calificaciones' },
  { key: 'publicacion_calificaciones', label: 'Publicación de Cal.' },
]
// publicacion_calificaciones no cuenta en el % hasta fin de semestre
const CAMPOS_PCT = CAMPOS.filter(c => c.key !== 'publicacion_calificaciones')

const formatId = (id: string) => `0000${id}`

export default function DocenteDetallePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [docente, setDocente] = useState<Docente | null>(null)
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState<number | null>(null)
  const [editandoNombre, setEditandoNombre] = useState(false)
  const [nombreEdit, setNombreEdit] = useState('')
  const [segs, setSegs] = useState<Record<number, SegMateria>>({})
  const [copiado, setCopiado] = useState<string | null>(null)

  const copiar = (texto: string, key: string) => {
    navigator.clipboard.writeText(texto)
    setCopiado(key)
    setTimeout(() => setCopiado(null), 1500)
  }

  const [editados, setEditados] = useState<Set<number>>(new Set())
  const [horarios, setHorarios] = useState<HorarioFila[]>([])

  // Asistencias Core
  interface SesionCore { clave_asignatura: string; nombre_asignatura: string; sesiones_por_clase: number | null; fecha_corte: string | null }
  const DOBLE_SESION = /laboratorio|dibujo natural|dibujo constructivo|conceptos est|pensamiento visual/i
  const [sesionesCore, setSesionesCore] = useState<SesionCore[]>([])
  const [mostrarSesiones, setMostrarSesiones] = useState(false)

  const cargarSesionesCore = async (docenteId: string) => {
    const r = await fetch(`/api/asistencias-core?docente_id=${docenteId}&ciclo=2027-1`)
    const json = await r.json()
    setSesionesCore(json.data || [])
  }
  const [etiqueta, setEtiqueta] = useState<string | null>(null)
  const [guardandoEtiqueta, setGuardandoEtiqueta] = useState(false)

  const guardarEtiqueta = async (valor: string | null) => {
    if (!docente) return
    setGuardandoEtiqueta(true)
    setEtiqueta(valor)
    await fetch('/api/docentes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docente_id: docente.id, etiqueta: valor })
    })
    setGuardandoEtiqueta(false)
  }

  const [mostrarEval, setMostrarEval] = useState(false)
  const [copiadoEval, setCopiadoEval] = useState(false)
  const [evalEnviada, setEvalEnviada] = useState(false)
  const [guardandoEnvio, setGuardandoEnvio] = useState(false)
  const [mostrarSegundaEval, setMostrarSegundaEval] = useState(false)
  const [copiadoSegundaEval, setCopiadoSegundaEval] = useState(false)
  // Snapshot Primera Evaluación
  interface SnapGrupo { clave_id: number; materia: string; grupo: string; enlace: string | null; asistencia: string | null; temarios_oficina: string | null; temarios_bs: string | null; materiales_bibliografia: string | null; evaluacion_intermedia: string | null; observaciones: string | null }
  const [snapshotPrimera, setSnapshotPrimera] = useState<SnapGrupo[]>([])
  const [primeraFrozen, setPrimeraFrozen] = useState(false)
  const [congelando, setCongelando] = useState(false)

  const cargarSnapshot = async (docenteId: number) => {
    const r = await fetch(`/api/primera-evaluacion-snapshot?docente_id=${docenteId}&ciclo=2027-1`)
    const json = await r.json()
    if (json.frozen) { setSnapshotPrimera(json.data); setPrimeraFrozen(true) }
  }

  const congelarPrimera = async () => {
    if (!docente) return
    setCongelando(true)
    const grupos = (docente.grupos || []).filter((g: any) => g.bloque !== '2')
    await fetch('/api/primera-evaluacion-snapshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docente_id: docente.id, ciclo: '2027-1', grupos })
    })
    await cargarSnapshot(docente.id)
    setCongelando(false)
  }

  // Reposiciones
  interface Reposicion { id: number; clase: string; fecha_clase: string | null; hora_clase: string | null; estado: string; fecha_reposicion: string | null; hora_inicio: string | null; hora_fin: string | null; salon: string | null; notas: string | null }
  const [reposiciones, setReposiciones] = useState<Reposicion[]>([])
  const [nuevaRepo, setNuevaRepo] = useState({ clase: '', fecha_clase: '', hora_clase: '', estado: 'Pendiente', fecha_reposicion: '', hora_inicio: '', hora_fin: '', salon: '', notas: '' })
  const [guardandoRepo, setGuardandoRepo] = useState(false)
  const [editandoRepo, setEditandoRepo] = useState<number | null>(null)
  const [mostrarRepo, setMostrarRepo] = useState(false)
  const [copiadoRepo, setCopiadoRepo] = useState(false)

  const cargarReposiciones = async (docenteId: number) => {
    const r = await fetch(`/api/reposiciones?docente_id=${docenteId}&ciclo=2027-1`)
    const json = await r.json()
    setReposiciones(json.data || [])
  }

  const agregarRepo = async () => {
    if (!nuevaRepo.clase.trim() || !docente) return
    setGuardandoRepo(true)
    await fetch('/api/reposiciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docente_id: docente.id, ciclo: '2027-1', ...nuevaRepo })
    })
    setNuevaRepo({ clase: '', fecha_reposicion: '', hora_inicio: '', hora_fin: '', estado: 'Pendiente', notas: '' })
    await cargarReposiciones(docente.id)
    setGuardandoRepo(false)
  }

  const actualizarRepo = async (repo: Reposicion) => {
    await fetch('/api/reposiciones', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(repo)
    })
    setEditandoRepo(null)
    if (docente) cargarReposiciones(docente.id)
  }

  const eliminarRepo = async (id: number) => {
    await fetch('/api/reposiciones', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    })
    if (docente) cargarReposiciones(docente.id)
  }

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    if (id) fetchDocente()
  }, [id])

  const fetchDocente = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/docentes?id=${id}`)
      const json = await res.json()
      const data: Docente = json.data
      setDocente(data)
      if (data?.nombre) document.title = `${data.nombre} | Integra`
      setNombreEdit(data?.nombre || '')
      setHorarios(data?.horarios || [])
      setEvalEnviada(data?.seguimiento?.primera_evaluacion_enviada || false)
      setEtiqueta(data?.etiqueta || null)
      if (data?.id) { cargarReposiciones(data.id); cargarSnapshot(data.id); cargarSesionesCore(String(data.id_centro || data.id)) }

      const inicial: Record<number, SegMateria> = {}
      for (const g of data?.grupos || []) {
        inicial[g.id] = g.seguimiento || {
          asistencia: null,
          temarios_oficina: null,
          temarios_bs: null,
          materiales_bibliografia: null,
          evaluacion_intermedia: null,
          evaluacion_final: null,
          publicacion_calificaciones: null,
          observaciones: null,
        }
      }
      setSegs(inicial)
      setEditados(new Set())
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const toggleCampo = (grupoId: number, key: string) => {
    setSegs(prev => {
      const actual = prev[grupoId]?.[key as keyof SegMateria]
      const nuevo = !actual ? 'SI' : actual === 'SI' ? 'NO' : actual === 'NO' ? 'A DESTIEMPO' : null
      return { ...prev, [grupoId]: { ...prev[grupoId], [key]: nuevo } }
    })
    setEditados(prev => new Set(prev).add(grupoId))
  }

  const guardarMateria = async (grupoId: number) => {
    if (!docente) return
    setGuardando(grupoId)
    try {
      const res = await fetch('/api/docentes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docente_id: docente.id,
          clave_id: grupoId,
          ciclo: '2027-1',
          ...segs[grupoId],
        })
      })
      const json = await res.json()
      if (json.ok) {
        setEditados(prev => {
          const s = new Set(prev)
          s.delete(grupoId)
          return s
        })
      }
    } catch (e) {
      console.error(e)
    } finally {
      setGuardando(null)
    }
  }

  const guardarNombre = async () => {
    if (!docente) return
    try {
      const res = await fetch('/api/docentes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: docente.id, nombre: nombreEdit })
      })
      const json = await res.json()
      if (json.ok) {
        setDocente(prev => prev ? { ...prev, nombre: nombreEdit } : prev)
        setEditandoNombre(false)
      }
    } catch (e) {
      console.error(e)
    }
  }

  const toggleEvalEnviada = async () => {
    if (!docente) return
    setGuardandoEnvio(true)
    const nuevo = !evalEnviada
    try {
      await fetch('/api/docentes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docente_id: docente.id, ciclo: '2027-1', primera_evaluacion_enviada: nuevo })
      })
      setEvalEnviada(nuevo)
    } catch (e) { console.error(e) }
    finally { setGuardandoEnvio(false) }
  }

  const colorCheck = (val: string | null) => {
    if (val === 'SI') return 'bg-green-500 border-green-500 text-white'
    if (val === 'NO') return 'bg-red-400 border-red-400 text-white'
    if (val === 'A DESTIEMPO') return 'bg-green-300 border-green-400 text-green-900'
    return 'bg-white border-gray-300 text-gray-400'
  }

  const iconCheck = (val: string | null) => {
    if (val === 'SI') return 'SI'
    if (val === 'NO') return 'NO'
    if (val === 'A DESTIEMPO') return 'A Destiempo'
    return '--'
  }

  if (status === 'loading' || loading) return (
    <div className="min-h-screen flex items-center justify-center">Cargando...</div>
  )
  if (!docente) return (
    <div className="min-h-screen flex items-center justify-center text-gray-400">Docente no encontrado</div>
  )

  const totalGrupos = docente.grupos.length

  const porcentaje = (() => {
    let total = 0, completados = 0
    for (const g of docente.grupos) {
      if (g.bloque === '2') continue  // bloque 2 inicia en octubre, no cuenta aún
      const seg = segs[g.id] || {}
      for (const c of CAMPOS_PCT) {
        total++
        if (seg[c.key as keyof SegMateria] === 'SI') completados++
        else if (seg[c.key as keyof SegMateria] === 'A DESTIEMPO') completados += 0.8
        else if (seg[c.key as keyof SegMateria] === 'FALTA') completados += 0.5
      }
    }
    return total > 0 ? Math.round((completados / total) * 100) : 0
  })()

  return (
    <div className="min-h-screen bg-gray-50">

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* Migajas de pan */}
        <nav className="flex items-center gap-1.5 text-sm text-gray-400">
          <button onClick={() => router.push('/')} className="hover:text-gray-600 transition">Tablero</button>
          <span>›</span>
          <button onClick={() => router.push('/docentes')} className="hover:text-gray-600 transition">Seguimiento Docente</button>
          <span>›</span>
          <span className="text-gray-700 font-medium">{docente.nombre}</span>
        </nav>

        {/* Ficha + Horarios en dos columnas */}
        <div className="flex gap-4 items-start">

          {/* Columna izquierda: ficha del docente */}
          <div className="bg-white rounded-xl shadow-sm p-5 flex-1 min-w-0">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold text-gray-800">{docente.nombre}</h1>
                <button
                  onClick={toggleEvalEnviada}
                  disabled={guardandoEnvio}
                  className={`mt-2 inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium transition disabled:opacity-50 ${
                    evalEnviada
                      ? 'bg-green-500 text-white border-green-500'
                      : 'bg-white text-gray-500 border-gray-300 hover:border-green-400 hover:text-green-600'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                  {guardandoEnvio ? 'Guardando…' : evalEnviada ? '1era Evaluación Enviada' : 'Marcar 1era Evaluación Enviada'}
                </button>
                {/* Etiqueta */}
                <div className="mt-2 flex flex-wrap gap-1.5 items-center">
                  {ETIQUETAS.map(e => (
                    <button
                      key={e.value}
                      onClick={() => guardarEtiqueta(etiqueta === e.value ? null : e.value)}
                      disabled={guardandoEtiqueta}
                      className={`text-xs px-2.5 py-1 rounded-full border font-medium transition disabled:opacity-50 ${etiqueta === e.value ? e.color : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400 hover:text-gray-600'}`}
                    >
                      {e.value}
                    </button>
                  ))}
                </div>
              </div>
              <span className="text-sm font-medium bg-orange-50 text-orange-600 px-3 py-1 rounded-full border border-orange-200 flex-shrink-0 ml-3">
                {docente.forma_pago || '-'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
              <div>
                <p className="text-xs text-gray-400 mb-1">Grupos asignados</p>
                <p className="text-2xl font-bold text-blue-600">{totalGrupos}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-2">Avance de cumplimiento</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full transition-all ${porcentaje === 100 ? 'bg-green-500' : porcentaje >= 50 ? 'bg-blue-500' : 'bg-orange-400'}`}
                      style={{ width: `${porcentaje}%` }}
                    />
                  </div>
                  <span className={`text-base font-bold ${porcentaje === 100 ? 'text-green-600' : porcentaje >= 50 ? 'text-blue-600' : 'text-orange-500'}`}>
                    {porcentaje}%
                  </span>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">ID Centro</p>
                <button
                  onClick={() => copiar(formatId(docente.id_centro), 'id')}
                  className="flex items-center gap-1.5 group"
                  title="Copiar ID"
                >
                  <span className="text-sm font-mono text-gray-800">{formatId(docente.id_centro)}</span>
                  <span className={`text-xs transition ${copiado === 'id' ? 'text-green-500' : 'text-gray-300 group-hover:text-gray-400'}`}>
                    {copiado === 'id' ? '✓' : '⎘'}
                  </span>
                </button>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Correo Centro</p>
                <button
                  onClick={() => copiar(docente.correo_centro, 'correo_centro')}
                  className="flex items-center gap-1.5 group"
                  title="Copiar correo"
                >
                  <span className="text-sm text-gray-800">{docente.correo_centro || '-'}</span>
                  {docente.correo_centro && (
                    <span className={`text-xs transition ${copiado === 'correo_centro' ? 'text-green-500' : 'text-gray-300 group-hover:text-gray-400'}`}>
                      {copiado === 'correo_centro' ? '✓' : '⎘'}
                    </span>
                  )}
                </button>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Correo personal</p>
                <button
                  onClick={() => docente.correo_personal && copiar(docente.correo_personal, 'correo_personal')}
                  className="flex items-center gap-1.5 group"
                  title="Copiar correo personal"
                >
                  <span className="text-sm text-gray-800">{docente.correo_personal || '-'}</span>
                  {docente.correo_personal && (
                    <span className={`text-xs transition ${copiado === 'correo_personal' ? 'text-green-500' : 'text-gray-300 group-hover:text-gray-400'}`}>
                      {copiado === 'correo_personal' ? '✓' : '⎘'}
                    </span>
                  )}
                </button>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Contacto</p>
                <button
                  onClick={() => docente.contacto && copiar(docente.contacto, 'contacto')}
                  className="flex items-center gap-1.5 group"
                  title="Copiar contacto"
                >
                  <span className="text-sm text-gray-800">{docente.contacto || '-'}</span>
                  {docente.contacto && (
                    <span className={`text-xs transition ${copiado === 'contacto' ? 'text-green-500' : 'text-gray-300 group-hover:text-gray-400'}`}>
                      {copiado === 'contacto' ? '✓' : '⎘'}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Columna derecha: horarios */}
          {horarios.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden flex-shrink-0" style={{ minWidth: '26rem' }}>
              <div className="px-4 py-2.5 border-b border-gray-100">
                <h2 className="font-semibold text-gray-700 text-sm">Horarios — Ciclo 2027-1</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-400 uppercase tracking-wide">
                    <th className="text-left px-4 py-2">Clave</th>
                    <th className="text-left px-3 py-2">Salón · Día · Horario</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {horarios.map((h, i) => (
                    <tr key={i} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <p className="font-mono text-blue-600 font-medium text-xs">{h.clave}</p>
                        <p className="text-gray-500 text-xs mt-0.5 leading-tight">{h.materia}</p>
                      </td>
                      <td className="px-3 py-2.5 text-gray-600 font-mono text-xs">{h.salon}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Primera Evaluación de Cumplimiento — snapshot fijo */}
        {(() => {
          const COLS_EVAL = [
            { key: 'asistencia', label: 'Asistencia' },
            { key: 'temarios_oficina', label: 'Acuse de Programa' },
            { key: 'temarios_bs', label: 'Temario en Brightspace' },
            { key: 'materiales_bibliografia', label: 'Método de Evaluación' },
            { key: 'evaluacion_intermedia', label: 'Apartado de Calificaciones' },
          ]
          const fmtVal = (key: string, val: string | null) => {
            if (val === 'SI' || val === 'A DESTIEMPO') return 'Ok'
            if (key === 'evaluacion_intermedia') return val === 'NO' ? 'Pendiente creación de apartado' : 'Pendiente suma de actividades del 100%'
            return 'Pendiente'
          }
          // Si está congelada, usar snapshot; si no, datos en vivo
          const filas: { id: number; materia: string; grupo: string; enlace: string | null; seg: Record<string, string | null> }[] =
            primeraFrozen
              ? snapshotPrimera.map(s => ({ id: s.clave_id, materia: s.materia, grupo: s.grupo, enlace: s.enlace, seg: { asistencia: s.asistencia, temarios_oficina: s.temarios_oficina, temarios_bs: s.temarios_bs, materiales_bibliografia: s.materiales_bibliografia, evaluacion_intermedia: s.evaluacion_intermedia, observaciones: s.observaciones } }))
              : docente.grupos.filter((g: any) => g.bloque !== '2').map((g: any) => ({ id: g.id, materia: g.materia, grupo: g.grupo, enlace: g.enlace, seg: segs[g.id] || {} }))
          const hayObs = filas.some(f => f.seg.observaciones)
          const copiarEvalHtml = () => {
            const rows = filas.map(f => {
              const grupoUrl = f.enlace || `${window.location.origin}/grupo/${f.id}`
              const materiaCell = `<a href="${grupoUrl}" style="color:#2563eb">${f.materia} ↗</a>${f.grupo ? ` <span style="font-size:11px;color:#6b7280">· Grupo ${f.grupo}</span>` : ''}`
              const obs = f.seg.observaciones ? `<td style="padding:6px 10px;border:1px solid #e5e7eb;font-size:13px">${f.seg.observaciones}</td>` : hayObs ? `<td style="padding:6px 10px;border:1px solid #e5e7eb"></td>` : ''
              return `<tr><td style="padding:6px 10px;border:1px solid #e5e7eb;font-size:13px">${materiaCell}</td>${COLS_EVAL.map(c => { const txt = fmtVal(c.key, f.seg[c.key] ?? null); const bg = txt === 'Ok' ? '#d1fae5' : txt === 'Pendiente creación de apartado' ? '#fee2e2' : '#fef9c3'; return `<td style="padding:6px 10px;border:1px solid #e5e7eb;font-size:13px;background:${bg};text-align:center">${txt}</td>` }).join('')}${obs}</tr>`
            }).join('')
            const obsHeader = hayObs ? `<th style="padding:6px 10px;border:1px solid #e5e7eb;background:#f3f4f6;font-size:12px">Observaciones</th>` : ''
            const html = `<table style="border-collapse:collapse;font-family:Arial,sans-serif"><thead><tr><th style="padding:6px 10px;border:1px solid #e5e7eb;background:#f3f4f6;font-size:12px">Materia</th>${COLS_EVAL.map(c => `<th style="padding:6px 10px;border:1px solid #e5e7eb;background:#f3f4f6;font-size:12px">${c.label}</th>`).join('')}${obsHeader}</tr></thead><tbody>${rows}</tbody></table>`
            navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }) })])
            setCopiadoEval(true); setTimeout(() => setCopiadoEval(false), 2000)
          }
          return (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-3 flex items-center justify-between border-b border-gray-100">
                <button onClick={() => setMostrarEval(v => !v)} className="flex items-center gap-2 font-semibold text-gray-700 hover:text-gray-900 transition text-sm">
                  <span>{mostrarEval ? '▾' : '▸'}</span>
                  Primera Evaluación de Cumplimiento
                  {primeraFrozen
                    ? <span className="ml-2 text-xs font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Corte 31 ago</span>
                    : <span className="ml-2 text-xs font-normal text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Sin congelar</span>
                  }
                </button>
                <div className="flex items-center gap-2">
                  {!primeraFrozen && (
                    <button onClick={congelarPrimera} disabled={congelando} className="text-xs px-3 py-1.5 rounded-lg border font-medium bg-amber-500 text-white border-amber-500 hover:bg-amber-600 disabled:opacity-50 transition">
                      {congelando ? 'Guardando…' : '🔒 Congelar al 31 ago'}
                    </button>
                  )}
                  {mostrarEval && (
                    <button onClick={copiarEvalHtml} className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition ${copiadoEval ? 'bg-green-500 text-white border-green-500' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'}`}>
                      {copiadoEval ? '✓ Copiado' : '⎘ Copiar para correo'}
                    </button>
                  )}
                </div>
              </div>
              {mostrarEval && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                        <th className="text-left px-4 py-2.5 font-medium">Materia</th>
                        {COLS_EVAL.map(c => <th key={c.key} className="text-center px-3 py-2.5 font-medium whitespace-nowrap">{c.label}</th>)}
                        {hayObs && <th className="text-left px-3 py-2.5 font-medium">Observaciones</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filas.map(f => (
                        <tr key={f.id} className="hover:bg-gray-50 transition">
                          <td className="px-4 py-2.5">
                            <a href={f.enlace || `/grupo/${f.id}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs font-medium">{f.materia} ↗</a>
                            {f.grupo ? <span className="text-gray-400 text-xs ml-1.5">· Grupo {f.grupo}</span> : null}
                          </td>
                          {COLS_EVAL.map(c => {
                            const val = f.seg[c.key] ?? null
                            const txt = fmtVal(c.key, val)
                            const cls = txt === 'Ok' ? 'bg-green-100 text-green-700' : txt === 'Pendiente creación de apartado' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                            return <td key={c.key} className="px-3 py-2.5 text-center"><span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{txt}</span></td>
                          })}
                          {hayObs && <td className="px-3 py-2.5 text-xs text-gray-600">{f.seg.observaciones || ''}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })()}

        {/* Segunda Evaluación de Cumplimiento — siempre en vivo */}
        {(() => {
          const COLS_EVAL2 = [
            { key: 'asistencia', label: 'Asistencia' },
            { key: 'temarios_oficina', label: 'Acuse de Programa' },
            { key: 'temarios_bs', label: 'Temario en Brightspace' },
            { key: 'materiales_bibliografia', label: 'Método de Evaluación' },
            { key: 'evaluacion_intermedia', label: 'Apartado de Calificaciones' },
            { key: 'evaluacion_final', label: 'Evaluación Final' },
          ]
          const fmtVal2 = (key: string, val: string | null) => {
            if (val === 'SI' || val === 'A DESTIEMPO') return 'Ok'
            if (key === 'evaluacion_intermedia') return val === 'NO' ? 'Pendiente creación de apartado' : 'Pendiente suma de actividades del 100%'
            return 'Pendiente'
          }
          const gruposEval2 = docente.grupos.filter((g: any) => g.bloque !== '2')
          const hayObs2 = gruposEval2.some((g: any) => segs[g.id]?.observaciones)
          const copiarSegundaHtml = () => {
            const rows = gruposEval2.map((g: any) => {
              const seg = segs[g.id] || {}
              const grupoUrl = g.enlace || `${window.location.origin}/grupo/${g.id}`
              const materiaCell = `<a href="${grupoUrl}" style="color:#2563eb">${g.materia} ↗</a>${g.grupo ? ` <span style="font-size:11px;color:#6b7280">· Grupo ${g.grupo}</span>` : ''}`
              const obs = (seg as any).observaciones ? `<td style="padding:6px 10px;border:1px solid #e5e7eb;font-size:13px">${(seg as any).observaciones}</td>` : hayObs2 ? `<td style="padding:6px 10px;border:1px solid #e5e7eb"></td>` : ''
              return `<tr><td style="padding:6px 10px;border:1px solid #e5e7eb;font-size:13px">${materiaCell}</td>${COLS_EVAL2.map(c => { const v = seg[c.key as keyof SegMateria] as string | null; const txt = fmtVal2(c.key, v ?? null); const bg = txt === 'Ok' ? '#d1fae5' : txt === 'Pendiente creación de apartado' ? '#fee2e2' : '#fef9c3'; return `<td style="padding:6px 10px;border:1px solid #e5e7eb;font-size:13px;background:${bg};text-align:center">${txt}</td>` }).join('')}${obs}</tr>`
            }).join('')
            const obsHeader = hayObs2 ? `<th style="padding:6px 10px;border:1px solid #e5e7eb;background:#f3f4f6;font-size:12px">Observaciones</th>` : ''
            const html = `<table style="border-collapse:collapse;font-family:Arial,sans-serif"><thead><tr><th style="padding:6px 10px;border:1px solid #e5e7eb;background:#f3f4f6;font-size:12px">Materia</th>${COLS_EVAL2.map(c => `<th style="padding:6px 10px;border:1px solid #e5e7eb;background:#f3f4f6;font-size:12px">${c.label}</th>`).join('')}${obsHeader}</tr></thead><tbody>${rows}</tbody></table>`
            navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }) })])
            setCopiadoSegundaEval(true); setTimeout(() => setCopiadoSegundaEval(false), 2000)
          }
          return (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-3 flex items-center justify-between border-b border-gray-100">
                <button onClick={() => setMostrarSegundaEval(v => !v)} className="flex items-center gap-2 font-semibold text-gray-700 hover:text-gray-900 transition text-sm">
                  <span>{mostrarSegundaEval ? '▾' : '▸'}</span>
                  Segunda Evaluación de Cumplimiento
                  <span className="ml-2 text-xs font-normal text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">En vivo</span>
                </button>
                {mostrarSegundaEval && (
                  <button onClick={copiarSegundaHtml} className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition ${copiadoSegundaEval ? 'bg-green-500 text-white border-green-500' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'}`}>
                    {copiadoSegundaEval ? '✓ Copiado' : '⎘ Copiar para correo'}
                  </button>
                )}
              </div>
              {mostrarSegundaEval && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                        <th className="text-left px-4 py-2.5 font-medium">Materia</th>
                        {COLS_EVAL2.map(c => <th key={c.key} className="text-center px-3 py-2.5 font-medium whitespace-nowrap">{c.label}</th>)}
                        {hayObs2 && <th className="text-left px-3 py-2.5 font-medium">Observaciones</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {gruposEval2.map((g: any) => {
                        const seg = segs[g.id] || {}
                        return (
                          <tr key={g.id} className="hover:bg-gray-50 transition">
                            <td className="px-4 py-2.5">
                              <a href={g.enlace || `/grupo/${g.id}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs font-medium">{g.materia} ↗</a>
                              {g.grupo ? <span className="text-gray-400 text-xs ml-1.5">· Grupo {g.grupo}</span> : null}
                            </td>
                            {COLS_EVAL2.map(c => {
                              const val = seg[c.key as keyof SegMateria] as string | null ?? null
                              const txt = fmtVal2(c.key, val)
                              const cls = txt === 'Ok' ? 'bg-green-100 text-green-700' : txt === 'Pendiente creación de apartado' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                              return <td key={c.key} className="px-3 py-2.5 text-center"><span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{txt}</span></td>
                            })}
                            {hayObs2 && <td className="px-3 py-2.5 text-xs text-gray-600">{(seg as any).observaciones || ''}</td>}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })()}

        {/* Reposición de clases — colapsable */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 flex items-center justify-between border-b border-gray-100">
            <button onClick={() => setMostrarRepo(v => !v)} className="flex items-center gap-2 font-semibold text-gray-700 hover:text-gray-900 transition text-sm">
              <span>{mostrarRepo ? '▾' : '▸'}</span>
              Reposición de clases
              {reposiciones.length > 0
                ? <span className="ml-1 text-xs font-normal bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">{reposiciones.length} {reposiciones.length === 1 ? 'reposición' : 'reposiciones'}</span>
                : <span className="ml-1 text-xs font-normal text-gray-400">Sin registros</span>
              }
            </button>
            <div className="flex items-center gap-2">
              {reposiciones.length > 0 && (
                <button
                  onClick={() => {
                    const EXCLUIDAS = new Set(['Asignatura','OBSERVACIONES','Seccion'])
                    const fmtF = (f: string | null) => { if (!f) return '—'; const d = new Date(f.toString().slice(0,10) + 'T12:00:00'); return isNaN(d.getTime()) ? String(f) : d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) }
                    // Agrupar igual que la tabla
                    const grupos2: { key: string; repos: typeof reposiciones }[] = []
                    const seen2: Record<string, number> = {}
                    for (const repo of reposiciones) {
                      const k = `${repo.clase}||${repo.fecha_clase}||${repo.hora_clase}`
                      if (seen2[k] === undefined) { seen2[k] = grupos2.length; grupos2.push({ key: k, repos: [repo] }) }
                      else grupos2[seen2[k]].repos.push(repo)
                    }
                    const filas = grupos2.map(({ repos }) => {
                      const f = repos[0]
                      const repRows = repos.map((r, i) => `
                        <tr>
                          ${i === 0 ? `<td rowspan="${repos.length}" style="padding:8px 12px;border:1px solid #e5e7eb;vertical-align:top;font-weight:600">${f.clase}</td>
                          <td rowspan="${repos.length}" style="padding:8px 12px;border:1px solid #e5e7eb;vertical-align:top">${fmtF(f.fecha_clase)}</td>
                          <td rowspan="${repos.length}" style="padding:8px 12px;border:1px solid #e5e7eb;vertical-align:top">${f.hora_clase || '—'}</td>` : ''}
                          <td style="padding:8px 12px;border:1px solid #e5e7eb">${r.estado}</td>
                          <td style="padding:8px 12px;border:1px solid #e5e7eb;background:#eff6ff">${fmtF(r.fecha_reposicion)}</td>
                          <td style="padding:8px 12px;border:1px solid #e5e7eb;background:#eff6ff">${r.hora_inicio ? `${r.hora_inicio.slice(0,5)}${r.hora_fin ? ` – ${r.hora_fin.slice(0,5)}` : ''}` : '—'}</td>
                          <td style="padding:8px 12px;border:1px solid #e5e7eb;background:#eff6ff;font-family:monospace">${r.salon || '—'}</td>
                          <td style="padding:8px 12px;border:1px solid #e5e7eb;background:#eff6ff;color:#6b7280;font-size:12px">${r.notas || '—'}</td>
                        </tr>`).join('')
                      return repRows
                    }).join('')
                    const html = `<table style="border-collapse:collapse;font-family:sans-serif;font-size:13px;width:100%">
                      <thead>
                        <tr style="background:#f9fafb">
                          <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left;color:#374151">Clase a reponer</th>
                          <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left;color:#374151">Fecha de clase</th>
                          <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left;color:#374151">Hora</th>
                          <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left;color:#374151">Estado</th>
                          <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left;color:#3b82f6;background:#eff6ff">Fecha de reposición</th>
                          <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left;color:#3b82f6;background:#eff6ff">Hora reposición</th>
                          <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left;color:#3b82f6;background:#eff6ff">Salón</th>
                          <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left;color:#3b82f6;background:#eff6ff">Notas</th>
                        </tr>
                      </thead>
                      <tbody>${filas}</tbody>
                    </table>`
                    const blob = new Blob([html], { type: 'text/html' })
                    const plain = grupos2.map(({ repos }) => {
                      const f = repos[0]
                      return repos.map((r, i) => [
                        i === 0 ? f.clase : '', i === 0 ? fmtF(f.fecha_clase) : '', i === 0 ? (f.hora_clase || '—') : '',
                        r.estado, fmtF(r.fecha_reposicion), r.hora_inicio ? `${r.hora_inicio.slice(0,5)}${r.hora_fin ? ` – ${r.hora_fin.slice(0,5)}` : ''}` : '—', r.salon || '—', r.notas || '—'
                      ].join('\t')).join('\n')
                    }).join('\n')
                    navigator.clipboard.write([new ClipboardItem({ 'text/html': blob, 'text/plain': new Blob([plain], { type: 'text/plain' }) })])
                      .then(() => { setCopiadoRepo(true); setTimeout(() => setCopiadoRepo(false), 2000) })
                  }}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition ${copiadoRepo ? 'bg-green-500 text-white border-green-500' : 'border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600 bg-white'}`}
                >
                  {copiadoRepo ? '✓ Copiado' : '📋 Copiar tabla'}
                </button>
              )}
              <button
                onClick={() => setMostrarRepo(true)}
                className="text-xs px-3 py-1.5 rounded-lg border border-dashed border-orange-300 text-orange-500 hover:bg-orange-50 font-medium transition"
                title="Registrar reposición"
              >
                + Agregar
              </button>
            </div>
          </div>
          {mostrarRepo && (
            <div>
              {reposiciones.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                      <tr>
                        <th className="px-4 py-3 text-left text-gray-600">Clase</th>
                        <th className="px-4 py-3 text-left text-gray-600">Fecha de clase</th>
                        <th className="px-4 py-3 text-left text-gray-600">Hora</th>
                        <th className="px-4 py-3 text-left text-gray-600">Estado</th>
                        <th className="px-4 py-3 text-left text-blue-600 bg-blue-50">Fecha de reposición</th>
                        <th className="px-4 py-3 text-left text-blue-600 bg-blue-50">Hora reposición</th>
                        <th className="px-4 py-3 text-left text-blue-600 bg-blue-50">Salón</th>
                        <th className="px-4 py-3 text-left text-blue-600 bg-blue-50">Notas</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const fmtFecha = (f: string | null) => { if (!f) return '—'; const d = new Date(f.toString().slice(0,10) + 'T12:00:00'); return isNaN(d.getTime()) ? f : d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) }
                        // Agrupar por clase + fecha_clase + hora_clase
                        const grupos: { key: string; repos: Reposicion[] }[] = []
                        const seen: Record<string, number> = {}
                        for (const repo of reposiciones) {
                          const k = `${repo.clase}||${repo.fecha_clase}||${repo.hora_clase}`
                          if (seen[k] === undefined) { seen[k] = grupos.length; grupos.push({ key: k, repos: [repo] }) }
                          else grupos[seen[k]].repos.push(repo)
                        }
                        return grupos.map(({ key, repos }, gi) => {
                          const first = repos[0]
                          return repos.map((repo, ri) => {
                            const isFirst = ri === 0
                            const isLast = ri === repos.length - 1
                            const borderTop = gi > 0 && isFirst ? 'border-t-2 border-gray-200' : ri > 0 ? 'border-t border-blue-100' : ''
                            if (editandoRepo === repo.id) return (
                              <tr key={repo.id} className={`bg-orange-50 ${borderTop}`}>
                                {isFirst && <td rowSpan={repos.length} className="px-4 py-2 align-top border-r border-gray-100"><input defaultValue={repo.clase} id={`repo-clase-${repo.id}`} className="border rounded px-2 py-1 text-xs w-40" /></td>}
                                {isFirst && <td rowSpan={repos.length} className="px-4 py-2 align-top border-r border-gray-100"><input type="date" defaultValue={repo.fecha_clase ? repo.fecha_clase.toString().slice(0,10) : ''} id={`repo-fc-${repo.id}`} className="border rounded px-2 py-1 text-xs" /></td>}
                                {isFirst && <td rowSpan={repos.length} className="px-4 py-2 align-top border-r border-gray-100"><input defaultValue={repo.hora_clase || ''} id={`repo-hc-${repo.id}`} placeholder="Ej. 10:00-12:00" className="border rounded px-2 py-1 text-xs w-28" /></td>}
                                <td className="px-4 py-2">
                                  <select id={`repo-estado-${repo.id}`} defaultValue={repo.estado} className="border rounded px-2 py-1 text-xs">
                                    <option>Pendiente</option><option>Agendada</option><option>Repuesta</option><option>Cancelada</option>
                                  </select>
                                </td>
                                <td className="px-4 py-2 bg-blue-50"><input type="date" defaultValue={repo.fecha_reposicion ? repo.fecha_reposicion.toString().slice(0,10) : ''} id={`repo-fr-${repo.id}`} className="border rounded px-2 py-1 text-xs" /></td>
                                <td className="px-4 py-2 bg-blue-50">
                                  <div className="flex gap-1 items-center">
                                    <input type="time" defaultValue={repo.hora_inicio || ''} id={`repo-hi-${repo.id}`} className="border rounded px-2 py-1 text-xs w-20" />
                                    <span className="text-gray-400 text-xs">–</span>
                                    <input type="time" defaultValue={repo.hora_fin || ''} id={`repo-hf-${repo.id}`} className="border rounded px-2 py-1 text-xs w-20" />
                                  </div>
                                </td>
                                <td className="px-4 py-2 bg-blue-50"><input defaultValue={repo.salon || ''} id={`repo-salon-${repo.id}`} placeholder="B404" className="border rounded px-2 py-1 text-xs w-20" /></td>
                                <td className="px-4 py-2 bg-blue-50"><input defaultValue={repo.notas || ''} id={`repo-notas-${repo.id}`} className="border rounded px-2 py-1 text-xs w-full" /></td>
                                <td className="px-4 py-2">
                                  <div className="flex gap-2">
                                    <button onClick={() => actualizarRepo({ ...repo, clase: (document.getElementById(`repo-clase-${repo.id}`) as HTMLInputElement)?.value || repo.clase, fecha_clase: (document.getElementById(`repo-fc-${repo.id}`) as HTMLInputElement)?.value || null, hora_clase: (document.getElementById(`repo-hc-${repo.id}`) as HTMLInputElement)?.value || null, estado: (document.getElementById(`repo-estado-${repo.id}`) as HTMLSelectElement)?.value || repo.estado, fecha_reposicion: (document.getElementById(`repo-fr-${repo.id}`) as HTMLInputElement)?.value || null, hora_inicio: (document.getElementById(`repo-hi-${repo.id}`) as HTMLInputElement)?.value || null, hora_fin: (document.getElementById(`repo-hf-${repo.id}`) as HTMLInputElement)?.value || null, salon: (document.getElementById(`repo-salon-${repo.id}`) as HTMLInputElement)?.value || null, notas: (document.getElementById(`repo-notas-${repo.id}`) as HTMLInputElement)?.value || null })} className="text-xs bg-green-500 text-white rounded px-2 py-1">Guardar</button>
                                    <button onClick={() => setEditandoRepo(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancelar</button>
                                  </div>
                                </td>
                              </tr>
                            )
                            return (
                              <tr key={repo.id} className={`hover:bg-gray-50 ${borderTop}`}>
                                {isFirst && <td rowSpan={repos.length} className={`px-4 py-3 text-gray-800 font-medium text-sm align-top border-r border-gray-100 ${isLast ? '' : ''}`}>{first.clase}</td>}
                                {isFirst && <td rowSpan={repos.length} className="px-4 py-3 text-gray-600 text-sm align-top border-r border-gray-100">{fmtFecha(first.fecha_clase)}</td>}
                                {isFirst && <td rowSpan={repos.length} className="px-4 py-3 text-gray-600 text-sm align-top border-r border-gray-100">{first.hora_clase || '—'}</td>}
                                <td className="px-4 py-3"><span className={`text-xs font-semibold px-2 py-1 rounded-full ${repo.estado === 'Repuesta' ? 'bg-green-100 text-green-700' : repo.estado === 'Agendada' ? 'bg-blue-100 text-blue-700' : repo.estado === 'Cancelada' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{repo.estado}</span></td>
                                <td className="px-4 py-3 bg-blue-50 text-gray-700 text-sm">{fmtFecha(repo.fecha_reposicion)}</td>
                                <td className="px-4 py-3 bg-blue-50 text-gray-700 text-sm">{repo.hora_inicio ? `${repo.hora_inicio.slice(0,5)}${repo.hora_fin ? ` – ${repo.hora_fin.slice(0,5)}` : ''}` : '—'}</td>
                                <td className="px-4 py-3 bg-blue-50 text-gray-700 text-sm font-mono">{repo.salon || '—'}</td>
                                <td className="px-4 py-3 bg-blue-50 text-gray-500 text-xs">{repo.notas || '—'}</td>
                                <td className="px-4 py-3">
                                  <div className="flex gap-2 justify-end items-center">
                                    {isFirst && <button
                                      onClick={() => { setNuevaRepo({ clase: first.clase, fecha_clase: first.fecha_clase ? first.fecha_clase.toString().slice(0,10) : '', hora_clase: first.hora_clase || '', estado: 'Pendiente', fecha_reposicion: '', hora_inicio: '', hora_fin: '', salon: '', notas: '' }); const el = document.getElementById('form-nueva-repo'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}
                                      className="text-xs text-green-600 hover:text-green-800 font-semibold"
                                      title="Agregar otra fecha de reposición para esta clase"
                                    >+ rep.</button>}
                                    <button onClick={() => setEditandoRepo(repo.id)} className="text-xs text-blue-500 hover:text-blue-700">Editar</button>
                                    <button onClick={() => eliminarRepo(repo.id)} className="text-xs text-red-400 hover:text-red-600">✕</button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })
                        })
                      })()}
                    </tbody>
                  </table>
                </div>
              )}
              {/* Formulario nueva reposición */}
              <div id="form-nueva-repo" className="px-5 py-4 bg-gray-50 border-t border-gray-100">
                <div className="flex flex-wrap gap-3 items-end">
                  {/* Grupo 1: info de la clase perdida */}
                  <div className="flex flex-wrap gap-2 items-end p-3 bg-gray-100 rounded-lg">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-500 font-semibold">Clase *</label>
                      <input value={nuevaRepo.clase} onChange={e => setNuevaRepo(p => ({ ...p, clase: e.target.value }))} placeholder="Ej. Código 5 TCTM540-21-8" className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-500">Fecha de clase</label>
                      <input type="date" value={nuevaRepo.fecha_clase} onChange={e => setNuevaRepo(p => ({ ...p, fecha_clase: e.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-500">Hora</label>
                      <input value={nuevaRepo.hora_clase} onChange={e => setNuevaRepo(p => ({ ...p, hora_clase: e.target.value }))} placeholder="Ej. 10:00-12:00" className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-32 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-500">Estado</label>
                      <select value={nuevaRepo.estado} onChange={e => setNuevaRepo(p => ({ ...p, estado: e.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400">
                        <option>Pendiente</option><option>Agendada</option><option>Repuesta</option><option>Cancelada</option>
                      </select>
                    </div>
                  </div>
                  {/* Grupo 2: info de la reposición */}
                  <div className="flex flex-wrap gap-2 items-end p-3 bg-blue-50 rounded-lg">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-blue-600 font-semibold">Fecha de reposición</label>
                      <input type="date" value={nuevaRepo.fecha_reposicion} onChange={e => setNuevaRepo(p => ({ ...p, fecha_reposicion: e.target.value }))} className="border border-blue-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-blue-600">Inicio</label>
                      <input type="time" value={nuevaRepo.hora_inicio} onChange={e => setNuevaRepo(p => ({ ...p, hora_inicio: e.target.value }))} className="border border-blue-200 rounded-lg px-3 py-2 text-sm w-28 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-blue-600">Fin</label>
                      <input type="time" value={nuevaRepo.hora_fin} onChange={e => setNuevaRepo(p => ({ ...p, hora_fin: e.target.value }))} className="border border-blue-200 rounded-lg px-3 py-2 text-sm w-28 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-blue-600">Salón</label>
                      <input value={nuevaRepo.salon} onChange={e => setNuevaRepo(p => ({ ...p, salon: e.target.value }))} placeholder="B404" className="border border-blue-200 rounded-lg px-3 py-2 text-sm w-24 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-blue-600">Notas</label>
                      <input value={nuevaRepo.notas} onChange={e => setNuevaRepo(p => ({ ...p, notas: e.target.value }))} placeholder="Opcional" className="border border-blue-200 rounded-lg px-3 py-2 text-sm w-36 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    </div>
                  </div>
                  <button onClick={agregarRepo} disabled={guardandoRepo || !nuevaRepo.clase.trim()} className="bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white rounded-lg px-4 py-2 text-sm font-semibold transition self-end">
                    {guardandoRepo ? 'Guardando…' : '+ Agregar'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-semibold text-gray-700">Seguimiento por materia — Ciclo 2027-1</h2>
            <p className="text-xs text-gray-400">Clic para cambiar estado</p>
          </div>

          {docente.grupos.length === 0 && (
            <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-400">
              No hay materias asignadas a este docente
            </div>
          )}

          {docente.grupos.map(g => {
            const seg = segs[g.id] || {}
            const esBloque2 = g.bloque === '2'
            const completados = esBloque2 ? 0 : CAMPOS_PCT.reduce((acc, c) => {
              const v = seg[c.key as keyof SegMateria]
              return acc + (v === 'SI' ? 1 : v === 'A DESTIEMPO' ? 0.8 : v === 'FALTA' ? 0.5 : 0)
            }, 0)
            const pct = esBloque2 ? null : Math.round((completados / CAMPOS_PCT.length) * 100)
            const estaEditado = editados.has(g.id)

            return (
              <div key={g.id} className={`rounded-xl shadow-sm overflow-hidden ${esBloque2 ? 'bg-red-50 border border-red-200' : 'bg-white'}`}>
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-blue-600 font-medium text-sm">{g.clave}</span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{g.semestre}</span>
                      {g.enlace ? (
                        <button
                          onClick={() => window.open(g.enlace!, '_blank')}
                          className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-200 hover:bg-blue-100 transition"
                        >
                          Brightspace
                        </button>
                      ) : null}
                    </div>
                    <p className="text-gray-800 font-medium mt-0.5">{g.materia}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      {esBloque2 ? (
                        <p className="text-xs font-medium text-red-500 bg-red-100 px-2 py-0.5 rounded-full">Bloque 2 · Oct</p>
                      ) : (
                        <>
                          <p className={`text-sm font-bold ${pct === 100 ? 'text-green-600' : pct! >= 50 ? 'text-blue-600' : 'text-orange-500'}`}>
                            {pct}%
                          </p>
                          <p className="text-xs text-gray-400">{completados}/{CAMPOS_PCT.length}</p>
                        </>
                      )}
                    </div>
                    {estaEditado && (
                      <button
                        onClick={() => guardarMateria(g.id)}
                        disabled={guardando === g.id}
                        className="bg-green-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
                      >
                        {guardando === g.id ? 'Guardando...' : 'Guardar'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="px-5 py-4 space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                    {CAMPOS.map(campo => {
                      const val = seg[campo.key as keyof SegMateria] as string | null
                      return (
                        <div key={campo.key} className="text-center">
                          {campo.key === 'temarios_oficina' ? (
                            <a
                              href={`/grupo/${g.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-500 hover:underline mb-2 leading-tight block"
                            >
                              {campo.label} ↗
                            </a>
                          ) : (
                            <p className="text-xs text-gray-500 mb-2 leading-tight">{campo.label}</p>
                          )}
                          {campo.key === 'temarios_oficina' ? (
                            <button
                              onClick={() => toggleCampo(g.id, campo.key)}
                              className={`w-full h-9 rounded-lg border-2 text-sm font-bold transition ${colorCheck(val)}`}
                            >
                              {iconCheck(val)}
                            </button>
                          ) : campo.key === 'evaluacion_intermedia' ? (
                            <select
                              value={val ?? ''}
                              onChange={e => {
                                const v = e.target.value || null
                                setSegs(prev => ({ ...prev, [g.id]: { ...prev[g.id], evaluacion_intermedia: v } }))
                                setEditados(prev => new Set(prev).add(g.id))
                              }}
                              className={`w-full h-9 rounded-lg border-2 text-xs font-bold text-center cursor-pointer transition appearance-none ${
                                val === 'SI' ? 'bg-green-500 border-green-600 text-white' :
                                val === 'A DESTIEMPO' ? 'bg-green-300 border-green-400 text-green-900' :
                                val === 'NO' ? 'bg-red-500 border-red-600 text-white' :
                                val === 'FALTA' ? 'bg-orange-400 border-orange-500 text-white' :
                                'bg-white border-gray-200 text-gray-400'
                              }`}
                            >
                              <option value="">--</option>
                              <option value="SI">SI — 100%</option>
                              <option value="A DESTIEMPO">A Destiempo — 80%</option>
                              <option value="FALTA">Falta configurar — 50%</option>
                              <option value="NO">NO — 0%</option>
                            </select>
                          ) : (
                            <button
                              onClick={() => toggleCampo(g.id, campo.key)}
                              className={`w-full h-9 rounded-lg border-2 text-sm font-bold transition ${colorCheck(val)}`}
                            >
                              {iconCheck(val)}
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Observaciones</p>
                    <textarea
                      value={seg.observaciones ?? ''}
                      onChange={e => {
                        setSegs(prev => ({ ...prev, [g.id]: { ...prev[g.id], observaciones: e.target.value || null } }))
                        setEditados(prev => new Set(prev).add(g.id))
                      }}
                      placeholder="Escribe una observación..."
                      rows={2}
                      className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none text-gray-700 placeholder-gray-300"
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Reposiciones eliminadas — ahora arriba */}
        <div className="hidden">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-700">Reposición de clases — Ciclo 2027-1</h2>
              <span className="text-xs text-gray-400">{reposiciones.length} registro{reposiciones.length !== 1 ? 's' : ''}</span>
            </div>

            {/* Tabla */}
            {reposiciones.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                    <tr>
                      <th className="px-4 py-3 text-left">Clase a reponer</th>
                      <th className="px-4 py-3 text-left">Fecha</th>
                      <th className="px-4 py-3 text-left">Horario</th>
                      <th className="px-4 py-3 text-left">Estado</th>
                      <th className="px-4 py-3 text-left">Notas</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {reposiciones.map(repo => editandoRepo === repo.id ? (
                      <tr key={repo.id} className="bg-orange-50">
                        <td className="px-4 py-2"><input defaultValue={repo.clase} id={`repo-clase-${repo.id}`} className="border rounded px-2 py-1 text-xs w-full" /></td>
                        <td className="px-4 py-2"><input type="date" defaultValue={repo.fecha_reposicion || ''} id={`repo-fecha-${repo.id}`} className="border rounded px-2 py-1 text-xs w-full" /></td>
                        <td className="px-4 py-2 flex gap-1">
                          <input type="time" defaultValue={repo.hora_inicio || ''} id={`repo-hi-${repo.id}`} className="border rounded px-2 py-1 text-xs w-24" />
                          <span className="self-center text-gray-400">–</span>
                          <input type="time" defaultValue={repo.hora_fin || ''} id={`repo-hf-${repo.id}`} className="border rounded px-2 py-1 text-xs w-24" />
                        </td>
                        <td className="px-4 py-2">
                          <select id={`repo-estado-${repo.id}`} defaultValue={repo.estado} className="border rounded px-2 py-1 text-xs">
                            <option>Pendiente</option>
                            <option>Repuesta</option>
                            <option>Cancelada</option>
                          </select>
                        </td>
                        <td className="px-4 py-2"><input defaultValue={repo.notas || ''} id={`repo-notas-${repo.id}`} className="border rounded px-2 py-1 text-xs w-full" /></td>
                        <td className="px-4 py-2 flex gap-2">
                          <button onClick={() => actualizarRepo({
                            ...repo,
                            clase: (document.getElementById(`repo-clase-${repo.id}`) as HTMLInputElement)?.value || repo.clase,
                            fecha_reposicion: (document.getElementById(`repo-fecha-${repo.id}`) as HTMLInputElement)?.value || null,
                            hora_inicio: (document.getElementById(`repo-hi-${repo.id}`) as HTMLInputElement)?.value || null,
                            hora_fin: (document.getElementById(`repo-hf-${repo.id}`) as HTMLInputElement)?.value || null,
                            estado: (document.getElementById(`repo-estado-${repo.id}`) as HTMLSelectElement)?.value || repo.estado,
                            notas: (document.getElementById(`repo-notas-${repo.id}`) as HTMLInputElement)?.value || null,
                          })} className="text-xs bg-green-500 text-white rounded px-2 py-1">Guardar</button>
                          <button onClick={() => setEditandoRepo(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancelar</button>
                        </td>
                      </tr>
                    ) : (
                      <tr key={repo.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-800 font-medium">{repo.clase}</td>
                        <td className="px-4 py-3 text-gray-600">{repo.fecha_reposicion ? new Date(repo.fecha_reposicion + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{repo.hora_inicio ? `${repo.hora_inicio.slice(0,5)}${repo.hora_fin ? ` – ${repo.hora_fin.slice(0,5)}` : ''}` : '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${repo.estado === 'Repuesta' ? 'bg-green-100 text-green-700' : repo.estado === 'Cancelada' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{repo.estado}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{repo.notas || '—'}</td>
                        <td className="px-4 py-3 flex gap-2 justify-end">
                          <button onClick={() => setEditandoRepo(repo.id)} className="text-xs text-blue-500 hover:text-blue-700">Editar</button>
                          <button onClick={() => eliminarRepo(repo.id)} className="text-xs text-red-400 hover:text-red-600">✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Formulario nueva reposición */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">Agregar reposición</p>
              <div className="flex flex-wrap gap-2 items-end">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500">Clase a reponer *</label>
                  <input
                    value={nuevaRepo.clase}
                    onChange={e => setNuevaRepo(p => ({ ...p, clase: e.target.value }))}
                    placeholder="Ej. Sesión 5 – Composición"
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500">Fecha de reposición</label>
                  <input
                    type="date"
                    value={nuevaRepo.fecha_reposicion}
                    onChange={e => setNuevaRepo(p => ({ ...p, fecha_reposicion: e.target.value }))}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500">Hora inicio</label>
                  <input
                    type="time"
                    value={nuevaRepo.hora_inicio}
                    onChange={e => setNuevaRepo(p => ({ ...p, hora_inicio: e.target.value }))}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500">Hora fin</label>
                  <input
                    type="time"
                    value={nuevaRepo.hora_fin}
                    onChange={e => setNuevaRepo(p => ({ ...p, hora_fin: e.target.value }))}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500">Estado</label>
                  <select
                    value={nuevaRepo.estado}
                    onChange={e => setNuevaRepo(p => ({ ...p, estado: e.target.value }))}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  >
                    <option>Pendiente</option>
                    <option>Repuesta</option>
                    <option>Cancelada</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500">Notas</label>
                  <input
                    value={nuevaRepo.notas}
                    onChange={e => setNuevaRepo(p => ({ ...p, notas: e.target.value }))}
                    placeholder="Opcional"
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
                <button
                  onClick={agregarRepo}
                  disabled={guardandoRepo || !nuevaRepo.clase.trim()}
                  className="bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white rounded-lg px-4 py-2 text-sm font-semibold transition"
                >
                  {guardandoRepo ? 'Guardando…' : '+ Agregar'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Asistencias Core */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mt-6">
          <button
            onClick={() => setMostrarSesiones(p => !p)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition"
          >
            <div className="flex items-center gap-3">
              <span className="text-base font-semibold text-gray-700">Sesiones por materia — Core</span>
              {sesionesCore.length > 0 && (
                <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full">{sesionesCore.length} materias</span>
              )}
            </div>
            <span className="text-gray-400 text-lg">{mostrarSesiones ? '▲' : '▼'}</span>
          </button>

          {mostrarSesiones && (
            <div className="border-t border-gray-100">
              {sesionesCore.length === 0 ? (
                <p className="px-6 py-4 text-sm text-gray-400">Sin datos cargados. Sube el archivo en Admin → Asistencias Core.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                      <tr>
                        <th className="px-4 py-3 text-left">Clave</th>
                        <th className="px-4 py-3 text-left">Materia</th>
                        <th className="px-4 py-3 text-center">Sesiones</th>
                        <th className="px-4 py-3 text-center">Esperadas</th>
                        <th className="px-4 py-3 text-center">Semáforo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {sesionesCore.map(s => {
                        // Nombre que el docente reconoce (desde sus grupos), fallback al nombre de Core
                        const grupoMatch = docente?.grupos.find(g => g.clave === s.clave_asignatura)
                        const nombreMostrar = grupoMatch?.materia || s.nombre_asignatura
                        const nombreCore = grupoMatch ? s.nombre_asignatura : null

                        // Detectar doble sesión tanto en el nombre Core como en el nombre del grupo
                        const esDoble = DOBLE_SESION.test(s.nombre_asignatura || '') || DOBLE_SESION.test(grupoMatch?.materia || '')
                        const esperadas = esDoble ? 8 : 4
                        const sesiones = s.sesiones_por_clase ?? 0
                        const diff = esperadas - sesiones
                        const semaforo = diff <= 0 ? 'green' : diff <= 2 ? 'yellow' : 'red'
                        const semaforoClass = semaforo === 'green'
                          ? 'bg-green-100 text-green-700'
                          : semaforo === 'yellow'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                        const semaforoLabel = semaforo === 'green' ? '✓ Al día' : semaforo === 'yellow' ? '⚠ 1-2 atrás' : '✗ 3+ atrás'
                        return (
                          <tr key={s.clave_asignatura} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-mono text-blue-600 text-xs">{s.clave_asignatura}</td>
                            <td className="px-4 py-3">
                              <div className="text-gray-800 font-medium">{nombreMostrar}</div>
                              {nombreCore && <div className="text-xs text-gray-400 mt-0.5">{nombreCore}</div>}
                            </td>
                            <td className="px-4 py-3 text-center font-semibold">{sesiones}</td>
                            <td className="px-4 py-3 text-center text-gray-400">{esperadas}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${semaforoClass}`}>{semaforoLabel}</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {sesionesCore[0]?.fecha_corte && (
                    <p className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100">
                      Corte: {new Date(sesionesCore[0].fecha_corte).toLocaleDateString('es-MX')}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

      </main>
    </div>
  )
}