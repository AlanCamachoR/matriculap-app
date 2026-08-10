'use client'
import { useSession, signOut } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
interface Estudiante {
  id: number
  id_centro: string
  nombre: string
  programa: string
}
interface Clave {
  id: number
  clave: string
  semestre: string
  materia: string
  docente: string
  licenciatura: string
  grupo: number
  estudiantes: Estudiante[]
  firma: { imagen_url: string; fecha: string } | null
}
export default function GrupoPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const [clave, setClave] = useState<Clave | null>(null)
  const [firmados, setFirmados] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [imagen, setImagen] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [subiendoFoto, setSubiendoFoto] = useState(false)
  const [textoClaude, setTextoClaude] = useState('')
  const [mostrarCampoTexto, setMostrarCampoTexto] = useState(false)
  const [copiado, setCopiado] = useState(false)
  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])
  useEffect(() => {
    if (id) fetchGrupo()
  }, [id])
  const fetchGrupo = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/estudiantes?clave_id=${id}`)
      const json = await res.json()
      const grupos: Clave[] = json.data || []
      const grupo = grupos.find(g => String(g.id) === String(id))
      if (grupo) setClave(grupo)
      const resFirmas = await fetch(`/api/firmas-estudiantes?clave_id=${id}`)
      const jsonFirmas = await resFirmas.json()
      const firmadosSet = new Set<number>(
        (jsonFirmas.data || []).filter((f: any) => f.firmado).map((f: any) => f.estudiante_id)
      )
      setFirmados(firmadosSet)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }
  const toggleFirma = (estudianteId: number) => {
    setFirmados(prev => {
      const nuevo = new Set(prev)
      if (nuevo.has(estudianteId)) {
        nuevo.delete(estudianteId)
      } else {
        nuevo.add(estudianteId)
      }
      return nuevo
    })
  }
  const copiarLista = () => {
    if (!clave) return
    const lista = clave.estudiantes.map((e, i) => `${i + 1}. ${e.nombre} (${e.id_centro})`).join('\n')
    const texto = `Grupo: ${clave.clave}\nMateria: ${clave.materia}\nDocente: ${clave.docente}\n\nLista de estudiantes:\n${lista}`
    navigator.clipboard.writeText(texto)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }
  const procesarRespuestaClaude = () => {
    if (!clave || !textoClaude) return
    const nuevosFirmados = new Set(firmados)
    for (const estudiante of clave.estudiantes) {
      const nombreLower = estudiante.nombre.toLowerCase()
      const partes = nombreLower.split(' ')
      const textoLower = textoClaude.toLowerCase()
      const encontrado = partes.some(parte => parte.length > 3 && textoLower.includes(parte))
      if (encontrado) {
        nuevosFirmados.add(estudiante.id)
      }
    }
    setFirmados(nuevosFirmados)
    setMostrarCampoTexto(false)
    setTextoClaude('')
  }
  const guardarFirmas = async () => {
    if (!clave) return
    setGuardando(true)
    try {
      const res = await fetch('/api/firmas-estudiantes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clave_id: clave.id,
          estudiantes_firmados: Array.from(firmados),
          registrado_por: (session?.user as any)?.name || 'admin'
        })
      })
      const json = await res.json()
      if (json.ok) alert('✅ Firmas guardadas correctamente')
    } catch (e) {
      console.error(e)
    } finally {
      setGuardando(false)
    }
  }
  const handleImagen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImagen(file)
    setPreview(URL.createObjectURL(file))
  }
  const subirFotoAcuse = async () => {
    if (!imagen || !clave) return
    setSubiendoFoto(true)
    try {
      const formData = new FormData()
      formData.append('imagen', imagen)
      formData.append('clave_id', String(clave.id))
      formData.append('registrado_por', (session?.user as any)?.name || 'admin')
      const res = await fetch('/api/firmas', { method: 'POST', body: formData })
      const json = await res.json()
      if (json.ok) {
        setClave(prev => prev ? { ...prev, firma: json.data } : prev)
        setImagen(null)
        setPreview(null)
        alert('✅ Foto del acuse subida correctamente')
      } else {
        alert('❌ Error: ' + json.error)
      }
    } catch (e) {
      console.error(e)
      alert('❌ Error al subir la foto')
    } finally {
      setSubiendoFoto(false)
    }
  }
  if (status === 'loading' || loading) return <div className="min-h-screen flex items-center justify-center">Cargando...</div>
  if (!clave) return <div className="min-h-screen flex items-center justify-center text-gray-400">Grupo no encontrado</div>
  const user = session?.user as any
  const totalFirmados = firmados.size
  const total = clave.estudiantes.length
  const porcentaje = total > 0 ? Math.round((totalFirmados / total) * 100) : 0
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <a href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">← Dashboard</a>
            <div>
              <h1 className="text-xl font-bold text-gray-800">{clave.clave}</h1>
              <p className="text-sm text-gray-500">{clave.materia} · {clave.docente}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.name}</span>
            <button onClick={() => signOut({ callbackUrl: '/login' })} className="text-sm text-red-500 hover:text-red-700">Cerrar sesión</button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Resumen */}
        <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
          <div className="flex justify-between items-center mb-3">
            <div>
              <p className="text-2xl font-bold text-gray-800">{totalFirmados}/{total}</p>
              <p className="text-sm text-gray-500">estudiantes firmados</p>
            </div>
            <span className={`text-2xl font-bold ${porcentaje === 100 ? 'text-green-600' : porcentaje >= 50 ? 'text-blue-600' : 'text-orange-500'}`}>{porcentaje}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div className={`h-3 rounded-full transition-all ${porcentaje === 100 ? 'bg-green-500' : porcentaje >= 50 ? 'bg-blue-500' : 'bg-orange-400'}`} style={{ width: `${porcentaje}%` }} />
          </div>
        </div>
        {/* Acciones */}
        <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
          <h2 className="font-semibold text-gray-700 mb-4">Acciones</h2>
          <div className="flex flex-wrap gap-3">
            <button onClick={copiarLista} className="flex items-center gap-2 border border-gray-300 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-50 transition text-sm">
              {copiado ? '✅ Copiado' : '📋 Copiar lista para Claude'}
            </button>
            <button onClick={() => setMostrarCampoTexto(!mostrarCampoTexto)} className="flex items-center gap-2 border border-blue-300 text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-50 transition text-sm">
              🤖 Pegar respuesta de Claude
            </button>
            <button onClick={guardarFirmas} disabled={guardando} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 transition text-sm">
              {guardando ? 'Guardando...' : '💾 Guardar firmas'}
            </button>
          </div>
          {mostrarCampoTexto && (
            <div className="mt-4">
              <p className="text-sm text-gray-600 mb-2">Pega aquí la respuesta de Claude con los nombres que firmaron:</p>
              <textarea
                value={textoClaude}
                onChange={(e) => setTextoClaude(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 h-32"
                placeholder="Pega aquí la respuesta de Claude..."
              />
              <button onClick={procesarRespuestaClaude} disabled={!textoClaude} className="mt-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition text-sm">
                Procesar y marcar firmados
              </button>
            </div>
          )}
        </div>
        {/* Lista + Foto lado a lado */}
        <div className="flex gap-6 items-start">
          {/* Lista de estudiantes */}
          <div className="flex-1 bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h2 className="font-semibold text-gray-700">Lista de estudiantes</h2>
              <div className="flex gap-2">
                <button onClick={() => setFirmados(new Set(clave.estudiantes.map(e => e.id)))} className="text-xs text-green-600 hover:text-green-800 border border-green-300 px-3 py-1 rounded-lg">Marcar todos</button>
                <button onClick={() => setFirmados(new Set())} className="text-xs text-red-500 hover:text-red-700 border border-red-300 px-3 py-1 rounded-lg">Desmarcar todos</button>
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {clave.estudiantes.map((e, i) => (
                <div
                  key={e.id}
                  className={`px-6 py-3 flex items-center gap-4 cursor-pointer hover:bg-gray-50 transition ${firmados.has(e.id) ? 'bg-green-50' : ''}`}
                  onClick={() => toggleFirma(e.id)}
                >
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${firmados.has(e.id) ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
                    {firmados.has(e.id) && <span className="text-white text-xs">✓</span>}
                  </div>
                  <span className="text-xs text-gray-400 w-6">{i + 1}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">{e.nombre}</p>
                    <p className="text-xs text-gray-400 font-mono">{e.id_centro} · {e.programa}</p>
                  </div>
                  {firmados.has(e.id) && <span className="text-xs text-green-600 font-medium">✅ Firmó</span>}
                </div>
              ))}
            </div>
          </div>
          {/* Foto del acuse */}
          <div className="w-72 flex-shrink-0 bg-white rounded-xl shadow-sm p-5 sticky top-6">
            <h2 className="font-semibold text-gray-700 mb-4">Foto del acuse</h2>
            {clave.firma ? (
              <div>
                <img src={clave.firma.imagen_url} alt="acuse" className="w-full rounded-lg object-contain mb-2" />
                <p className="text-xs text-gray-400 text-center">Subido el {new Date(clave.firma.fecha).toLocaleDateString('es-MX', { dateStyle: 'long' })}</p>
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center cursor-pointer hover:border-blue-400 transition" onClick={() => document.getElementById('fotoAcuse')?.click()}>
                {preview ? (
                  <div>
                    <img src={preview} alt="preview" className="w-full rounded-lg object-contain mb-2" />
                    <button onClick={(e) => { e.stopPropagation(); subirFotoAcuse() }} disabled={subiendoFoto} className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                      {subiendoFoto ? 'Subiendo...' : 'Subir foto'}
                    </button>
                  </div>
                ) : (
                  <div>
                    <p className="text-2xl mb-1">📄</p>
                    <p className="text-gray-500 text-sm">Haz clic para seleccionar foto del acuse</p>
                  </div>
                )}
                <input id="fotoAcuse" type="file" accept="image/*" className="hidden" onChange={handleImagen} />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}