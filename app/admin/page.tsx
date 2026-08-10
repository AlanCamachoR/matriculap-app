'use client'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

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

  const licenciaturas = [
    'Arquitectura',
    'Arquitectura de Interiores',
    'Cine y Televisión',
    'Comunicación Visual',
    'Computación Creativa',
    'Diseño Industrial',
    'Diseño Textil y Moda',
    'Mercadotecnia y Publicidad',
    'Negocios e Industrias Creativas',
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
      const res = await fetch('/api/actualizar-matricula', {
        method: 'POST',
        body: formData
      })
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
      // Reset input
      const input = document.getElementById('archivoMatricula') as HTMLInputElement
      if (input) input.value = ''
    }
  }

  if (status === 'loading') return <div className="min-h-screen flex items-center justify-center">Cargando...</div>

  const user = session?.user as any

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <a href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">← Dashboard</a>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Panel de Administrador</h1>
              <p className="text-sm text-gray-500">Gestión de usuarios y matrícula</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.name}</span>
            <button onClick={() => signOut({ callbackUrl: '/login' })} className="text-sm text-red-500 hover:text-red-700">Cerrar sesión</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* Actualizar Matrícula */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-semibold text-gray-700 mb-2">Actualizar Matrícula</h2>
          <p className="text-sm text-gray-500 mb-4">Sube el archivo de Calificaciones Finales de Core para actualizar estudiantes e inscripciones.</p>
          <div className="flex items-center gap-4">
            <button
              onClick={() => document.getElementById('archivoMatricula')?.click()}
              disabled={actualizando}
              className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition text-sm font-medium"
            >
              {actualizando ? '⏳ Procesando...' : '📤 Subir Excel de Matrícula'}
            </button>
            <input
              id="archivoMatricula"
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleActualizarMatricula}
            />
            {resultadoActualizacion && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-sm text-green-700">
                ✅ Actualización completada — 
                <span className="font-medium"> {resultadoActualizacion.estudiantesActualizados} estudiantes</span> y 
                <span className="font-medium"> {resultadoActualizacion.matriculasActualizadas} matrículas</span> actualizadas
              </div>
            )}
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
                          <button onClick={() => handleEliminar(u.id, u.nombre)} className="text-red-500 hover:text-red-700 text-xs">
                            Eliminar
                          </button>
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
      </main>

      {/* Modal crear usuario */}
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