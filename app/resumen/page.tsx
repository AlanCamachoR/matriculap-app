'use client'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface ResumenLic {
  programa: string
  total: number
  firmados: number
  pendientes: number
  porcentaje: number
}

export default function ResumenPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [resumen, setResumen] = useState<ResumenLic[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/resumen')
      const json = await res.json()
      setResumen(json.data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading') return <div className="min-h-screen flex items-center justify-center">Cargando...</div>

  const user = session?.user as any
  const totalEstudiantes = resumen.reduce((a, r) => a + r.total, 0)
  const totalFirmados = resumen.reduce((a, r) => a + r.firmados, 0)
  const totalPendientes = resumen.reduce((a, r) => a + r.pendientes, 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <a href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">← Dashboard</a>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Resumen por Licenciatura</h1>
              <p className="text-sm text-gray-500">Ciclo 2027-1 — por estudiante</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.name}</span>
            <button onClick={() => signOut({ callbackUrl: '/login' })} className="text-sm text-red-500 hover:text-red-700">Cerrar sesión</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">

        {/* Tarjetas resumen global */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <p className="text-3xl font-bold text-gray-800">{totalEstudiantes}</p>
            <p className="text-sm text-gray-500 mt-1">Total estudiantes</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <p className="text-3xl font-bold text-green-600">{totalFirmados}</p>
            <p className="text-sm text-gray-500 mt-1">Firmaron</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <p className="text-3xl font-bold text-orange-500">{totalPendientes}</p>
            <p className="text-sm text-gray-500 mt-1">Pendientes</p>
          </div>
        </div>

        {/* Lista por licenciatura */}
        {loading ? (
          <div className="p-8 text-center text-gray-400">Cargando...</div>
        ) : (
          <div className="space-y-3">
            {resumen.map((r) => (
              <div key={r.programa} className="bg-white rounded-xl shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-gray-800">{r.programa}</span>
                    {r.porcentaje === 100 && (
                      <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-medium">✅ Completo</span>
                    )}
                  </div>
                  <div className="flex items-center gap-6">
                    <span className="text-sm text-gray-500">
                      <span className="font-medium text-green-600">{r.firmados}</span> firmaron
                    </span>
                    <span className="text-sm text-gray-500">
                      <span className="font-medium text-orange-500">{r.pendientes}</span> pendientes
                    </span>
                    <span className="text-sm text-gray-400">
                      {r.total} total
                    </span>
                    <span className={`text-lg font-bold ${r.porcentaje === 100 ? 'text-green-600' : r.porcentaje >= 50 ? 'text-blue-600' : 'text-orange-500'}`}>
                      {r.porcentaje}%
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full transition-all ${r.porcentaje === 100 ? 'bg-green-500' : r.porcentaje >= 50 ? 'bg-blue-500' : 'bg-orange-400'}`}
                    style={{ width: `${r.porcentaje}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}