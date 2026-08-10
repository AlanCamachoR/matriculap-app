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
  estudiantes: { id: number; id_centro: string; nombre: string; programa: string }[]
  firma: { imagen_url: string; fecha: string } | null
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [claves, setClaves] = useState<Clave[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [semestre, setSemestre] = useState('')
  const [programa, setPrograma] = useState('')
  const [estado, setEstado] = useState('')
  const [loading, setLoading] = useState(false)
  const [semestres, setSemestres] = useState<string[]>([])
  const [programas, setProgramas] = useState<string[]>([])
  const [verFirma, setVerFirma] = useState<Clave | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    const timer = setTimeout(() => fetchClaves(), 300)
    return () => clearTimeout(timer)
  }, [busqueda, semestre, programa])

  useEffect(() => { fetchClaves() }, [])

  const fetchClaves = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (busqueda) params.set('busqueda', busqueda)
      if (semestre) params.set('semestre', semestre)
      if (programa) params.set('programa', programa)
      const res = await fetch(`/api/estudiantes?${params}`)
      const json = await res.json()
      const data: Clave[] = json.data || []
      setClaves(data)

      if (!busqueda && !semestre && !programa) {
        const sems = [...new Set(data.map(c => c.semestre).filter(Boolean))] as string[]
        const progs = [...new Set(data.map(c => c.licenciatura).filter(Boolean))] as string[]
        setSemestres(sems.sort())
        setProgramas(progs.sort())
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const clavesFiltradas = claves.filter(c => {
    if (estado === 'firmado') return !!c.firma
    if (estado === 'pendiente') return !c.firma
    return true
  })

  const firmados = claves.filter(c => c.firma).length
  const pendientes = claves.filter(c => !c.firma).length

  if (status === 'loading') return <div className="min-h-screen flex items-center justify-center">Cargando...</div>

  const user = session?.user as any

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Integrales — Matrícula y Firmas</h1>
            <p className="text-sm text-gray-500">Ciclo 2027-1</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.name}</span>
            <a href="/resumen" className="text-sm text-blue-600 hover:text-blue-800 font-medium">📊 Resumen</a>
            {(user?.role === 'admin' || user?.rol === 'admin') && (
              <a href="/admin" className="text-sm text-purple-600 hover:text-purple-800 font-medium">⚙️ Admin</a>
            )}
            <button onClick={() => signOut({ callbackUrl: '/login' })} className="text-sm text-red-500 hover:text-red-700">Cerrar sesión</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-4 text-center cursor-pointer hover:shadow-md transition" onClick={() => setEstado('')}>
            <p className="text-3xl font-bold text-gray-800">{claves.length}</p>
            <p className="text-sm text-gray-500 mt-1">Total grupos</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 text-center cursor-pointer hover:shadow-md transition" onClick={() => setEstado('firmado')}>
            <p className="text-3xl font-bold text-green-600">{firmados}</p>
            <p className="text-sm text-gray-500 mt-1">Acuses subidos</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 text-center cursor-pointer hover:shadow-md transition" onClick={() => setEstado('pendiente')}>
            <p className="text-3xl font-bold text-orange-500">{pendientes}</p>
            <p className="text-sm text-gray-500 mt-1">Pendientes</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 mb-6 flex flex-col md:flex-row gap-3">
          <input type="text" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por clave, materia o docente..." className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <select value={programa} onChange={(e) => setPrograma(e.target.value)} className="border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
            <option value="">Todas las licenciaturas</option>
            {programas.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={semestre} onChange={(e) => setSemestre(e.target.value)} className="border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
            <option value="">Todos los semestres</option>
            {semestres.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={estado} onChange={(e) => setEstado(e.target.value)} className="border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
            <option value="">Todos los estados</option>
            <option value="firmado">✅ Firmados</option>
            <option value="pendiente">⏳ Pendientes</option>
          </select>
          {(busqueda || programa || semestre || estado) && (
            <button onClick={() => { setBusqueda(''); setPrograma(''); setSemestre(''); setEstado('') }} className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg">Limpiar</button>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
            <h2 className="font-semibold text-gray-700">Grupos</h2>
            <span className="text-sm text-gray-500">{clavesFiltradas.length} grupos</span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-400">Cargando...</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {clavesFiltradas.map((c) => (
                <div key={c.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition cursor-pointer" onClick={() => router.push(`/grupo/${c.id}`)}>
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-blue-600 font-medium text-sm">{c.clave}</span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{c.semestre}</span>
                      <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{c.licenciatura}</span>
                    </div>
                    <p className="text-gray-800 font-medium mt-1">{c.materia}</p>
                    <p className="text-gray-500 text-sm">{c.docente} · <span className="text-blue-500">{c.estudiantes?.length || 0} estudiantes</span></p>
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {c.firma ? (
                      <>
                        <span className="inline-flex items-center gap-1 text-green-600 font-medium text-sm bg-green-50 px-3 py-1.5 rounded-full">✅ Acuse subido</span>
                        <button onClick={() => setVerFirma(c)} className="text-xs text-gray-400 hover:text-gray-600 underline">Ver</button>
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-orange-500 font-medium text-sm bg-orange-50 px-3 py-1.5 rounded-full">
                        ⏳ Pendiente
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {clavesFiltradas.length === 0 && (
                <div className="p-8 text-center text-gray-400">No se encontraron grupos</div>
              )}
            </div>
          )}
        </div>
      </main>

      {verFirma && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="font-bold text-gray-800 text-lg">Acuse — {verFirma.clave}</h2>
                <p className="text-sm text-gray-500">{verFirma.materia}</p>
              </div>
              <button onClick={() => setVerFirma(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <img src={verFirma.firma?.imagen_url} alt="acuse" className="w-full rounded-xl object-contain max-h-96" />
            <p className="text-xs text-gray-400 mt-3 text-center">Subido el {new Date(verFirma.firma?.fecha || '').toLocaleDateString('es-MX', { dateStyle: 'long' })}</p>
          </div>
        </div>
      )}
    </div>
  )
}