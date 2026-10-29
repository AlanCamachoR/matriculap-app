'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase-browser'
import HorarioGrid, { type Clase, COLORES } from '../_components/HorarioGrid'

const PROGRAMAS: Record<string, string> = {
  'Estudios Integrales': 'EI',
  'Arquitectura': 'AR',
  'Arquitectura de Interiores': 'AI',
  'Cine y Televisión': 'CT',
  'Comunicación Visual': 'CV',
  'Computación Creativa': 'CC',
  'Diseño Industrial': 'DI',
  'Diseño Textil y Moda': 'TM',
  'Mercadotecnia y Publicidad': 'MP',
  'Negocios e Industrias Creativas': 'NI',
}

export default function HorariosMateriaPage() {
  const [todas, setTodas] = useState<Clase[]>([])
  const [claveLic, setClaveLic] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  const [programa, setPrograma] = useState('')
  const [materia, setMateria] = useState('')
  const [seleccionada, setSeleccionada] = useState<Clase | null>(null)

  useEffect(() => {
    Promise.all([
      supabase.from('horario_semestre').select('*'),
      supabase.from('claves').select('clave, licenciatura'),
    ]).then(([h, c]) => {
      setTodas((h.data as Clase[]) || [])
      const map: Record<string, string> = {}
      for (const r of c.data || []) map[r.clave] = r.licenciatura
      setClaveLic(map)
      setLoading(false)
    })
  }, [])

  function getLicenciatura(c: any): string {
    if (c.licenciatura) return c.licenciatura
    if (claveLic[c.clave]) return claveLic[c.clave]
    return Object.entries(PROGRAMAS).find(([, v]) => c.clave.startsWith(v))?.[0] || 'Otro'
  }

  const programasDisponibles = useMemo(() => {
    const set = new Set<string>()
    for (const c of todas) set.add(getLicenciatura(c))
    return [...set].sort()
  }, [todas, claveLic])

  const clasesFiltPrograma = useMemo(
    () => programa ? todas.filter(c => getLicenciatura(c) === programa) : todas,
    [todas, programa, claveLic]
  )

  const materiasDisponibles = useMemo(() => {
    const map = new Map<string, string>() // nombre → clave base
    for (const c of clasesFiltPrograma) if (c.asignatura) map.set(c.asignatura, c.clave)
    return [...map.keys()].sort()
  }, [clasesFiltPrograma])

  const clasesFiltradas = useMemo(
    () => materia ? clasesFiltPrograma.filter(c => c.asignatura === materia) : [],
    [clasesFiltPrograma, materia]
  )

  // Estadísticas por grupo
  const grupos = useMemo(() => {
    const map = new Map<string, { clave: string; docente: string; inscritos: number; aula: string }>()
    for (const c of clasesFiltradas) {
      const key = (c as any).grupo ? `Grupo ${(c as any).grupo}` : c.clave
      if (!map.has(key)) map.set(key, { clave: c.clave, docente: c.docente, inscritos: c.inscritos, aula: c.aula_texto })
    }
    return [...map.entries()]
  }, [clasesFiltradas])

  function handlePrograma(val: string) {
    setPrograma(val); setMateria(''); setSeleccionada(null)
  }
  function handleMateria(val: string) {
    setMateria(val); setSeleccionada(null)
  }

  return (
    <div>
      {/* Filtros */}
      <div className="flex gap-3 flex-wrap items-end mb-5">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 font-medium">Programa</label>
          <select
            value={programa}
            onChange={e => handlePrograma(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Todos los programas</option>
            {programasDisponibles.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 font-medium">Materia</label>
          <select
            value={materia}
            onChange={e => handleMateria(e.target.value)}
            disabled={materiasDisponibles.length === 0}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:opacity-50"
          >
            <option value="">Selecciona una materia</option>
            {materiasDisponibles.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {(programa || materia) && (
          <div className="flex flex-col gap-1">
            <label className="text-xs invisible">·</label>
            <button
              onClick={() => { setPrograma(''); setMateria(''); setSeleccionada(null) }}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50"
            >
              Limpiar
            </button>
          </div>
        )}

        {loading && <div className="text-sm text-gray-400 pb-2">Cargando...</div>}
      </div>

      {!materia ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-400">
          <p className="text-3xl mb-3">📚</p>
          <p>Selecciona una materia para ver cómo están distribuidos sus grupos</p>
        </div>
      ) : (
        <>
          {/* Resumen de grupos */}
          {grupos.length > 0 && (
            <div className="flex flex-wrap gap-3 mb-4">
              {grupos.map(([label, info], i) => (
                <div
                  key={label}
                  className="flex items-center gap-2 bg-white rounded-lg shadow-sm px-3 py-2 text-sm border border-gray-100"
                >
                  <div
                    className="w-3 h-3 rounded-sm flex-shrink-0"
                    style={{ background: COLORES[i % COLORES.length].bg }}
                  />
                  <span className="font-semibold text-gray-700">{label}</span>
                  <span className="text-gray-400 text-xs font-mono">{info.clave}</span>
                  <span className="text-gray-500 text-xs">· {info.docente || '—'}</span>
                  <span className="text-gray-400 text-xs">· {info.inscritos} est.</span>
                  <span className="text-gray-400 text-xs">· {info.aula}</span>
                </div>
              ))}
            </div>
          )}

          <HorarioGrid
            clases={clasesFiltradas}
            colorKey="clave"
            seleccionada={seleccionada}
            onSelect={setSeleccionada}
          />
        </>
      )}
    </div>
  )
}
