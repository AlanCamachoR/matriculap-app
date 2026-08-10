'use client'
import { useSession, signOut } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

interface Seguimiento {
  id: number
  ciclo: string
  asistencia: string | null
  temarios_oficina: string | null
  temarios_bs: string | null
  materiales_bibliografia: string | null
  participacion_activa: string | null
  evaluacion_intermedia: string | null
  reposiciones: string | null
  evaluacion_final: string | null
  acompanamiento: string | null
  publicacion_calificaciones: string | null
  bloque: string | null
  documentos_institucionales: string | null
  retroalimentacion: string | null
  fecha_retro: string | null
  acta_nacimiento: string | null
  curp: string | null
  ine: string | null
  constancia_fiscal: string | null
  e_firma: string | null
  titulo_licenciatura: string | null
  titulo_maestria: string | null
  titulo_doctorado: string | null
  fm3: string | null
  constancia_extranjero: string | null
  constancias_publicaciones: string | null
}

interface Grupo {
  id: number
  clave: string
  materia: string
  semestre: string
  grupo: number
  docente: string
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
  seguimiento: Seguimiento | null
  grupos: Grupo[]
}

const CAMPOS_SEGUIMIENTO = [
  { key: 'asistencia', label: 'Asistencia' },
  { key: 'temarios_oficina', label: 'Temarios en Oficina' },
  { key: 'temarios_bs', label: 'Temarios en BS' },
  { key: 'materiales_bibliografia', label: 'Materiales y Bibliografía' },
  { key: 'participacion_activa', label: 'Participación activa' },
  { key: 'evaluacion_intermedia', label: 'Evaluación intermedia' },
  { key: 'reposiciones', label: 'Reposiciones' },
  { key: 'evaluacion_final', label: 'Evaluación final' },
  { key: 'acompanamiento', label: 'Acompañamiento' },
  { key: 'publicacion_calificaciones', label: 'Publicación de calificaciones' },
]

const CAMPOS_DOCUMENTOS = [
  { key: 'acta_nacimiento', label: 'Acta de nacimiento' },
  { key: 'curp', label: 'CURP' },
  { key: 'ine', label: 'INE' },
  { key: 'constancia_fiscal', label: 'Constancia de situación fiscal' },
  { key: 'e_firma', label: 'e-firma' },
  { key: 'titulo_licenciatura', label: 'Título y cédula licenciatura' },
  { key: 'titulo_maestria', label: 'Título y cédula Maestría' },
  { key: 'titulo_doctorado', label: 'Título y cédula Doctorado' },
  { key: 'fm3', label: 'FM3' },
  { key: 'constancia_extranjero', label: 'Constancia extranjero' },
  { key: 'constancias_publicaciones', label: 'Constancias y publicaciones' },
]

export default function DocentePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [docente, setDocente] = useState<Docente | null>(null)
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [seg, setSeg] = useState<any>({})
  const [editado, setEditado] = useState(false)
  const [editandoNombre, setEditandoNombre] = useState(false)
  const [nombreEdit, setNombreEdit] = useState('')

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
      setDocente(json.data)
      setSeg(json.data?.seguimiento || {})
      setNombreEdit(json.data?.nombre || '')
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const toggleCampo = (key: string) => {
    setSeg((prev: any) => {
      const actual = prev[key]
      // Ciclo: null/— → SI (verde) → NO (rojo) → null
      const nuevo = !actual || actual === '—' ? 'SI' : actual === 'SI' ? 'NO' : null
      return { ...prev, [key]: nuevo }
    })
    setEditado(true)
  }

  const guardar = async () => {
    if (!docente) return
    setGuardando(true)
    try {
      const res = await fetch('/api/docentes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docente_id: docente.id, ciclo: '2027-1', ...seg })
      })
      const json = await res.json()
      if (json.ok) {
        setEditado(false)
        alert('✅ Seguimiento guardado')
      }
    } catch (e) {
      console.error(e)
    } finally {
      setGuardando(false)
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

  const colorValor = (val: string | null) => {
    if (val === 'SI') return 'bg-green-100 text-green-700 border-green-300'
    if (val === 'NO') return 'bg-red-100 text-red-700 border-red-300'
    return 'bg-yellow-50 text-yellow-600 border-yellow-300'
  }

  const labelValor = (val: string | null) => {
    if (val === 'SI') return '✅ Realizado'
    if (val === 'NO') return '❌ No'
    return '⏳ Pendiente'
  }

  if (status === 'loading' || loading) return <div className="min-h-screen flex items-center justify-center">Cargando...</div>
  if (!docente) return <div className="min-h-screen flex items-center justify-center text-gray-400">Docente no encontrado</div>

  const user = session?.user as any

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <a href="/docentes" className="text-sm text-gray-500 hover:text-gray-700">← Docentes</a>
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
                  <button onClick={() => setEditandoNombre(true)} className="text-xs text-gray-400 hover:text-gray-600">✏️</button>
                </div>
              )}
              <p className="text-sm text-gray-500">{docente.correo_centro} · ID {docente.id_centro}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.name}</span>
            {editado && (
              <button onClick={guardar} disabled={guardando} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">
                {guardando ? 'Guardando...' : '💾 Guardar cambios'}
              </button>
            )}
            <button onClick={() => signOut({ callbackUrl: '/login' })} className="text-sm text-red-500 hover:text-red-700">Cerrar sesión</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* Info general */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="font-semibold text-gray-700 mb-4">Información del docente</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-400 text-xs mb-1">Correo Centro</p>
              <p className="text-gray-800">{docente.correo_centro || '—'}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-1">Correo Personal</p>
              <p className="text-gray-800">{docente.correo_personal || '—'}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-1">Contacto</p>
              <p className="text-gray-800">{docente.contacto || '—'}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-1">Forma de pago</p>
              <p className="text-gray-800">{docente.forma_pago || '—'}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-1">Tabulador</p>
              <p className="text-gray-800">{docente.tabulador || '—'}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-1">Fecha de ingreso</p>
              <p className="text-gray-800">{docente.fecha_ingreso || '—'}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-1">Extranjero</p>
              <p className="text-gray-800">{docente.extranjero || '—'}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-1">Bloque</p>
              <p className="text-gray-800">{seg.bloque || '—'}</p>
            </div>
          </div>
        </div>

        {/* Seguimiento */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-gray-700">Seguimiento — Ciclo 2027-1</h2>
            <p className="text-xs text-gray-400">Haz clic para cambiar: ⏳ Pendiente → ✅ Realizado → ❌ No</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {CAMPOS_SEGUIMIENTO.map(campo => (
              <div key={campo.key} className="text-center">
                <p className="text-xs text-gray-500 mb-2">{campo.label}</p>
                <button
                  onClick={() => toggleCampo(campo.key)}
                  className={`w-full py-2 rounded-lg border text-xs font-medium transition ${colorValor(seg[campo.key])}`}
                >
                  {labelValor(seg[campo.key])}
                </button>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Retroalimentación</label>
                <input
                  type="text"
                  value={seg.retroalimentacion || ''}
                  onChange={(e) => { setSeg((p: any) => ({ ...p, retroalimentacion: e.target.value })); setEditado(true) }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Notas de retroalimentación..."
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Fecha de retro</label>
                <input
                  type="date"
                  value={seg.fecha_retro || ''}
                  onChange={(e) => { setSeg((p: any) => ({ ...p, fecha_retro: e.target.value })); setEditado(true) }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Documentos */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="font-semibold text-gray-700 mb-4">Documentos</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {CAMPOS_DOCUMENTOS.map(campo => (
              <div key={campo.key} className="text-center">
                <p className="text-xs text-gray-500 mb-2">{campo.label}</p>
                <button
                  onClick={() => toggleCampo(campo.key)}
                  className={`w-full py-2 rounded-lg border text-xs font-medium transition ${colorValor(seg[campo.key])}`}
                >
                  {labelValor(seg[campo.key])}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Grupos desde claves */}
        {docente.grupos && docente.grupos.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-700">Materias asignadas — {docente.grupos.length} grupos</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3 text-left">Clave</th>
                    <th className="px-4 py-3 text-left">Semestre</th>
                    <th className="px-4 py-3 text-left">Materia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {docente.grupos.map((g) => (
                    <tr key={g.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-mono text-blue-600 text-xs">{g.clave}</td>
                      <td className="px-4 py-2.5 text-gray-600">{g.semestre}</td>
                      <td className="px-4 py-2.5 text-gray-800 font-medium">{g.materia}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}