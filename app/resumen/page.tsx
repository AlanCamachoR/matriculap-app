'use client'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface Clave {
  id: number
  clave: string
  semestre: string
  materia: string
  docente: string
  licenciatura: string
  grupo: number
  estudiantes: { id: number }[]
  firma: { imagen_url: string; fecha: string } | null
}

interface ResumenLic {
  licenciatura: string
  total: number
  firmados: number
  pendientes: number
  porcentaje: number
  grupos: Clave[]
  expandido: boolean
}

const LICENCIATURAS = [
  'Arquitectura',
  'Arquitectura de Interiores',
  'Cine y Televisión',
  'Comunicación Visual',
  'Diseño Industrial',
  'Diseño Textil y Moda',
  'Mercadotecnia y Publicidad',
  'Negocios e Industrias Creativas',
]

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
      const res = await fetch('/api/estudiantes')
      const json = await res.json()
      const claves: Clave[] = json.data || []

      const resumenData: ResumenLic[] = LICENCIATURAS.map(lic => {
        const grupos = claves.filter(c => c.licenciatura === lic)
        const firmados = grupos.filter(c => c.firma).length
        const total = grupos.length
        return {
          licenciatura: lic,
          total,
          firmados,
          pendientes: total - firmados,
          porcentaje: total > 0 ? Math.round((firmados / total) * 100) : 0,
          grupos,
          expandido: false,
        }
      }).filter(r => r.total > 0)

      setResumen(resumenData)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const toggleExpand = (lic: string) => {
    setResumen(prev => prev.map(r =>
      r.licenciatura === lic ? { ...r, expandido: !r.expandido } : r
    ))
  }

  if (status === 'loading') return <div className="min-h-screen flex items-center justify-center">Cargando...</div>

  const user = session?.user as any
  const totalGrupos = resumen.reduce((a, r) => a + r.total, 0)
  const totalFirmados = resumen.reduce((a, r) => a + r.firmados, 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <a href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">← Dashboard</a>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Resumen por Licenciatura</h1>
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

        {/* Resumen global */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <p className="text-3xl font-bold text-gray-800">{totalGrupos}</p>
            <p className="text-sm text-gray-500 mt-1">Total grupos</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <p className="text-3xl font-bold text-green-600">{totalFirmados}</p>
            <p className="text-sm text-gray-500 mt-1">Acuses subidos</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <p className="text-3xl font-bold text-orange-500">{totalGrupos - totalFirmados}</p>
            <p className="text-sm text-gray-500 mt-1">Pendientes</p>
          </div>
        </div>

        {/* Lista por licenciatura */}
        {loading ? (
          <div className="p-8 text-center text-gray-400">Cargando...</div>
        ) : (
          <div className="space-y-3">
            {resumen.map((r) => (
              <div key={r.licenciatura} className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div
                  className="px-6 py-4 cursor-pointer hover:bg-gray-50 transition"
                  onClick={() => toggleExpand(r.licenciatura)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-gray-800">{r.licenciatura}</span>
                      {r.porcentaje === 100 && <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-medium">✅ Completo</span>}
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-500">{r.firmados}/{r.total} grupos</span>
                      <span className={`text-sm font-bold ${r.porcentaje === 100 ? 'text-green-600' : r.porcentaje >= 50 ? 'text-blue-600' : 'text-orange-500'}`}>
                        {r.porcentaje}%
                      </span>
                      <span className="text-gray-400 text-sm">{r.expandido ? '▲' : '▼'}</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${r.porcentaje === 100 ? 'bg-green-500' : r.porcentaje >= 50 ? 'bg-blue-500' : 'bg-orange-400'}`}
                      style={{ width: `${r.porcentaje}%` }}
                    />
                  </div>
                </div>

                {r.expandido && (
                  <div className="border-t border-gray-100">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                        <tr>
                          <th className="px-6 py-2 text-left">Clave</th>
                          <th className="px-6 py-2 text-left">Materia</th>
                          <th className="px-6 py-2 text-left">Semestre</th>
                          <th className="px-6 py-2 text-left">Docente</th>
                          <th className="px-6 py-2 text-left">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {r.grupos.map(g => (
                          <tr key={g.id} className="hover:bg-gray-50">
                            <td className="px-6 py-2.5 font-mono text-blue-600 text-xs">{g.clave}</td>
                            <td className="px-6 py-2.5 text-gray-700">{g.materia}</td>
                            <td className="px-6 py-2.5 text-gray-500">{g.semestre}</td>
                            <td className="px-6 py-2.5 text-gray-500">{g.docente}</td>
                            <td className="px-6 py-2.5">
                              {g.firma
                                ? <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">✅ Firmado</span>
                                : <span className="text-xs text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">⏳ Pendiente</span>
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}