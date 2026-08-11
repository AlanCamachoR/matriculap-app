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

interface EstudianteResultado {
  id: number
  id_centro: string
  nombre: string
  programa: string
  grupos: { clave: string; materia: string; docente: string; semestre: string; firmado: boolean }[]
}

const LICENCIATURAS = [
  'Arquitectura', 'Arquitectura de Interiores', 'Cine y Televisión',
  'Comunicación Visual', 'Computación Creativa', 'Diseño Industrial',
  'Diseño Textil y Moda', 'Mercadotecnia y Publicidad', 'Negocios e Industrias Creativas',
]

const formatId = (id: string) => `0000${id}`

// Quita acentos y pasa a minúsculas
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [claves, setClaves] = useState<Clave[]>([])
  const [busquedaGrupo, setBusquedaGrupo] = useState('')
  const [busquedaEstudiante, setBusquedaEstudiante] = useState('')
  const [semestre, setSemestre] = useState('')
  const [programa, setPrograma] = useState('')
  const [estado, setEstado] = useState('')
  const [loading, setLoading] = useState(false)
  const [semestres, setSemestres] = useState<string[]>([])
  const [modal, setModal] = useState<Clave | null>(null)
  const [imagen, setImagen] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [verFirma, setVerFirma] = useState<Clave | null>(null)
  const [estudiantes, setEstudiantes] = useState<EstudianteResultado[]>([])
  const [estudianteSeleccionado, setEstudianteSeleccionado] = useState<EstudianteResultado | null>(null)
  const [loadingEst, setLoadingEst] = useState(false)
  const [tabActivo, setTabActivo] = useState<'grupos' | 'estudiante'>('grupos')

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => { fetchClaves() }, [])

  useEffect(() => {
    const timer = setTimeout(() => fetchClaves(), 350)
    return () => clearTimeout(timer)
  }, [semestre, programa])

  // Buscar grupos cuando cambia el campo de grupo
  useEffect(() => {
    const timer = setTimeout(() => fetchClaves(), 350)
    return () => clearTimeout(timer)
  }, [busquedaGrupo])

  // Buscar estudiantes cuando cambia el campo de estudiante
  useEffect(() => {
    const timer = setTimeout(() => {
      if (busquedaEstudiante.trim().length >= 2) {
        buscarEstudiante()
      } else {
        setEstudiantes([])
        setEstudianteSeleccionado(null)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [busquedaEstudiante])

  const fetchClaves = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (busquedaGrupo) params.set('busqueda', busquedaGrupo)
      if (semestre) params.set('semestre', semestre)
      const res = await fetch(`/api/estudiantes?${params}`)
      const json = await res.json()
      const data: Clave[] = json.data || []
      setClaves(data)
      if (!busquedaGrupo && !semestre) {
        const sems = [...new Set(data.map(c => c.semestre).filter(Boolean))] as string[]
        setSemestres(sems.sort())
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const buscarEstudiante = async () => {
    if (!busquedaEstudiante.trim()) return
    setLoadingEst(true)
    try {
      const res = await fetch(`/api/estudiantes-detalle?busqueda=${encodeURIComponent(busquedaEstudiante)}`)
      const json = await res.json()
      setEstudiantes(json.data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingEst(false)
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
        setClaves(prev => prev.map(c => c.id === modal.id ? { ...c, firma: json.data } : c))
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

  const limpiarTodo = () => {
    setBusquedaGrupo('')
    setBusquedaEstudiante('')
    setPrograma('')
    setSemestre('')
    setEstado('')
    setEstudiantes([])
    setEstudianteSeleccionado(null)
  }

  // Filtro adicional del lado cliente con normalización de acentos
  const clavesFiltradas = claves.filter(c => {
    const coincidePrograma = !programa || (c.estudiantes || []).some(e => e.programa === programa)
    const coincideEstado = !estado || (estado === 'firmado' ? !!c.firma : !c.firma)
    // Filtro extra client-side por docente/materia sin acento
    const coincideBusqueda = !busquedaGrupo || (
      normalizar(c.materia).includes(normalizar(busquedaGrupo)) ||
      normalizar(c.docente).includes(normalizar(busquedaGrupo)) ||
      normalizar(c.clave).includes(normalizar(busquedaGrupo))
    )
    return coincidePrograma && coincideEstado && coincideBusqueda
  })

  const firmados = claves.filter(c => c.firma).length
  const pendientes = claves.filter(c => !c.firma).length
  const hayFiltros = busquedaGrupo || busquedaEstudiante || programa || semestre || estado

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
            <a href="/docentes" className="text-sm text-orange-600 hover:text-orange-800 font-medium">👨‍🏫 Docentes</a>
            {(user?.role === 'admin' || user?.rol === 'admin') && (
              <a href="/admin" className="text-sm text-purple-600 hover:text-purple-800 font-medium">⚙️ Admin</a>
            )}
            <button onClick={() => signOut({ callbackUrl: '/login' })} className="text-sm text-red-500 hover:text-red-700">Cerrar sesión</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">

        {/* Tarjetas */}
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

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm mb-6 overflow-hidden">
          <div className="flex border-b border-gray-100">
            <button
              onClick={() => setTabActivo('grupos')}
              className={`flex-1 py-3 text-sm font-medium transition ${tabActivo === 'grupos' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700'}`}
            >
              📋 Buscar por docente o materia
            </button>
            <button
              onClick={() => setTabActivo('estudiante')}
              className={`flex-1 py-3 text-sm font-medium transition ${tabActivo === 'estudiante' ? 'text-green-600 border-b-2 border-green-600 bg-green-50' : 'text-gray-500 hover:text-gray-700'}`}
            >
              🎓 Buscar estudiante
            </button>
          </div>

          <div className="p-4">
            {tabActivo === 'grupos' ? (
              <div className="flex flex-col md:flex-row gap-3">
                <div className="flex-1">
                  <input
                    type="text"
                    value={busquedaGrupo}
                    onChange={(e) => setBusquedaGrupo(e.target.value)}
                    placeholder="Buscar por docente, materia o clave del grupo..."
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                </div>
                <select value={programa} onChange={(e) => setPrograma(e.target.value)} className="border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="">Todas las licenciaturas</option>
                  {LICENCIATURAS.map(l => <option key={l} value={l}>{l}</option>)}
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
                {hayFiltros && (
                  <button onClick={limpiarTodo} className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg whitespace-nowrap">Limpiar</button>
                )}
              </div>
            ) : (
              <div className="flex gap-3">
                <input
                  type="text"
                  value={busquedaEstudiante}
                  onChange={(e) => setBusquedaEstudiante(e.target.value)}
                  placeholder="Buscar por nombre o ID del estudiante..."
                  className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500"
                  autoFocus
                />
                {hayFiltros && (
                  <button onClick={limpiarTodo} className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg">Limpiar</button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Contenido según tab */}
        {tabActivo === 'estudiante' ? (

          /* Vista estudiantes */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {busquedaEstudiante.trim().length < 2 ? (
              <div className="md:col-span-3 bg-white rounded-xl shadow-sm p-8 text-center text-gray-400">
                <p className="text-4xl mb-3">🎓</p>
                <p>Escribe al menos 2 caracteres para buscar un estudiante</p>
              </div>
            ) : loadingEst ? (
              <div className="md:col-span-3 bg-white rounded-xl shadow-sm p-8 text-center text-gray-400">Buscando estudiantes...</div>
            ) : estudiantes.length > 0 ? (
              <>
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-600">{estudiantes.length} resultado{estudiantes.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {estudiantes.map(e => (
                      <div key={e.id} onClick={() => setEstudianteSeleccionado(e)} className={`px-4 py-3 cursor-pointer hover:bg-gray-50 transition ${estudianteSeleccionado?.id === e.id ? 'bg-green-50 border-l-4 border-green-500' : ''}`}>
                        <p className="font-medium text-gray-800 text-sm">{e.nombre}</p>
                        <p className="text-xs text-gray-400 font-mono">{formatId(e.id_centro)} · {e.programa}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {estudianteSeleccionado && (
                  <div className="md:col-span-2 space-y-4">
                    <div className="bg-white rounded-xl shadow-sm p-5">
                      <div className="flex items-start justify-between">
                        <div>
                          <h2 className="text-xl font-bold text-gray-800">{estudianteSeleccionado.nombre}</h2>
                          <p className="text-sm text-gray-500 mt-1 font-mono">{formatId(estudianteSeleccionado.id_centro)}</p>
                          <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full mt-2 inline-block">{estudianteSeleccionado.programa}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-blue-600">{estudianteSeleccionado.grupos.length}</p>
                          <p className="text-xs text-gray-400">materias inscritas</p>
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="bg-green-50 rounded-lg p-3 text-center">
                          <p className="text-xl font-bold text-green-600">{estudianteSeleccionado.grupos.filter(g => g.firmado).length}</p>
                          <p className="text-xs text-gray-500">materias firmadas</p>
                        </div>
                        <div className="bg-orange-50 rounded-lg p-3 text-center">
                          <p className="text-xl font-bold text-orange-500">{estudianteSeleccionado.grupos.filter(g => !g.firmado).length}</p>
                          <p className="text-xs text-gray-500">materias pendientes</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                      <div className="px-5 py-3 border-b border-gray-100">
                        <h3 className="font-semibold text-gray-700">Materias inscritas</h3>
                      </div>
                      <div className="divide-y divide-gray-100">
                        {estudianteSeleccionado.grupos.map((g, i) => (
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
                              {g.firmado
                                ? <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full font-medium">✅ Firmó</span>
                                : <span className="text-xs text-orange-500 bg-orange-50 px-2 py-1 rounded-full">⏳ Pendiente</span>
                              }
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="md:col-span-3 bg-white rounded-xl shadow-sm p-8 text-center text-gray-400">
                No se encontraron estudiantes con "{busquedaEstudiante}"
              </div>
            )}
          </div>

        ) : (

          /* Vista grupos */
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
                    <div className="flex-1 cursor-pointer" onClick={() => router.push(`/grupo/${c.id}`)}>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-blue-600 font-medium text-sm">{c.clave}</span>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{c.semestre}</span>
                      </div>
                      <p className="text-gray-800 font-medium mt-1">{c.materia}</p>
                      <p className="text-gray-500 text-sm">{c.docente} · {c.estudiantes?.length || 0} estudiantes</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {c.firma ? (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 text-green-600 font-medium text-sm bg-green-50 px-3 py-1.5 rounded-full">✅ Acuse subido</span>
                          <button onClick={(e) => { e.stopPropagation(); setVerFirma(c) }} className="text-xs text-gray-400 hover:text-gray-600 underline">Ver</button>
                        </div>
                      ) : (
                        <button onClick={(e) => { e.stopPropagation(); setModal(c) }} className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition">
                          📎 Subir acuse
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {clavesFiltradas.length === 0 && (
                  <div className="p-8 text-center text-gray-400">
                    {busquedaGrupo ? `No se encontraron grupos con "${busquedaGrupo}"` : 'No se encontraron grupos'}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="font-bold text-gray-800 text-lg">Subir Acuse</h2>
                <p className="text-sm font-mono text-blue-600 mt-1">{modal.clave}</p>
                <p className="text-sm text-gray-600">{modal.materia}</p>
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
    </div>
  )
}