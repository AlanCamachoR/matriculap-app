'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
const PROGRAMAS = [
  'Arquitectura', 'Arquitectura de Interiores', 'Cine y Televisión',
  'Comunicación Visual', 'Computación Creativa', 'Diseño Industrial',
  'Diseño Textil y Moda', 'Estudios Integrales', 'Mercadotecnia y Publicidad',
  'Negocios e Industrias Creativas',
]

const SEMESTRES = ['1°','2°','3°','4°','5°','6°']

interface Estudiante {
  id: number
  id_centro: string
  nombre: string
  programa: string
  carrera: string
  materias_count: number
  firmadas: number
  no_firmadas: number
  total_faltas: number | null
  min_pct_asistencia: number | null
}

export default function EstudiantesPage() {
  const router = useRouter()
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [programa, setPrograma] = useState('')
  const [semestre, setSemestre] = useState('')
  const [filtroCritico, setFiltroCritico] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const delay = busqueda ? 350 : 0
    const timer = setTimeout(async () => {
      setLoading(true)
      const params = new URLSearchParams()
      if (busqueda.trim().length >= 2) params.set('q', busqueda.trim())
      if (programa) params.set('programa', programa)
      if (semestre) params.set('semestre', semestre)
      const res = await fetch(`/api/estudiantes/lista?${params}`)
      const json = await res.json()
      setEstudiantes(json.data || [])
      setLoading(false)
    }, delay)
    return () => clearTimeout(timer)
  }, [busqueda, programa, semestre])

  const pendientes = (e: Estudiante) => Number(e.materias_count) - Number(e.firmadas) - Number(e.no_firmadas)

  // Casos críticos: porcentaje asistencia < 80% en al menos una materia
  const lista = filtroCritico
    ? estudiantes.filter(e => e.min_pct_asistencia != null && Number(e.min_pct_asistencia) < 80)
    : estudiantes
  // Ordenar críticos por min_pct_asistencia asc
  const listaOrdenada = filtroCritico
    ? [...lista].sort((a, b) => Number(a.min_pct_asistencia ?? 100) - Number(b.min_pct_asistencia ?? 100))
    : lista

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Estudiantes</h1>
          <span className="text-sm text-gray-400">{listaOrdenada.length} resultados</span>
        </div>

        {/* Filtros */}
        <div className="flex gap-3 mb-3 flex-wrap">
          <input
            type="text"
            placeholder="Buscar por nombre o matrícula..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="flex-1 min-w-60 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={programa}
            onChange={e => setPrograma(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Todos los programas</option>
            {PROGRAMAS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select
            value={semestre}
            onChange={e => setSemestre(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Todos los semestres</option>
            {SEMESTRES.map(s => <option key={s} value={s}>{s} semestre</option>)}
          </select>
          {(busqueda || programa || semestre) && (
            <button
              onClick={() => { setBusqueda(''); setPrograma(''); setSemestre('') }}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50"
            >
              Limpiar
            </button>
          )}
        </div>

        {/* Filtro casos críticos */}
        <div className="mb-5 flex gap-2 items-center">
          <button
            onClick={() => setFiltroCritico(p => !p)}
            className={`text-xs px-3 py-1.5 rounded-full border font-medium transition ${filtroCritico ? 'bg-red-500 text-white border-red-500' : 'bg-white text-gray-500 border-gray-300 hover:border-red-400 hover:text-red-500'}`}
          >
            ⚠ Casos críticos (&lt;80% asistencia)
          </button>
          {filtroCritico && (
            <span className="text-xs text-gray-400">{listaOrdenada.length} estudiantes</span>
          )}
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-400 text-sm">Cargando...</div>
          ) : estudiantes.length === 0 ? (
            <div className="p-12 text-center text-gray-400 text-sm">No se encontraron estudiantes</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left font-medium">Estudiante</th>
                  <th className="px-4 py-3 text-left font-medium">Programa</th>
                  <th className="px-4 py-3 text-center font-medium">Materias</th>
                  <th className="px-4 py-3 text-center font-medium">Firmadas</th>
                  <th className="px-4 py-3 text-center font-medium">Pendientes</th>
                  <th className="px-4 py-3 text-center font-medium">Asistencia mín.</th>
                  <th className="px-4 py-3 text-center font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {listaOrdenada.map(e => {
                  const total = Number(e.materias_count)
                  const firmadas = Number(e.firmadas)
                  const pend = pendientes(e)
                  const pct = total > 0 ? Math.round((firmadas / total) * 100) : 0
                  const minPct = e.min_pct_asistencia != null ? Math.round(Number(e.min_pct_asistencia)) : null
                  const asistColor = minPct == null ? 'text-gray-300' : minPct < 70 ? 'text-red-600 font-bold' : minPct < 80 ? 'text-orange-500 font-medium' : 'text-green-600'
                  return (
                    <tr
                      key={e.id}
                      onClick={() => router.push(`/estudiantes/${e.id}`)}
                      className="hover:bg-blue-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{e.nombre}</div>
                        <div className="text-xs text-gray-400">{e.id_centro}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{e.programa}</td>
                      <td className="px-4 py-3 text-center text-gray-700">{total}</td>
                      <td className="px-4 py-3 text-center text-green-600 font-medium">{firmadas}</td>
                      <td className="px-4 py-3 text-center">
                        {pend > 0
                          ? <span className="text-orange-500 font-medium">{pend}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className={`px-4 py-3 text-center ${asistColor}`}>
                        {minPct != null ? `${minPct}%` : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 bg-gray-100 rounded-full h-1.5">
                            <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className={`text-xs font-medium ${pct === 100 ? 'text-green-600' : 'text-gray-500'}`}>{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  )
}
