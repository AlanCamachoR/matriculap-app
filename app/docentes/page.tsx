'use client'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback, useRef } from 'react'

interface Docente {
  id: number
  id_centro: string
  nombre: string
  correo_centro: string
  forma_pago: string
  tabulador: string
  num_materias: number
  porcentaje: number
}

const formatId = (id: string) => `0000${id}`

export default function DocentesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [docentes, setDocentes] = useState<Docente[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)
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

  if (status === 'loading') return (
    <div className="min-h-screen flex items-center justify-center">Cargando...</div>
  )

  const user = session?.user as any

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/dashboard')} className="text-sm text-gray-500 hover:text-gray-700">
              Dashboard
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Docentes</h1>
              <p className="text-sm text-gray-500">Ciclo 2027-1</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.name}</span>
            <button onClick={() => signOut({ callbackUrl: '/login' })} className="text-sm text-red-500 hover:text-red-700">Cerrar sesion</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">

        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar docente por nombre..."
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500"
            autoFocus
          />
        </div>

        <div className="mb-4 flex justify-between items-center">
          <h2 className="font-semibold text-gray-700">Lista de docentes</h2>
          <span className="text-sm text-gray-500">{docentes.length} docentes</span>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-400">Cargando...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {docentes.map(d => {
              const colorAvance = d.porcentaje === 100 ? 'bg-green-500' : d.porcentaje >= 50 ? 'bg-blue-500' : d.porcentaje > 0 ? 'bg-orange-400' : 'bg-gray-200'
              const textAvance = d.porcentaje === 100 ? 'text-green-600' : d.porcentaje >= 50 ? 'text-blue-600' : d.porcentaje > 0 ? 'text-orange-500' : 'text-gray-400'
              const colorCard = d.porcentaje === 100 ? 'border-green-200' : d.porcentaje >= 50 ? 'border-blue-100' : 'border-gray-100'

              return (
                <div
                  key={d.id}
                  onClick={() => router.push(`/docentes/${d.id}`)}
                  className={`bg-white rounded-xl shadow-sm p-4 cursor-pointer hover:shadow-md transition border ${colorCard}`}
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
                    <span>{d.num_materias} materias</span>
                    {d.porcentaje === 100 && <span className="text-green-600 font-medium">Completo</span>}
                  </div>
                </div>
              )
            })}
            {docentes.length === 0 && (
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