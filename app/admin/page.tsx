'use client'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Breadcrumb from '@/app/components/Breadcrumb'

interface Usuario {
  id: string
  email: string
  nombre: string
  rol: string
  licenciatura: string | null
  created_at: string
}

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', nombre: '', rol: 'profesor', licenciatura: '' })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [actualizando, setActualizando] = useState(false)
  const [resultadoActualizacion, setResultadoActualizacion] = useState<any>(null)
  const [actualizandoClaves, setActualizandoClaves] = useState(false)
  const [resultadoClaves, setResultadoClaves] = useState<any>(null)
  const [actualizandoSecciones, setActualizandoSecciones] = useState(false)
  const [resultadoSecciones, setResultadoSecciones] = useState<any>(null)
  const [actualizandoHorarios, setActualizandoHorarios] = useState(false)
  const [resultadoHorarios, setResultadoHorarios] = useState<any>(null)
  const [generandoHorarios, setGenerandoHorarios] = useState(false)
  const [resultadoGenerar, setResultadoGenerar] = useState<any>(null)
  const [actualizandoEstudiantes, setActualizandoEstudiantes] = useState(false)
  const [resultadoEstudiantes, setResultadoEstudiantes] = useState<any>(null)
  const [actualizandoPlan, setActualizandoPlan] = useState(false)
  const [resultadoPlan, setResultadoPlan] = useState<any>(null)
  const [cargandoAsistencias, setCargandoAsistencias] = useState(false)
  const [resultadoAsistencias, setResultadoAsistencias] = useState<any>(null)
  const [aulas, setAulas] = useState<{ id: number; nombre: string; capacidad: number | null; piso: string | null; equipamiento: string[] }[]>([])
  const [aulaSearch, setAulaSearch] = useState('')
  const [aulaGuardando, setAulaGuardando] = useState<number | null>(null)

  const ESPEC_OPTS = ['Tarja', 'Blackout', 'Persianas']
  const MOB_OPTS = ['Mesas', 'Paletas', 'Ampliadoras', 'Equipos', 'Caballetes', 'Butacas']
  const EQUIP_OPTS = [...ESPEC_OPTS, ...MOB_OPTS]

  useEffect(() => {
    fetch('/api/aulas/equipamiento').then(r => r.json()).then(j => setAulas(j.data || []))
  }, [])

  const toggleEquip = async (aulaId: number, item: string) => {
    const aula = aulas.find(a => a.id === aulaId)
    if (!aula) return
    const equip = aula.equipamiento ?? []
    const next = equip.includes(item) ? equip.filter(e => e !== item) : [...equip, item]
    setAulas(prev => prev.map(a => a.id === aulaId ? { ...a, equipamiento: next } : a))
    setAulaGuardando(aulaId)
    await fetch('/api/aulas/equipamiento', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: aulaId, equipamiento: next })
    })
    setAulaGuardando(null)
  }

  const [modalDocente, setModalDocente] = useState(false)
  const [formDocente, setFormDocente] = useState({ nombre: '', id_centro: '', correo_centro: '', correo_personal: '', contacto: '', forma_pago: 'Honorarios' })
  const [guardandoDocente, setGuardandoDocente] = useState(false)
  const [errorDocente, setErrorDocente] = useState('')
  const [okDocente, setOkDocente] = useState('')

  const licenciaturas = [
    'Arquitectura', 'Arquitectura de Interiores', 'Cine y Televisión',
    'Comunicación Visual', 'Computación Creativa', 'Diseño Industrial',
    'Diseño Textil y Moda', 'Mercadotecnia y Publicidad', 'Negocios e Industrias Creativas',
  ]

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated') {
      const user = session?.user as any
      if (user?.role !== 'admin' && user?.rol !== 'admin') router.push('/dashboard')
    }
  }, [status, session, router])

  useEffect(() => { fetchUsuarios() }, [])

  const fetchUsuarios = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/usuarios')
      const json = await res.json()
      setUsuarios(json.data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleCrear = async () => {
    setGuardando(true)
    setError('')
    try {
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const json = await res.json()
      if (json.error) { setError(json.error); return }
      setUsuarios(prev => [json.data, ...prev])
      setModal(false)
      setForm({ email: '', password: '', nombre: '', rol: 'profesor', licenciatura: '' })
    } catch (e) {
      setError('Error al crear usuario')
    } finally {
      setGuardando(false)
    }
  }

  const handleCrearDocente = async () => {
    setGuardandoDocente(true)
    setErrorDocente('')
    setOkDocente('')
    try {
      const res = await fetch('/api/docentes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formDocente)
      })
      const json = await res.json()
      if (json.error) { setErrorDocente(json.error); return }
      setOkDocente(`✓ Docente "${formDocente.nombre}" creado correctamente (ID: ${json.data?.id})`)
      setFormDocente({ nombre: '', id_centro: '', correo_centro: '', correo_personal: '', contacto: '', forma_pago: 'Honorarios' })
    } catch (e) {
      setErrorDocente('Error al crear docente')
    } finally {
      setGuardandoDocente(false)
    }
  }

  const handleEliminar = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar a ${nombre}?`)) return
    try {
      await fetch('/api/usuarios', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })
      setUsuarios(prev => prev.filter(u => u.id !== id))
    } catch (e) {
      console.error(e)
    }
  }

  const handleActualizarMatricula = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setActualizando(true)
    setResultadoActualizacion(null)
    try {
      const formData = new FormData()
      formData.append('archivo', file)
      const res = await fetch('/api/actualizar-matricula', { method: 'POST', body: formData })
      const json = await res.json()
      if (json.ok) {
        setResultadoActualizacion(json.resumen)
      } else {
        alert('Error: ' + json.error)
      }
    } catch (e) {
      alert('Error al procesar el archivo')
    } finally {
      setActualizando(false)
      const input = document.getElementById('archivoMatricula') as HTMLInputElement
      if (input) input.value = ''
    }
  }

  const handleActualizarClaves = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setActualizandoClaves(true)
    setResultadoClaves(null)
    try {
      const formData = new FormData()
      formData.append('archivo', file)
      const res = await fetch('/api/actualizar-claves', { method: 'POST', body: formData })
      const json = await res.json()
      if (json.ok) {
        setResultadoClaves(json.resumen)
      } else {
        alert('Error: ' + json.error)
      }
    } catch (e) {
      alert('Error al procesar el archivo')
    } finally {
      setActualizandoClaves(false)
      const input = document.getElementById('archivoClaves') as HTMLInputElement
      if (input) input.value = ''
    }
  }

  const handleActualizarHorarios = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setActualizandoHorarios(true)
    setResultadoHorarios(null)
    try {
      const formData = new FormData()
      formData.append('archivo', file)
      const res = await fetch('/api/actualizar-horarios-ocupacion', { method: 'POST', body: formData })
      const json = await res.json()
      if (json.ok) setResultadoHorarios(json.resumen)
      else alert('Error: ' + json.error)
    } catch { alert('Error al procesar el archivo') }
    finally {
      setActualizandoHorarios(false)
      const input = document.getElementById('archivoHorarios') as HTMLInputElement
      if (input) input.value = ''
    }
  }

  const handleActualizarEstudiantes = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setActualizandoEstudiantes(true)
    setResultadoEstudiantes(null)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await fetch('/api/actualizar-estudiantes-calificaciones', { method: 'POST', body: fd })
      const data = await res.json()
      setResultadoEstudiantes(data)
    } catch (err: any) {
      setResultadoEstudiantes({ error: err.message })
    } finally {
      setActualizandoEstudiantes(false)
      e.target.value = ''
    }
  }

  const handleGenerarHorarios = async () => {
    if (!confirm('Esto borrará los horarios actuales y los regenerará desde secciones. ¿Continuar?')) return
    setGenerandoHorarios(true)
    setResultadoGenerar(null)
    try {
      const res = await fetch('/api/generar-horarios', { method: 'POST' })
      const json = await res.json()
      if (json.ok) setResultadoGenerar(json.resumen)
      else alert('Error: ' + json.error)
    } catch { alert('Error al generar horarios') }
    finally { setGenerandoHorarios(false) }
  }

  const handleActualizarSecciones = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setActualizandoSecciones(true)
    setResultadoSecciones(null)
    try {
      const formData = new FormData()
      formData.append('archivo', file)
      const res = await fetch('/api/actualizar-secciones', { method: 'POST', body: formData })
      const json = await res.json()
      if (json.ok) {
        setResultadoSecciones(json.resumen)
      } else {
        alert('Error: ' + json.error)
      }
    } catch (e) {
      alert('Error al procesar el archivo')
    } finally {
      setActualizandoSecciones(false)
      const input = document.getElementById('archivoSecciones') as HTMLInputElement
      if (input) input.value = ''
    }
  }

  const handleActualizarPlan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setActualizandoPlan(true)
    setResultadoPlan(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/actualizar-plan-asignaturas', { method: 'POST', body: formData })
      const json = await res.json()
      setResultadoPlan(json)
    } catch (e) {
      setResultadoPlan({ error: 'Error al procesar el archivo' })
    } finally {
      setActualizandoPlan(false)
      const input = document.getElementById('archivoPlan') as HTMLInputElement
      if (input) input.value = ''
    }
  }

  const handleCargarAsistencias = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCargandoAsistencias(true)
    setResultadoAsistencias(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('ciclo', '2027-1')
      const res = await fetch('/api/asistencias-core', { method: 'POST', body: formData })
      const json = await res.json()
      setResultadoAsistencias(json)
    } catch {
      setResultadoAsistencias({ error: 'Error al procesar el archivo' })
    } finally {
      setCargandoAsistencias(false)
      const input = document.getElementById('archivoAsistencias') as HTMLInputElement
      if (input) input.value = ''
    }
  }

  if (status === 'loading') return <div className="min-h-screen flex items-center justify-center">Cargando...</div>

  const user = session?.user as any

  return (
    <div className="min-h-screen bg-gray-50">
      <Breadcrumb items={[{ label: 'Admin' }]} />
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <h1 className="text-base font-semibold text-gray-800">Panel de Administrador</h1>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* Carga de archivos */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-semibold text-gray-700 mb-4">Carga de archivos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">

            {/* Matrícula */}
            <div className="border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">🎓</span>
                <h3 className="font-medium text-gray-700">Matrícula</h3>
              </div>
              <p className="text-xs text-gray-500 mb-4">CENTRO_Calificaciones_Finales — actualiza estudiantes e inscripciones</p>
              <button
                onClick={() => document.getElementById('archivoMatricula')?.click()}
                disabled={actualizando}
                className="w-full bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition text-sm font-medium"
              >
                {actualizando ? '⏳ Procesando...' : '📤 Subir archivo'}
              </button>
              <input id="archivoMatricula" type="file" accept=".xlsx,.xls" className="hidden" onChange={handleActualizarMatricula} />
              {resultadoActualizacion && (
                <div className="mt-3 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-700">
 ✅ {resultadoActualizacion.estudiantesActualizados} estudiantes, {resultadoActualizacion.matriculasActualizadas} matrículas regulares, {resultadoActualizacion.irregularesInscritos || 0} irregulares
                </div>
              )}
            </div>

            {/* Claves EI */}
            <div className="border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">📋</span>
                <h3 className="font-medium text-gray-700">Claves EI</h3>
              </div>
              <p className="text-xs text-gray-500 mb-4">Claves — actualiza grupos y materias de Estudios Integrales</p>
              <button
                onClick={() => document.getElementById('archivoClaves')?.click()}
                disabled={actualizandoClaves}
                className="w-full bg-orange-600 text-white px-4 py-2.5 rounded-lg hover:bg-orange-700 disabled:opacity-50 transition text-sm font-medium"
              >
                {actualizandoClaves ? '⏳ Procesando...' : '📤 Subir archivo'}
              </button>
              <input id="archivoClaves" type="file" accept=".xlsx,.xls" className="hidden" onChange={handleActualizarClaves} />
              {resultadoClaves && (
                <div className="mt-3 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-700">
                  ✅ {resultadoClaves.insertadas} insertadas, {resultadoClaves.actualizadas} actualizadas, {resultadoClaves.omitidas} omitidas
                </div>
              )}
            </div>

            {/* Horarios Ocupación */}
            <div className="border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">📅</span>
                <h3 className="font-medium text-gray-700">Horarios</h3>
              </div>
              <p className="text-xs text-gray-500 mb-4">Ocupación de espacios — carga horarios de todas las licenciaturas</p>
              <button
                onClick={() => document.getElementById('archivoHorarios')?.click()}
                disabled={actualizandoHorarios}
                className="w-full bg-teal-600 text-white px-4 py-2.5 rounded-lg hover:bg-teal-700 disabled:opacity-50 transition text-sm font-medium"
              >
                {actualizandoHorarios ? '⏳ Procesando...' : '📤 Subir archivo'}
              </button>
              <input id="archivoHorarios" type="file" accept=".xlsx,.xls" className="hidden" onChange={handleActualizarHorarios} />
              {resultadoHorarios && (
                <div className="mt-3 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-700">
                  ✅ {resultadoHorarios.guardadas} grupos, {resultadoHorarios.parseadas} celdas parseadas
                  {resultadoHorarios.errores?.length > 0 && <div className="text-red-600 mt-1">{resultadoHorarios.errores[0]}</div>}
                </div>
              )}
            </div>

            {/* Secciones */}
            <div className="border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">🏫</span>
                <h3 className="font-medium text-gray-700">Secciones</h3>
              </div>
              <p className="text-xs text-gray-500 mb-4">CENTRO_Secciones — actualiza salones, Brightspace e inscritos de todas las licenciaturas</p>
              <button
                onClick={() => document.getElementById('archivoSecciones')?.click()}
                disabled={actualizandoSecciones}
                className="w-full bg-purple-600 text-white px-4 py-2.5 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition text-sm font-medium"
              >
                {actualizandoSecciones ? '⏳ Procesando...' : '📤 Subir archivo'}
              </button>
              <input id="archivoSecciones" type="file" accept=".xlsx,.xls" className="hidden" onChange={handleActualizarSecciones} />
              {resultadoSecciones && (
                <div className="mt-3 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-700">
                  ✅ {resultadoSecciones.insertadas} insertadas, {resultadoSecciones.actualizadas} actualizadas, {resultadoSecciones.omitidas} omitidas
                </div>
              )}
            </div>

            {/* Generar horarios desde secciones */}
            <div className="border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">🗓️</span>
                <h3 className="font-medium text-gray-700">Generar horarios</h3>
              </div>
              <p className="text-xs text-gray-500 mb-4">Lee la columna Salón de secciones y genera los horarios automáticamente</p>
              <button
                onClick={handleGenerarHorarios}
                disabled={generandoHorarios}
                className="w-full bg-emerald-600 text-white px-4 py-2.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition text-sm font-medium"
              >
                {generandoHorarios ? '⏳ Generando...' : '⚡ Generar'}
              </button>
              {resultadoGenerar && (
                <div className="mt-3 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-700">
                  ✅ {resultadoGenerar.generadas} horarios generados, {resultadoGenerar.sinSalon} sin salón
                  {resultadoGenerar.errores?.length > 0 && <div className="text-red-600 mt-1">{resultadoGenerar.errores[0]}</div>}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Estudiantes activos — Calificaciones finales */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-semibold text-gray-700 mb-1">Estudiantes activos</h2>
          <p className="text-xs text-gray-500 mb-4">
            Sube el reporte <em>CENTRO_Asistencias_Y_Calificaciones_*.xlsx</em> para actualizar el padrón y el programa de cada estudiante.
          </p>
          <label
            htmlFor="archivoEstudiantes"
            className={`inline-flex items-center gap-2 cursor-pointer bg-teal-600 text-white px-4 py-2.5 rounded-lg hover:bg-teal-700 disabled:opacity-50 transition text-sm font-medium ${actualizandoEstudiantes ? 'opacity-50 pointer-events-none' : ''}`}
          >
            {actualizandoEstudiantes ? '⏳ Procesando...' : '🎓 Subir Calificaciones finales'}
          </label>
          <input id="archivoEstudiantes" type="file" accept=".xlsx,.xls" className="hidden" onChange={handleActualizarEstudiantes} />
          {resultadoEstudiantes && (
            <div className={`mt-3 rounded-lg px-3 py-2 text-xs ${resultadoEstudiantes.error ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
              {resultadoEstudiantes.error
                ? `❌ ${resultadoEstudiantes.error}`
                : `✅ ${resultadoEstudiantes.total} estudiantes actualizados`}
            </div>
          )}
        </div>

        {/* Asistencias Core */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-semibold text-gray-700 mb-1">Asistencias y sesiones Core</h2>
          <p className="text-xs text-gray-500 mb-4">
            Sube el reporte <em>CENTRO_Asistencias_Y_Calificaciones_*.xlsx</em> para actualizar el seguimiento de sesiones por docente y asistencias por estudiante (solo Estudios Integrales).
          </p>
          <label
            htmlFor="archivoAsistencias"
            className={`inline-flex items-center gap-2 cursor-pointer bg-teal-600 text-white px-4 py-2.5 rounded-lg hover:bg-teal-700 transition text-sm font-medium ${cargandoAsistencias ? 'opacity-50 pointer-events-none' : ''}`}
          >
            {cargandoAsistencias ? '⏳ Procesando...' : '📊 Subir Asistencias Core'}
          </label>
          <input id="archivoAsistencias" type="file" accept=".xlsx,.xls" className="hidden" onChange={handleCargarAsistencias} />
          {resultadoAsistencias && (
            <div className={`mt-3 rounded-lg px-3 py-2 text-xs ${resultadoAsistencias.error ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
              {resultadoAsistencias.error
                ? `❌ ${resultadoAsistencias.error}`
                : `✅ ${resultadoAsistencias.insertados} registros cargados — corte ${resultadoAsistencias.fecha_corte}`}
            </div>
          )}
        </div>

        {/* Planes de estudio */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-semibold text-gray-700 mb-1">Planes de estudio</h2>
          <p className="text-xs text-gray-500 mb-4">
            Sube el archivo <em>Planes de estudios.xlsx</em> para actualizar el catálogo completo de asignaturas. Este archivo es la fuente de verdad para la planeación de horarios.
          </p>
          <label
            htmlFor="archivoPlan"
            className={`inline-flex items-center gap-2 cursor-pointer bg-indigo-600 text-white px-4 py-2.5 rounded-lg hover:bg-indigo-700 transition text-sm font-medium ${actualizandoPlan ? 'opacity-50 pointer-events-none' : ''}`}
          >
            {actualizandoPlan ? '⏳ Procesando...' : '📚 Subir Planes de estudio'}
          </label>
          <input id="archivoPlan" type="file" accept=".xlsx,.xls" className="hidden" onChange={handleActualizarPlan} />
          {resultadoPlan && (
            <div className={`mt-3 rounded-lg px-3 py-2 text-xs ${resultadoPlan.error ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
              {resultadoPlan.error
                ? `❌ ${resultadoPlan.error}`
                : `✅ ${resultadoPlan.insertados} asignaturas actualizadas`}
              {resultadoPlan.errores?.length > 0 && (
                <div className="mt-1 text-orange-600">{resultadoPlan.errores.length} filas con error</div>
              )}
            </div>
          )}
        </div>

        {/* Agregar docente */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="font-semibold text-gray-700 mb-4">Agregar docente</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { key: 'nombre', label: 'Nombre completo *', placeholder: 'Ej. Alejandra Gómez Aldape' },
              { key: 'id_centro', label: 'ID Centro', placeholder: 'Ej. 42543' },
              { key: 'correo_centro', label: 'Correo Centro', placeholder: 'nombre@centro.edu.mx' },
              { key: 'correo_personal', label: 'Correo personal', placeholder: '' },
              { key: 'contacto', label: 'Teléfono', placeholder: 'Ej. 5512345678' },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs text-gray-400 block mb-1">{f.label}</label>
                <input
                  type="text"
                  value={(formDocente as any)[f.key]}
                  onChange={e => setFormDocente(prev => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
            ))}
            <div>
              <label className="text-xs text-gray-400 block mb-1">Forma de pago</label>
              <select
                value={formDocente.forma_pago}
                onChange={e => setFormDocente(prev => ({ ...prev, forma_pago: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                <option>Honorarios</option>
                <option>Nómina</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleCrearDocente}
              disabled={guardandoDocente || !formDocente.nombre.trim()}
              className="bg-orange-500 text-white text-sm px-5 py-2 rounded-lg hover:bg-orange-600 disabled:opacity-50 transition font-medium"
            >
              {guardandoDocente ? 'Guardando…' : '+ Agregar docente'}
            </button>
            {okDocente && <p className="text-sm text-green-600 font-medium">{okDocente}</p>}
            {errorDocente && <p className="text-sm text-red-500">{errorDocente}</p>}
          </div>
        </div>

        {/* Usuarios */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
            <h2 className="font-semibold text-gray-700">Usuarios ({usuarios.length})</h2>
            <button onClick={() => setModal(true)} className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition">
              + Nuevo usuario
            </button>
          </div>
          {loading ? (
            <div className="p-8 text-center text-gray-400">Cargando...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                  <tr>
                    <th className="px-6 py-3 text-left">Nombre</th>
                    <th className="px-6 py-3 text-left">Email</th>
                    <th className="px-6 py-3 text-left">Rol</th>
                    <th className="px-6 py-3 text-left">Licenciatura</th>
                    <th className="px-6 py-3 text-left">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {usuarios.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-3 font-medium text-gray-800">{u.nombre}</td>
                      <td className="px-6 py-3 text-gray-600">{u.email}</td>
                      <td className="px-6 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${u.rol === 'admin' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                          {u.rol}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-gray-600">{u.licenciatura || '— Todas —'}</td>
                      <td className="px-6 py-3">
                        {u.email !== 'admin@integrales.mx' && (
                          <button onClick={() => handleEliminar(u.id, u.nombre)} className="text-red-500 hover:text-red-700 text-xs">Eliminar</button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {usuarios.length === 0 && (
                    <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">No hay usuarios</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Equipamiento de aulas */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-700 mb-1">Equipamiento de aulas</h2>
            <p className="text-xs text-gray-400">Marca las características de cada aula. Los cambios se guardan al instante.</p>
          </div>
          <div className="px-6 py-4">
            <input value={aulaSearch} onChange={e => setAulaSearch(e.target.value)}
              placeholder="Buscar aula..." className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-64 mb-4" />
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 border-b border-gray-200 sticky left-0 bg-gray-50 min-w-[120px]">Aula</th>
                    <th className="text-center px-2 py-2 text-xs font-semibold text-gray-400 border-b border-gray-200">Cap.</th>
                    {['Tarja','Blackout','Persianas'].map(e => (
                      <th key={e} className="text-center px-2 py-2 text-xs font-semibold text-blue-600 border-b border-gray-200 border-l border-blue-100">{e}</th>
                    ))}
                    {['Mesas','Paletas','Ampliadoras','Equipos','Caballetes','Butacas'].map(e => (
                      <th key={e} className="text-center px-2 py-2 text-xs font-semibold text-violet-600 border-b border-gray-200 border-l border-violet-100">{e}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {aulas.filter(a => !aulaSearch || a.nombre.toLowerCase().includes(aulaSearch.toLowerCase())).map(a => (
                    <tr key={a.id} className="hover:bg-gray-50 transition">
                      <td className="px-3 py-2 font-medium text-gray-800 sticky left-0 bg-white">
                        {a.nombre}
                        {aulaGuardando === a.id && <span className="ml-2 text-[10px] text-green-500">✓</span>}
                      </td>
                      <td className="px-2 py-2 text-center text-xs text-gray-400">{a.capacidad ?? '—'}</td>
                      {EQUIP_OPTS.map(item => (
                        <td key={item} className="px-2 py-2 text-center">
                          <input type="checkbox"
                            checked={(a.equipamiento ?? []).map(x => x.toLowerCase()).includes(item.toLowerCase())}
                            onChange={() => toggleEquip(a.id, item)}
                            className="w-4 h-4 rounded cursor-pointer accent-blue-600" />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </main>

      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-bold text-gray-800 text-lg">Nuevo usuario</h2>
              <button onClick={() => { setModal(false); setError('') }} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input type="text" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Nombre completo" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="correo@centro.edu.mx" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="••••••••" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                <select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="profesor">Profesor</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Licenciatura</label>
                <select value={form.licenciatura} onChange={(e) => setForm({ ...form, licenciatura: e.target.value })} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="">— Todas (admin) —</option>
                  {licenciaturas.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setModal(false); setError('') }} className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-lg hover:bg-gray-50 transition">Cancelar</button>
              <button onClick={handleCrear} disabled={guardando || !form.email || !form.password || !form.nombre} className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition">
                {guardando ? 'Creando...' : 'Crear usuario'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}