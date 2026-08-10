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
  const [modal, setModal] = useState<Clave | null>(null)
  const [imagen, setImagen] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [verFirma, setVerFirma] = useState<Clave | null>(null)
  const [verEstudiantes, setVerEstudiantes] = useState<Clave | null>(null)

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

  const handleImagen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImagen(file)
    setPreview(URL.createObjectURL(file))
  }

  const handleSubirAcuse = async () => {
    if (!imagen || !modal) return
    setSubiendo(true)
    try {
      const formData = new FormData()
      formData.append('imagen', imagen)
      formData.append('clave_id', String(modal.id))
      formData.append('registrado_por', (session?.user as any)?.name || 'admin')

      const res = await fetch('/api/firmas', { method: 'POST', body: formData })
      const json = await res.json()

      if (json.ok) {
        setClaves(prev => prev.map(c =>
          c.id === modal.id ? { ...c, firma: json.data } : c
        ))
        setModal(null)
        setImagen(null)
        setPreview(null)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setSubiendo(false)
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
                <div key={c.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition">
                  <div className="flex-1 cursor-pointer" onClick={() => setVerEstudiantes(c)}>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-blue-600 font-medium text-sm">{c.clave}</span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{c.semestre}</span>
                      <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{c.licenciatura}</span>
                    </div>
                    <p className="text-gray-800 font-medium mt-1">{c.materia}</p>
                    <p className="text-gray-500 text-sm">{c.docente} · <span className="text-blue-500 hover:underline">{c.estudiantes?.length || 0} estudiantes</span></p>
                  </div>
                  <div className="flex items-center gap-3">
                    {c.firma ? (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-green-600 font-medium text-sm bg-green-50 px-3 py-1.5 rounded-full">✅ Acuse subido</span>
                        <button onClick={() => setVerFirma(c)} className="text-xs text-gray-400 hover:text-gray-600 underline">Ver</button>
                      </div>
                    ) : (
                      <button onClick={() => setModal(c)} className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition">
                        📎 Subir acuse
                      </button>
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

      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="font-bold text-gray-800 text-lg">Subir Acuse</h2>
                <p className="text-sm font-mono text-blue-600 mt-1">{modal.clave}</p>
                <p className="text-sm text-gray-600">{modal.materia}</p>
                <p className="text-xs text-gray-400 mt-1">{modal.estudiantes?.length || 0} estudiantes serán marcados como firmados</p>
              </div>
              <button onClick={() => { setModal(null); setImagen(null); setPreview(null) }} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center mb-4 cursor-pointer hover:border-blue-400 transition" onClick={() => document.getElementById('fileInput')?.click()}>
              {preview ? (
                <img src={preview} alt="preview" className="max-h-48 mx-auto rounded-lg object-contain" />
              ) : (
                <div>
                  <p className="text-4xl mb-2">📄</p>
                  <p className="text-gray-500 text-sm">Haz clic para seleccionar el acuse</p>
                  <p className="text-gray-400 text-xs mt-1">JPG, PNG — foto o escaneo del acuse firmado</p>
                </div>
              )}
              <input id="fileInput" type="file" accept="image/*" className="hidden" onChange={handleImagen} />
            </div>

            <div className="flex gap-3">
              <button onClick={() => { setModal(null); setImagen(null); setPreview(null) }} className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-lg hover:bg-gray-50 transition">Cancelar</button>
              <button onClick={handleSubirAcuse} disabled={!imagen || subiendo} className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition">
                {subiendo ? 'Subiendo...' : 'Guardar acuse'}
              </button>
            </div>
          </div>
        </div>
      )}

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

      {verEstudiantes && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="font-bold text-gray-800 text-lg">{verEstudiantes.clave}</h2>
                <p className="text-sm text-gray-600">{verEstudiantes.materia}</p>
                <p className="text-xs text-gray-400">{verEstudiantes.docente} · {verEstudiantes.estudiantes?.length || 0} estudiantes</p>
              </div>
              <button onClick={() => setVerEstudiantes(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="max-h-96 overflow-y-auto divide-y divide-gray-100">
              {verEstudiantes.estudiantes?.map((e, i) => (
                <div key={e.id} className="py-2.5 flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-6">{i + 1}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{e.nombre}</p>
                    <p className="text-xs text-gray-400 font-mono">{e.id_centro} · {e.programa}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}