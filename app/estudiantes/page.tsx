'use client'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface Grupo {
  clave: string
  materia: string
  docente: string
  semestre: string
  licenciatura: string
  firmado: boolean
}

interface Estudiante {
  id: number
  id_centro: string
  nombre: string
  programa: string
  curriculo: string
  grupos: Grupo[]
}

export default function EstudiantesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [busqueda, setBusqueda] = useState('')
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([])
  const [loading, setLoading] = useState(false)
  const [seleccionado, setSeleccionado] = useState<Estudiante | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  const buscar = async () => {
    if (!busqueda.trim()) return
    setLoading(true)
    setSeleccionado(null)
    try {
      const res = await fetch(`/api/estudiantes-detalle?busqueda=${encodeURIComponent(busqueda)}`)
      const json = await res.json()
      setEstudiantes(json.data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading') return <div className="min-h-screen flex items-center justify-center">Cargando...</div>

  const user = session?.user as any

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <a href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">← Dashboard</a>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Estudiantes</h1>
              <p className="text-sm text-gray-500">Búsqueda de estudiantes y sus grupos</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.name}</span>
            <button onClick={() => signOut({ callbackUrl: '/login' })} className="text-sm text-red-500 hover:text-red-700">Cerrar sesión</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">

        {/* Buscador */}
        <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
          <h2 className="font-semibold text-gray-700 mb-3">Buscar estudiante</h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && buscar()}
              placeholder="Nombre o ID del estudiante..."
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={buscar}
              disabled={loading || !busqueda.trim()}
              className="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition font-medium"
            >
              {loading ? 'Buscando...' : 'Buscar'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Lista de resultados */}
          {estudiantes.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-600">{estudiantes.length} resultado{estudiantes.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="divide-y divide-gray-100">
                {estudiantes.map(e => (
                  <div
                    key={e.id}
                    onClick={() => setSeleccionado(e)}
                    className={`px-4 py-3 cursor-pointer hover:bg-gray-50 transition ${seleccionado?.id === e.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}
                  >
                    <p className="font-medium text-gray-800 text-sm">{e.nombre}</p>
                    <p className="text-xs text-gray-400 font-mono">{e.id_centro} · {e.programa}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Detalle del estudiante */}
          {seleccionado && (
            <div className="md:col-span-2 space-y-4">

              {/* Info general */}
              <div className="bg-white rounded-xl shadow-sm p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">{seleccionado.nombre}</h2>
                    <p className="text-sm text-gray-500 mt-1 font-mono">{seleccionado.id_centro}</p>
                    <div className="flex gap-2 mt-2">
                      <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full">{seleccionado.programa}</span>
                      {seleccionado.curriculo && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{seleccionado.curriculo}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-blue-600">{seleccionado.grupos.length}</p>
                    <p className="text-xs text-gray-400">grupos inscritos</p>
                  </div>
                </div>

                {/* Estadística de firmas */}
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <p className="text-xl font-bold text-green-600">{seleccionado.grupos.filter(g => g.firmado).length}</p>
                    <p className="text-xs text-gray-500">grupos firmados</p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-3 text-center">
                    <p className="text-xl font-bold text-orange-500">{seleccionado.grupos.filter(g => !g.firmado).length}</p>
                    <p className="text-xs text-gray-500">grupos pendientes</p>
                  </div>
                </div>
              </div>

              {/* Lista de grupos */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-700">Grupos inscritos</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {seleccionado.grupos.map((g, i) => (
                    <div key={i} className={`px-5 py-3 ${g.firmado ? 'bg-green-50' : ''}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-blue-600 text-sm font-medium">{g.clave}</span>
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{g.semestre}</span>
                          </div>
                          <p className="text-sm font-medium text-gray-800">{g.materia}</p>
                          <p className="text-xs text-gray-500 mt-0.5">👨‍🏫 {g.docente}</p>
                        </div>
                        <div>
                          {g.firmado
                            ? <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full font-medium">✅ Firmó</span>
                            : <span className="text-xs text-orange-500 bg-orange-50 px-2 py-1 rounded-full">⏳ Pendiente</span>
                          }
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Estado vacío */}
          {estudiantes.length === 0 && !loading && busqueda && (
            <div className="md:col-span-3 bg-white rounded-xl shadow-sm p-8 text-center text-gray-400">
              No se encontraron estudiantes con "{busqueda}"
            </div>
          )}
        </div>
      </main>
    </div>
  )
}