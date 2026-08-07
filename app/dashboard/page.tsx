'use client'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface Matricula {
  id: number
  estatus: string
  estudiantes: {
    id: number
    id_centro: string
    nombre: string
    programa: string
  }
  claves: {
    id: number
    clave: string
    semestre: string
    materia: string
    docente: string
    licenciatura: string
    grupo: number
  }
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [matriculas, setMatriculas] = useState<Matricula[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    const timer = setTimeout(() => fetchEstudiantes(), 300)
    return () => clearTimeout(timer)
  }, [busqueda])

  useEffect(() => {
    fetchEstudiantes()
  }, [])

  const fetchEstudiantes = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (busqueda) params.set('busqueda', busqueda)
      const res = await fetch(`/api/estudiantes?${params}`)
      const json = await res.json()
      setMatriculas(json.data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading') {
    return <div className="min-h-screen flex items-center justify-center">Cargando...</div>
  }

  const user = session?.user as any

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Integrales — Matrícula y Firmas</h1>
            <p className="text-sm text-gray-500">{user?.licenciatura || 'Todas las licenciaturas'}</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.name}</span>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="text-sm text-red-500 hover:text-red-700"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o ID de estudiante..."
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
            <h2 className="font-semibold text-gray-700">Estudiantes matriculados</h2>
            <span className="text-sm text-gray-500">{matriculas.length} registros</span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-400">Cargando...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                  <tr>
                    <th className="px-6 py-3 text-left">ID</th>
                    <th className="px-6 py-3 text-left">Nombre</th>
                    <th className="px-6 py-3 text-left">Programa</th>
                    <th className="px-6 py-3 text-left">Clave</th>
                    <th className="px-6 py-3 text-left">Materia</th>
                    <th className="px-6 py-3 text-left">Semestre</th>
                    <th className="px-6 py-3 text-left">Docente</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {matriculas.map((m) => (
                    <tr key={m.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-3 font-mono text-gray-600">{m.estudiantes?.id_centro}</td>
                      <td className="px-6 py-3 font-medium text-gray-800">{m.estudiantes?.nombre}</td>
                      <td className="px-6 py-3 text-gray-600">{m.estudiantes?.programa}</td>
                      <td className="px-6 py-3 font-mono text-blue-600">{m.claves?.clave}</td>
                      <td className="px-6 py-3 text-gray-600">{m.claves?.materia}</td>
                      <td className="px-6 py-3 text-gray-600">{m.claves?.semestre}</td>
                      <td className="px-6 py-3 text-gray-600">{m.claves?.docente}</td>
                    </tr>
                  ))}
                  {matriculas.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-gray-400">
                        No se encontraron resultados
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}