'use client'
import { useSession, signOut } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

interface SegMateria {
  id?: number
  asistencia: string | null
  temarios_oficina: string | null
  temarios_bs: string | null
  materiales_bibliografia: string | null
  evaluacion_intermedia: string | null
  evaluacion_final: string | null
  publicacion_calificaciones: string | null
}

interface Grupo {
  id: number
  clave: string
  materia: string
  semestre: string
  grupo: number
  enlace: string | null
  seguimiento: SegMateria | null
}

interface Docente {
  id: number
  id_centro: string
  nombre: string
  correo_centro: string
  correo_personal: string
  contacto: string
  forma_pago: string
  tabulador: string
  fecha_ingreso: string
  extranjero: string
  grupos: Grupo[]
  porcentaje: number
}

const CAMPOS = [
  { key: 'asistencia', label: 'Asistencia' },
  { key: 'temarios_oficina', label: 'Temarios Oficina' },
  { key: 'temarios_bs', label: 'Temarios BS' },
  { key: 'materiales_bibliografia', label: 'Materiales' },
  { key: 'evaluacion_intermedia', label: 'Eval. Intermedia' },
  { key: 'evaluacion_final', label: 'Eval. Final' },
  { key: 'publicacion_calificaciones', label: 'Publicacion Cal.' },
]

const formatId = (id: string) => `0000${id}`

export default function DocenteDetallePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [docente, setDocente] = useState<Docente | null>(null)
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState<number | null>(null)
  const [editandoNombre, setEditandoNombre] = useState(false)
  const [nombreEdit, setNombreEdit] = useState('')
  const [segs, setSegs] = useState<Record<number, SegMateria>>({})
  const [editados, setEditados] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    if (id) fetchDocente()
  }, [id])

  const fetchDocente = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/docentes?id=${id}`)
      const json = await res.json()
      const data: Docente = json.data
      setDocente(data)
      setNombreEdit(data?.nombre || '')
      const inicial: Record<number, SegMateria> = {}
      for (const g of data?.grupos || []) {
        inicial[g.id] = g.seguimiento || {
          asistencia: null,
          temarios_oficina: null,
          temarios_bs: null,
          materiales_bibliografia: null,
          evaluacion_intermedia: null,
          evaluacion_final: null,
          publicacion_calificaciones: null,
        }
      }
      setSegs(inicial)
      setEditados(new Set())
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const toggleCampo = (grupoId: number, key: string) => {
    setSegs(prev => {
      const actual = prev[grupoId]?.[key as keyof SegMateria]
      const nuevo = !actual ? 'SI' : actual === 'SI' ? 'NO' : null
      return { ...prev, [grupoId]: { ...prev[grupoId], [key]: nuevo } }
    })
    setEditados(prev => new Set(prev).add(grupoId))
  }

  const guardarMateria = async (grupoId: number) => {
    if (!docente) return
    setGuardando(grupoId)
    try {
      const res = await fetch('/api/docentes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docente_id: docente.id,
          clave_id: grupoId,
          ciclo: '2027-1',
          ...segs[grupoId],
        })
      })
      const json = await res.json()
      if (json.ok) {
        setEditados(prev => {
          const s = new Set(prev)
          s.delete(grupoId)
          return s
        })
      }
    } catch (e) {
      console.error(e)
    } finally {
      setGuardando(null)
    }
  }

  const guardarNombre = async () => {
    if (!docente) return
    try {
      const res = await fetch('/api/docentes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: docente.id, nombre: nombreEdit })
      })
      const json = await res.json()
      if (json.ok) {
        setDocente(prev => prev ? { ...prev, nombre: nombreEdit } : prev)
        setEditandoNombre(false)
      }
    } catch (e) {
      console.error(e)
    }
  }

  const colorCheck = (val: string | null) => {
    if (val === 'SI') return 'bg-green-500 border-green-500 text-white'
    if (val === 'NO') return 'bg-red-400 border-red-400 text-white'
    return 'bg-white border-gray-300 text-gray-400'
  }

  const iconCheck = (val: string | null) => {
    if (val === 'SI') return 'SI'
    if (val === 'NO') return 'NO'
    return '--'
  }

  if (status === 'loading' || loading) return (
    <div className="min-h-screen flex items-center justify-center">Cargando...</div>
  )
  if (!docente) return (
    <div className="min-h-screen flex items-center justify-center text-gray-400">Docente no encontrado</div>
  )

  const user = session?.user as any
  const totalGrupos = docente.grupos.length
  const porcentaje = docente.porcentaje

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/docentes')} className="text-sm text-gray-500 hover:text-gray-700">
              Docentes
            </button>
            <div>
              {editandoNombre ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={nombreEdit}
                    onChange={(e) => setNombreEdit(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-1 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button onClick={guardarNombre} className="text-sm bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700">Guardar</button>
                  <button onClick={() => setEditandoNombre(false)} className="text-sm text-gray-500 hover:text-gray-700">Cancelar</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-gray-800">{docente.nombre}</h1>
                  <button onClick={() => setEditandoNombre(true)} className="text-xs text-gray-400 hover:text-gray-600">editar</button>
                </div>
              )}
              <p className="text-sm text-gray-500">{formatId(docente.id_centro)} · {docente.correo_centro}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.name}</span>
            <button onClick={() => signOut({ callbackUrl: '/login' })} className="text-sm text-red-500 hover:text-red-700">Cerrar sesion</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-xs text-gray-400 mb-1">Tipo de contrato</p>
              <span className="text-sm font-medium bg-orange-50 text-orange-600 px-3 py-1 rounded-full border border-orange-200">
                {docente.forma_pago || '-'}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Tabulador</p>
              <p className="text-sm font-medium text-gray-800">{docente.tabulador || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Materias asignadas</p>
              <p className="text-2xl font-bold text-blue-600">{totalGrupos}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-2">Avance de cumplimiento</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-gray-100 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${porcentaje === 100 ? 'bg-green-500' : porcentaje >= 50 ? 'bg-blue-500' : 'bg-orange-400'}`}
                    style={{ width: `${porcentaje}%` }}
                  />
                </div>
                <span className={`text-lg font-bold ${porcentaje === 100 ? 'text-green-600' : porcentaje >= 50 ? 'text-blue-600' : 'text-orange-500'}`}>
                  {porcentaje}%
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-100 text-sm">
            <div>
              <p className="text-gray-400 text-xs mb-1">Correo personal</p>
              <p className="text-gray-800">{docente.correo_personal || '-'}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-1">Contacto</p>
              <p className="text-gray-800">{docente.contacto || '-'}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-1">Fecha de ingreso</p>
              <p className="text-gray-800">{docente.fecha_ingreso || '-'}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-1">Extranjero</p>
              <p className="text-gray-800">{docente.extranjero || '-'}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-semibold text-gray-700">Seguimiento por materia — Ciclo 2027-1</h2>
            <p className="text-xs text-gray-400">Clic para cambiar estado</p>
          </div>

          {docente.grupos.length === 0 && (
            <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-400">
              No hay materias asignadas a este docente
            </div>
          )}

          {docente.grupos.map(g => {
            const seg = segs[g.id] || {}
            const completados = CAMPOS.filter(c => seg[c.key as keyof SegMateria] === 'SI').length
            const pct = Math.round((completados / CAMPOS.length) * 100)
            const estaEditado = editados.has(g.id)

            return (
              <div key={g.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-blue-600 font-medium text-sm">{g.clave}</span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{g.semestre}</span>
                      {g.enlace ? (
                        <button
                          onClick={() => window.open(g.enlace!, '_blank')}
                          className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-200 hover:bg-blue-100 transition"
                        >
                          Brightspace
                        </button>
                      ) : null}
                    </div>
                    <p className="text-gray-800 font-medium mt-0.5">{g.materia}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className={`text-sm font-bold ${pct === 100 ? 'text-green-600' : pct >= 50 ? 'text-blue-600' : 'text-orange-500'}`}>
                        {pct}%
                      </p>
                      <p className="text-xs text-gray-400">{completados}/{CAMPOS.length}</p>
                    </div>
                    {estaEditado && (
                      <button
                        onClick={() => guardarMateria(g.id)}
                        disabled={guardando === g.id}
                        className="bg-green-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
                      >
                        {guardando === g.id ? 'Guardando...' : 'Guardar'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="px-5 py-4">
                  <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
                    {CAMPOS.map(campo => {
                      const val = seg[campo.key as keyof SegMateria] as string | null
                      return (
                        <div key={campo.key} className="text-center">
                          <p className="text-xs text-gray-500 mb-2 leading-tight">{campo.label}</p>
                          <button
                            onClick={() => toggleCampo(g.id, campo.key)}
                            className={`w-full h-9 rounded-lg border-2 text-sm font-bold transition ${colorCheck(val)}`}
                          >
                            {iconCheck(val)}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}