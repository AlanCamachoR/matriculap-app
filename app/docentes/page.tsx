'use client'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback, useRef } from 'react'
import Breadcrumb from '@/app/components/Breadcrumb'

const ETIQUETAS_CONFIG = [
  { value: 'Nuevo Ingreso a EI',   color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'Seguimiento especial', color: 'bg-red-100 text-red-700 border-red-200' },
  { value: 'Ruta de Desarrollo',   color: 'bg-teal-100 text-teal-700 border-teal-200' },
]

interface Docente {
  id: number
  id_centro: string
  nombre: string
  correo_centro: string
  correo_enviado: boolean
  forma_pago: string
  tabulador: string
  num_materias: number
  porcentaje: number
  campos_pendientes: string[]
  etiqueta: string | null
  sesion_status: 'al_dia' | 'con_atrasos' | 'sin_registros'
  materias_al_dia: number
}

const FILTROS_CAMPO = [
  { key: 'asistencia',            label: 'Asistencia' },
  { key: 'temarios_oficina',      label: 'Acuse de Programa' },
  { key: 'temarios_bs',           label: 'Temarios BS' },
  { key: 'materiales_bibliografia', label: 'Método de Evaluación' },
  { key: 'evaluacion_intermedia', label: 'Apartado de Cal.' },
  { key: 'publicacion_calificaciones', label: 'Publicación de Cal.' },
]

const formatId = (id: string) => `0000${id}`

export default function DocentesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [docentes, setDocentes] = useState<Docente[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'todos' | 'activos' | 'inactivos'>('activos')
  const [orden, setOrden] = useState<'nombre' | 'avance_asc' | 'avance_desc'>('nombre')
  const [filtroCampo, setFiltroCampo] = useState<string>('')
  const [filtroCorreo, setFiltroCorreo] = useState<boolean | null>(null)
  const [filtroCumplimiento, setFiltroCumplimiento] = useState<'completo' | 'pendiente' | null>(null)
  const [filtroEtiqueta, setFiltroEtiqueta] = useState<string | null>(null)
  const [filtroSesion, setFiltroSesion] = useState<'al_dia' | 'con_atrasos' | 'sin_registros' | null>(null)
  const [mostrarFiltros, setMostrarFiltros] = useState(false)
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({})
  const toggleExpandido = (key: string) => setExpandidos(p => ({ ...p, [key]: !p[key] }))
  const listo = useRef(false)

  const fetchDocentes = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (q) params.set('busqueda', q)
      const res = await fetch(`/api/docentes?${params}`)
      const json = await res.json()
      setDocentes(json.data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated') {
      listo.current = true
      fetchDocentes('')
    }
  }, [status])

  useEffect(() => {
    if (!listo.current) return
    const timer = setTimeout(() => fetchDocentes(busqueda), 300)
    return () => clearTimeout(timer)
  }, [busqueda])

  const docentesFiltrados = (() => {
    let lista = [...docentes]
    if (filtro === 'activos') lista = lista.filter(d => d.num_materias > 0)
    if (filtro === 'inactivos') lista = lista.filter(d => d.num_materias === 0)
    if (filtroCampo) lista = lista.filter(d => d.campos_pendientes?.includes(filtroCampo))
    if (filtroCorreo !== null) lista = lista.filter(d => d.correo_enviado === filtroCorreo)
    if (filtroCumplimiento === 'completo') lista = lista.filter(d => d.sin_pendientes && d.num_materias > 0)
    if (filtroCumplimiento === 'pendiente') lista = lista.filter(d => !d.sin_pendientes && d.num_materias > 0)
    if (filtroEtiqueta) lista = lista.filter(d => d.etiqueta === filtroEtiqueta)
    if (filtroSesion) lista = lista.filter(d => d.sesion_status === filtroSesion)
    if (orden === 'avance_asc') lista.sort((a, b) => a.porcentaje - b.porcentaje)
    if (orden === 'avance_desc') lista.sort((a, b) => b.porcentaje - a.porcentaje)
    return lista
  })()

  if (status === 'loading') return (
    <div className="min-h-screen flex items-center justify-center">Cargando...</div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <Breadcrumb items={[{ label: 'Seguimiento Docente' }]} />
      <main className="max-w-7xl mx-auto px-4 py-6">

        {/* Promedio + Buscador en dos columnas */}
        {(() => {
          const activos = docentes.filter(d => d.num_materias > 0)
          const promedio = activos.length > 0
            ? Math.round(activos.reduce((acc, d) => acc + d.porcentaje, 0) / activos.length)
            : 0
          const colorBar = promedio === 100 ? 'bg-green-500' : promedio >= 50 ? 'bg-blue-500' : 'bg-orange-400'
          const colorText = promedio === 100 ? 'text-green-600' : promedio >= 50 ? 'text-blue-600' : 'text-orange-500'
          return (
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-white rounded-xl shadow-sm p-4 flex items-center">
                <div className="flex-1">
                  <p className="text-xs text-gray-400 mb-1.5">Promedio de cumplimiento — {activos.length} docentes con grupos</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-gray-100 rounded-full h-3">
                      <div className={`h-3 rounded-full transition-all ${colorBar}`} style={{ width: `${promedio}%` }} />
                    </div>
                    <span className={`text-xl font-bold ${colorText} w-14 text-right`}>{promedio}%</span>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 flex items-center">
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar docente por nombre..."
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  autoFocus
                />
              </div>
            </div>
          )
        })()}

        {/* Panel de filtros */}
        {(() => {
          return (
            <div className="mb-4">
              {/* Fila de categorías */}
              <div className="flex flex-wrap gap-2 mb-2">
                {[
                  { key: 'pendiente',    label: 'Pendiente en',   activo: !!filtroCampo },
                  { key: 'correo',      label: 'Correo',         activo: filtroCorreo !== null },
                  { key: 'seguimientobs', label: 'Seguimiento BS', activo: !!filtroCumplimiento },
                  { key: 'etiqueta',    label: 'Etiqueta',       activo: !!filtroEtiqueta },
                  { key: 'asistencias', label: 'Asistencias',    activo: !!filtroSesion },
                ].map(cat => (
                  <button
                    key={cat.key}
                    onClick={() => toggleExpandido(cat.key)}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium transition ${
                      expandidos[cat.key]
                        ? 'bg-gray-700 text-white border-gray-700'
                        : cat.activo
                        ? 'bg-orange-50 text-orange-600 border-orange-300'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {cat.label}
                    {cat.activo && !expandidos[cat.key] && (
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-500 inline-block" />
                    )}
                    <span className="text-gray-400 text-[10px]">{expandidos[cat.key] ? '▲' : '▼'}</span>
                  </button>
                ))}
              </div>

              {(expandidos['pendiente'] || expandidos['correo'] || expandidos['seguimientobs'] || expandidos['etiqueta'] || expandidos['asistencias']) && (
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm px-4 py-3 flex flex-wrap gap-1.5 items-center">
                  {expandidos['pendiente'] && <>
                    {FILTROS_CAMPO.map(fc => (
                      <button key={fc.key} onClick={() => setFiltroCampo(filtroCampo === fc.key ? '' : fc.key)}
                        className={`text-xs px-3 py-1.5 rounded-full border font-medium transition ${filtroCampo === fc.key ? 'bg-red-500 text-white border-red-500' : 'bg-white text-gray-500 border-gray-300 hover:border-red-300 hover:text-red-500'}`}>
                        {fc.label}
                      </button>
                    ))}
                    {filtroCampo && <button onClick={() => setFiltroCampo('')} className="text-xs text-gray-400 hover:text-gray-600">✕</button>}
                  </>}
                  {expandidos['correo'] && <>
                    {(expandidos['pendiente']) && <div className="w-px h-4 bg-gray-200 mx-1" />}
                    <button onClick={() => setFiltroCorreo(filtroCorreo === true ? null : true)} className={`text-xs px-3 py-1.5 rounded-full border font-medium transition ${filtroCorreo === true ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-500 border-gray-300 hover:border-blue-300 hover:text-blue-500'}`}>✉ Enviado</button>
                    <button onClick={() => setFiltroCorreo(filtroCorreo === false ? null : false)} className={`text-xs px-3 py-1.5 rounded-full border font-medium transition ${filtroCorreo === false ? 'bg-orange-400 text-white border-orange-400' : 'bg-white text-gray-500 border-gray-300 hover:border-orange-300 hover:text-orange-500'}`}>Sin correo</button>
                    {filtroCorreo !== null && <button onClick={() => setFiltroCorreo(null)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>}
                  </>}
                  {expandidos['seguimientobs'] && <>
                    {(expandidos['pendiente'] || expandidos['correo']) && <div className="w-px h-4 bg-gray-200 mx-1" />}
                    <button onClick={() => setFiltroCumplimiento(filtroCumplimiento === 'completo' ? null : 'completo')} className={`text-xs px-3 py-1.5 rounded-full border font-medium transition ${filtroCumplimiento === 'completo' ? 'bg-green-500 text-white border-green-500' : 'bg-white text-gray-500 border-gray-300 hover:border-green-400 hover:text-green-600'}`}>✓ Completo</button>
                    <button onClick={() => setFiltroCumplimiento(filtroCumplimiento === 'pendiente' ? null : 'pendiente')} className={`text-xs px-3 py-1.5 rounded-full border font-medium transition ${filtroCumplimiento === 'pendiente' ? 'bg-yellow-400 text-white border-yellow-400' : 'bg-white text-gray-500 border-gray-300 hover:border-yellow-400 hover:text-yellow-600'}`}>⏳ Con pendientes</button>
                    {filtroCumplimiento && <button onClick={() => setFiltroCumplimiento(null)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>}
                  </>}
                  {expandidos['etiqueta'] && <>
                    {(expandidos['pendiente'] || expandidos['correo'] || expandidos['seguimientobs']) && <div className="w-px h-4 bg-gray-200 mx-1" />}
                    {ETIQUETAS_CONFIG.map(e => (
                      <button key={e.value} onClick={() => setFiltroEtiqueta(filtroEtiqueta === e.value ? null : e.value)} className={`text-xs px-3 py-1.5 rounded-full border font-medium transition ${filtroEtiqueta === e.value ? e.color : 'bg-white text-gray-500 border-gray-300 hover:border-gray-400 hover:text-gray-600'}`}>{e.value}</button>
                    ))}
                    {filtroEtiqueta && <button onClick={() => setFiltroEtiqueta(null)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>}
                  </>}
                  {expandidos['asistencias'] && <>
                    {(expandidos['pendiente'] || expandidos['correo'] || expandidos['seguimientobs'] || expandidos['etiqueta']) && <div className="w-px h-4 bg-gray-200 mx-1" />}
                    <button onClick={() => setFiltroSesion(filtroSesion === 'al_dia' ? null : 'al_dia')} className={`text-xs px-3 py-1.5 rounded-full border font-medium transition ${filtroSesion === 'al_dia' ? 'bg-green-500 text-white border-green-500' : 'bg-white text-gray-500 border-gray-300 hover:border-green-400 hover:text-green-600'}`}>✓ Al día</button>
                    <button onClick={() => setFiltroSesion(filtroSesion === 'con_atrasos' ? null : 'con_atrasos')} className={`text-xs px-3 py-1.5 rounded-full border font-medium transition ${filtroSesion === 'con_atrasos' ? 'bg-yellow-400 text-white border-yellow-400' : 'bg-white text-gray-500 border-gray-300 hover:border-yellow-400 hover:text-yellow-600'}`}>⚠ Con atrasos</button>
                    <button onClick={() => setFiltroSesion(filtroSesion === 'sin_registros' ? null : 'sin_registros')} className={`text-xs px-3 py-1.5 rounded-full border font-medium transition ${filtroSesion === 'sin_registros' ? 'bg-gray-500 text-white border-gray-500' : 'bg-white text-gray-500 border-gray-300 hover:border-gray-400 hover:text-gray-600'}`}>— Sin registros</button>
                    {filtroSesion && <button onClick={() => setFiltroSesion(null)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>}
                  </>}
                </div>
              )}
            </div>
          )
        })()}

        <div className="mb-4 flex flex-wrap gap-3 items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-gray-700 mr-1">Lista de docentes</h2>
            {(['todos', 'activos', 'inactivos'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFiltro(f)}
                className={`text-xs px-3 py-1.5 rounded-full border font-medium transition ${
                  filtro === f
                    ? 'bg-gray-800 text-white border-gray-800'
                    : 'bg-white text-gray-500 border-gray-300 hover:border-gray-400'
                }`}
              >
                {f === 'todos' ? 'Todos' : f === 'activos' ? 'Con grupos' : 'Sin grupos'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Ordenar:</span>
            {([
              { key: 'nombre', label: 'A–Z' },
              { key: 'avance_desc', label: '% mayor' },
              { key: 'avance_asc', label: '% menor' },
            ] as const).map(op => (
              <button
                key={op.key}
                onClick={() => setOrden(op.key)}
                className={`text-xs px-3 py-1.5 rounded-full border font-medium transition ${
                  orden === op.key
                    ? 'bg-orange-500 text-white border-orange-500'
                    : 'bg-white text-gray-500 border-gray-300 hover:border-gray-400'
                }`}
              >
                {op.label}
              </button>
            ))}
            <span className="text-xs text-gray-400 ml-1">{docentesFiltrados.length} docentes</span>
            <button
              onClick={() => router.push('/docentes/informe')}
              className="ml-2 text-xs px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-600 hover:border-orange-400 hover:text-orange-600 font-medium transition"
            >
              Ver informe general →
            </button>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-400">Cargando...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {docentesFiltrados.map(d => {
              const completo = d.sin_pendientes && d.num_materias > 0
              const conPendientes = !d.sin_pendientes && d.num_materias > 0
              const colorAvance = completo ? 'bg-green-500' : d.porcentaje >= 50 ? 'bg-blue-500' : d.porcentaje > 0 ? 'bg-orange-400' : 'bg-gray-200'
              const textAvance = completo ? 'text-green-600' : d.porcentaje >= 50 ? 'text-blue-600' : d.porcentaje > 0 ? 'text-orange-500' : 'text-gray-400'
              const colorCard = completo
                ? 'border-green-300 bg-green-50'
                : conPendientes
                  ? 'border-yellow-300 bg-yellow-50'
                  : 'border-gray-100 bg-white'

              return (
                <div
                  key={d.id}
                  onClick={() => window.open(`/docentes/${d.id}`, '_blank')}
                  className={`rounded-xl shadow-sm p-4 cursor-pointer hover:shadow-md transition border ${colorCard}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 text-sm leading-tight truncate">{d.nombre}</p>
                      <p className="text-xs text-gray-400 font-mono mt-0.5">{formatId(d.id_centro)}</p>
                    </div>
                    {d.forma_pago && (
                      <span className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full border border-orange-200 ml-2 whitespace-nowrap flex-shrink-0">
                        {d.forma_pago}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${colorAvance}`}
                        style={{ width: `${d.porcentaje}%` }}
                      />
                    </div>
                    <span className={`text-sm font-bold ${textAvance} w-10 text-right`}>{d.porcentaje}%</span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>{d.num_materias} {d.num_materias === 1 ? 'grupo' : 'grupos'}</span>
                    {completo && <span className="text-green-600 font-medium">Completo</span>}
                  </div>
                  {d.num_materias > 0 && (() => {
                    const color = d.sesion_status === 'al_dia' ? 'text-green-600' : d.sesion_status === 'con_atrasos' ? 'text-yellow-500' : 'text-red-400'
                    const label = d.sesion_status === 'sin_registros'
                      ? 'Sin registros en Core'
                      : `${d.materias_al_dia}/${d.num_materias} materias al día`
                    return <p className={`text-xs font-medium mt-1 ${color}`}>{label}</p>
                  })()}
                  {d.etiqueta && (() => {
                    const cfg = ETIQUETAS_CONFIG.find(e => e.value === d.etiqueta)
                    return cfg ? (
                      <div className={`mt-2 inline-block text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.color}`}>
                        {d.etiqueta}
                      </div>
                    ) : null
                  })()}
                </div>
              )
            })}
            {docentesFiltrados.length === 0 && (
              <div className="col-span-4 bg-white rounded-xl shadow-sm p-8 text-center text-gray-400">
                {busqueda ? `No se encontraron docentes con "${busqueda}"` : 'No hay docentes registrados'}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}