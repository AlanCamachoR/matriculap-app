'use client'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface ResumenItem {
  nombre: string
  total: number
  firmados: number
  pendientes: number
  porcentaje: number
}

interface DashboardData {
  docentes: ResumenItem[]
  materias: ResumenItem[]
  totalGrupos: number
  totalFirmados: number
  totalPendientes: number
}

export default function ResumenPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'docentes' | 'materias'>('docentes')
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/estudiantes')
      const json = await res.json()
      const claves = json.data || []

      const docMap: Record<string, { total: number; firmados: number }> = {}
      const matMap: Record<string, { total: number; firmados: number }> = {}

      for (const c of claves) {
        const firmado = !!c.firma

        const docente = c.docente || 'Sin docente'
        if (!docMap[docente]) docMap[docente] = { total: 0, firmados: 0 }
        docMap[docente].total++
        if (firmado) docMap[docente].firmados++

        const materia = c.materia || 'Sin materia'
        if (!matMap[materia]) matMap[materia] = { total: 0, firmados: 0 }
        matMap[materia].total++
        if (firmado) matMap[materia].firmados++
      }

      const toArray = (map: Record<string, { total: number; firmados: number }>): ResumenItem[] =>
        Object.entries(map).map(([nombre, stats]) => ({
          nombre,
          total: stats.total,
          firmados: stats.firmados,
          pendientes: stats.total - stats.firmados,
          porcentaje: stats.total > 0 ? Math.round((stats.firmados / stats.total) * 100) : 0
        })).sort((a, b) => b.total - a.total)

      setData({
        docentes: toArray(docMap),
        materias: toArray(matMap),
        totalGrupos: claves.length,
        totalFirmados: claves.filter((c: any) => c.firma).length,
        totalPendientes: claves.filter((c: any) => !c.firma).length,
      })
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading') return <div className="min-h-screen flex items-center justify-center">Cargando...</div>

  const user = session?.user as any

  const items: ResumenItem[] = (data ? data[tab] : []).filter(r =>
    r.nombre.toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <a href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">← Dashboard</a>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Dashboard de Firmas</h1>
              <p className="text-sm text-gray-500">Ciclo 2027-1</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.name}</span>
            <button onClick={() => signOut({ callbackUrl: '/login' })} className="text-sm text-red-500 hover:text-red-700">Cerrar sesión</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <p className="text-3xl font-bold text-gray-800">{data?.totalGrupos || 0}</p>
            <p className="text-sm text-gray-500 mt-1">Total grupos</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <p className="text-3xl font-bold text-green-600">{data?.totalFirmados || 0}</p>
            <p className="text-sm text-gray-500 mt-1">Acuses subidos</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <p className="text-3xl font-bold text-orange-500">{data?.totalPendientes || 0}</p>
            <p className="text-sm text-gray-500 mt-1">Pendientes</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="flex border-b border-gray-100">
            <button
              onClick={() => { setTab('docentes'); setBusqueda('') }}
              className={`flex-1 py-3 text-sm font-medium transition ${tab === 'docentes' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              👨‍🏫 Por Docente
            </button>
            <button
              onClick={() => { setTab('materias'); setBusqueda('') }}
              className={`flex-1 py-3 text-sm font-medium transition ${tab === 'materias' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              📚 Por Materia
            </button>
          </div>

          {/* Buscador */}
          <div className="px-6 py-3 border-b border-gray-100">
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder={tab === 'docentes' ? 'Buscar docente...' : 'Buscar materia...'}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-400">Cargando...</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {items.map((r) => (
                <div key={r.nombre} className="px-6 py-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-gray-800">{r.nombre}</span>
                      {r.porcentaje === 100 && (
                        <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full">✅ Completo</span>
                      )}
                    </div>
                    <div className="flex items-center gap-6">
                      <span className="text-sm text-gray-500">
                        <span className="font-medium text-green-600">{r.firmados}</span>/{r.total} grupos
                      </span>
                      <span className={`text-sm font-bold w-12 text-right ${r.porcentaje === 100 ? 'text-green-600' : r.porcentaje >= 50 ? 'text-blue-600' : 'text-orange-500'}`}>
                        {r.porcentaje}%
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${r.porcentaje === 100 ? 'bg-green-500' : r.porcentaje >= 50 ? 'bg-blue-500' : 'bg-orange-400'}`}
                      style={{ width: `${r.porcentaje}%` }}
                    />
                  </div>
                </div>
              ))}
              {items.length === 0 && (
                <div className="p-8 text-center text-gray-400">
                  {busqueda ? `No se encontró "${busqueda}"` : 'No hay datos'}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}