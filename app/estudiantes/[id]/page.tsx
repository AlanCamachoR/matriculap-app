'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Breadcrumb from '@/app/components/Breadcrumb'

interface Grupo {
  clave_id: number
  clave: string
  materia: string
  docente: string
  semestre: string
  licenciatura: string
  bloque: string
  salon: string
  brightspace: string | null
  firmado: boolean | null
  fecha_firma: string | null
  estado: 'firmado' | 'no_firmado' | 'pendiente'
}

interface Perfil {
  id: number
  id_centro: string
  nombre: string
  programa: string
  carrera: string
  grupos: Grupo[]
  resumen: { total: number; firmadas: number; no_firmadas: number; pendientes: number }
}

interface AsistenciaCore {
  clave_asignatura: string
  nombre_asignatura: string
  nombre_docente: string
  sesiones_por_clase: number | null
  asistencias: number | null
  faltas: number | null
  porcentaje_asistencia: number | null
  calificacion_final: number | null
  fecha_corte: string | null
}

export default function EstudiantePerfilPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'todos' | 'firmado' | 'pendiente'>('todos')
  const [asistenciasCore, setAsistenciasCore] = useState<AsistenciaCore[]>([])
  const [mostrarAsistencias, setMostrarAsistencias] = useState(false)

  useEffect(() => {
    if (id) cargar()
  }, [id])

  useEffect(() => {
    if (perfil) document.title = `${perfil.nombre} | Integra`
    return () => { document.title = 'Integra' }
  }, [perfil])

  useEffect(() => {
    if (perfil?.id_centro) cargarAsistencias(perfil.id_centro)
  }, [perfil?.id_centro])

  async function cargar() {
    setLoading(true)
    const res = await fetch(`/api/estudiantes/perfil?id=${id}`)
    const json = await res.json()
    setPerfil(json.data)
    setLoading(false)
  }

  async function cargarAsistencias(idCentro: string) {
    const r = await fetch(`/api/asistencias-core?estudiante_id=${idCentro}&ciclo=2027-1`)
    const json = await r.json()
    setAsistenciasCore(json.data || [])
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Cargando...</div>
  )

  if (!perfil) return (
    <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Estudiante no encontrado</div>
  )

  const { resumen } = perfil
  const pct = resumen.total > 0 ? Math.round((resumen.firmadas / resumen.total) * 100) : 0

  const gruposFiltrados = filtro === 'todos' ? perfil.grupos
    : filtro === 'firmado' ? perfil.grupos.filter(g => g.estado === 'firmado')
    : perfil.grupos.filter(g => g.estado !== 'firmado')

  const estadoBadge = (g: Grupo) => {
    if (g.estado === 'firmado') return <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">✓ Firmó</span>
    if (g.estado === 'no_firmado') return <span className="text-xs font-medium text-red-500 bg-red-50 px-2 py-0.5 rounded-full">✗ No firmó</span>
    return <span className="text-xs font-medium text-orange-400 bg-orange-50 px-2 py-0.5 rounded-full">Pendiente</span>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-5xl mx-auto px-4 py-6">
        <Breadcrumb items={[
          { label: 'Estudiantes', href: '/estudiantes' },
          { label: perfil.nombre }
        ]} />

        {/* Header del estudiante */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-5">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{perfil.nombre}</h1>
              <p className="text-gray-400 text-sm mt-0.5">{perfil.id_centro}</p>
              <p className="text-blue-600 text-sm font-medium mt-1">{perfil.programa}</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-gray-900">{pct}%</div>
              <div className="text-xs text-gray-400">acuses firmados</div>
            </div>
          </div>

          {/* Barra de progreso */}
          <div className="mt-4">
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <div className="flex gap-6 mt-3 text-sm">
              <span className="text-green-600 font-medium">{resumen.firmadas} firmadas</span>
              {resumen.no_firmadas > 0 && <span className="text-red-500">{resumen.no_firmadas} no firmó</span>}
              {resumen.pendientes > 0 && <span className="text-orange-400">{resumen.pendientes} pendientes</span>}
              <span className="text-gray-400 ml-auto">{resumen.total} materias totales</span>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex gap-2 mb-4">
          {(['todos', 'firmado', 'pendiente'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filtro === f ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'}`}
            >
              {f === 'todos' ? 'Todas' : f === 'firmado' ? 'Firmadas' : 'Pendientes'}
            </button>
          ))}
        </div>

        {/* Lista de materias */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3 text-left font-medium">Clave</th>
                <th className="px-4 py-3 text-left font-medium">Materia</th>
                <th className="px-4 py-3 text-left font-medium">Docente</th>
                <th className="px-4 py-3 text-left font-medium">Salón</th>
                <th className="px-4 py-3 text-center font-medium">Acuse</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {gruposFiltrados.map(g => (
                <tr key={`${g.clave_id}-${g.materia}`} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <a href={`/grupo/${g.clave_id}`} className="text-blue-600 hover:underline font-mono text-xs">{g.clave}</a>
                    {g.semestre && <div className="text-xs text-gray-400">{g.semestre}</div>}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800">{g.materia}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{g.docente}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{g.salon || '—'}</td>
                  <td className="px-4 py-3 text-center">{estadoBadge(g)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {gruposFiltrados.length === 0 && (
            <div className="p-8 text-center text-gray-400 text-sm">No hay materias con este filtro</div>
          )}
        </div>

        {/* Asistencias Core */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mt-5">
          <button
            onClick={() => setMostrarAsistencias(p => !p)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition"
          >
            <div className="flex items-center gap-3">
              <span className="text-base font-semibold text-gray-700">Asistencias y calificaciones — Core</span>
              {asistenciasCore.length > 0 && (
                <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full">{asistenciasCore.length} materias</span>
              )}
            </div>
            <span className="text-gray-400 text-lg">{mostrarAsistencias ? '▲' : '▼'}</span>
          </button>

          {mostrarAsistencias && (
            <div className="border-t border-gray-100">
              {asistenciasCore.length === 0 ? (
                <p className="px-6 py-4 text-sm text-gray-400">Sin datos cargados. Sube el archivo en Admin → Asistencias Core.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                      <tr>
                        <th className="px-4 py-3 text-left">Materia</th>
                        <th className="px-4 py-3 text-left">Docente</th>
                        <th className="px-4 py-3 text-center">Asistencias</th>
                        <th className="px-4 py-3 text-center">Faltas</th>
                        <th className="px-4 py-3 text-center">%</th>
                        <th className="px-4 py-3 text-center">Cal. final</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {asistenciasCore.map(a => {
                        // porcentaje_asistencia viene como 0-100 (no decimal)
                        const pctA = a.porcentaje_asistencia != null ? Math.round(Number(a.porcentaje_asistencia)) : null
                        const pctColor = pctA == null ? '' : pctA >= 80 ? 'text-green-600' : pctA >= 60 ? 'text-yellow-600' : 'text-red-500'
                        return (
                          <tr key={a.clave_asignatura} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-800">{a.nombre_asignatura}</div>
                              <div className="text-xs text-gray-400 font-mono">{a.clave_asignatura}</div>
                            </td>
                            <td className="px-4 py-3 text-gray-500 text-xs">{a.nombre_docente}</td>
                            <td className="px-4 py-3 text-center text-green-600 font-semibold">{a.asistencias ?? '—'}</td>
                            <td className="px-4 py-3 text-center text-red-500">{a.faltas ?? '—'}</td>
                            <td className={`px-4 py-3 text-center font-bold ${pctColor}`}>{pctA != null ? `${pctA}%` : '—'}</td>
                            <td className="px-4 py-3 text-center text-gray-700">{a.calificacion_final ?? '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {asistenciasCore[0]?.fecha_corte && (
                    <p className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100">Corte: {asistenciasCore[0].fecha_corte}</p>
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
