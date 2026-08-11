'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']

const SLOTS: string[] = []
for (let h = 7; h < 22; h++) {
  SLOTS.push(`${String(h).padStart(2, '0')}:00`)
  SLOTS.push(`${String(h).padStart(2, '0')}:30`)
}

const COLORES = [
  { bg: '#B5D4F4', tx: '#0C447C' },
  { bg: '#9FE1CB', tx: '#085041' },
  { bg: '#FAC775', tx: '#633806' },
  { bg: '#F5C4B3', tx: '#712B13' },
  { bg: '#C0DD97', tx: '#27500A' },
  { bg: '#F4C0D1', tx: '#72243E' },
  { bg: '#CDD0F4', tx: '#26215C' },
  { bg: '#E1C0F4', tx: '#5A2689' },
  { bg: '#C0EDF4', tx: '#085060' },
  { bg: '#FAE0A0', tx: '#7A5000' },
]

function toMin(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function slotIdx(t: string) {
  return (toMin(t) - 7 * 60) / 30
}

interface Clase {
  id: string
  clave: string
  asignatura: string
  docente: string
  inscritos: number
  dia: string
  hora_inicio: string
  hora_fin: string
  aula_texto: string
  dia2?: string
  hora_inicio2?: string
  hora_fin2?: string
  aula_texto2?: string
}

interface CeldaGrid {
  clase: Clase
  aula: string
  isFirst: boolean
  span: number
}

export default function HorariosGrupoPage() {
  const [semestre, setSemestre] = useState('1°')
  const [grupo, setGrupo] = useState(1)
  const [clases, setClases] = useState<Clase[]>([])
  const [loading, setLoading] = useState(false)
  const [seleccionada, setSeleccionada] = useState<Clase | null>(null)
  const [aulaSeleccionada, setAulaSeleccionada] = useState('')

  const semestres = ['1°', '2°', '3°', '4°', '5°', '6°']
  const grupos = Array.from({ length: 14 }, (_, i) => i + 1)

  useEffect(() => {
    fetchClases()
  }, [semestre, grupo])

  async function fetchClases() {
    setLoading(true)
    setSeleccionada(null)
    const { data, error } = await supabase
      .from('horario_semestre')
      .select('*')
      .eq('semestre', semestre)
      .eq('grupo', grupo)
      .order('dia')
    if (!error && data) setClases(data)
    setLoading(false)
  }

  const asignaturas = [...new Set(clases.map(c => c.asignatura))]
  const colorMap: Record<string, { bg: string; tx: string }> = {}
  asignaturas.forEach((a, i) => { colorMap[a] = COLORES[i % COLORES.length] })

  function buildGrid() {
    const grid: (CeldaGrid | null)[][] = Array.from(
      { length: SLOTS.length },
      () => Array(5).fill(null)
    )
    const DIAS_KEY: Record<string, number> = {
      Lunes: 0, Martes: 1, 'Miércoles': 2, Jueves: 3, Viernes: 4
    }
    function colocar(clase: Clase, dia: string, h1: string, h2: string, aula: string) {
      const di = DIAS_KEY[dia]
      if (di === undefined) return
      const si = slotIdx(h1)
      const ei = slotIdx(h2)
      if (si < 0 || si >= SLOTS.length) return
      for (let i = si; i < ei && i < SLOTS.length; i++) {
        if (!grid[i][di]) {
          grid[i][di] = { clase, aula, isFirst: i === si, span: ei - si }
        }
      }
    }
    clases.forEach(c => {
      if (c.dia && c.hora_inicio && c.hora_fin) {
        colocar(c, c.dia, c.hora_inicio, c.hora_fin, c.aula_texto)
      }
      if (c.dia2 && c.hora_inicio2 && c.hora_fin2) {
        colocar(c, c.dia2, c.hora_inicio2, c.hora_fin2, c.aula_texto2 || c.aula_texto)
      }
    })
    return grid
  }

  const grid = buildGrid()

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">Horario por grupo</h1>

      <div className="flex gap-4 items-center flex-wrap mb-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">Semestre</label>
          <select
            value={semestre}
            onChange={e => setSemestre(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          >
            {semestres.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">Grupo</label>
          <select
            value={grupo}
            onChange={e => setGrupo(Number(e.target.value))}
            className="border rounded px-2 py-1 text-sm"
          >
            {grupos.map(g => <option key={g} value={g}>Grupo {g}</option>)}
          </select>
        </div>
        {loading && <span className="text-sm text-gray-400">Cargando...</span>}
      </div>

      {asignaturas.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {asignaturas.map(a => (
            <div key={a} className="flex items-center gap-1 text-xs">
              <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: colorMap[a]?.bg }} />
              <span className="text-gray-600">{a}</span>
            </div>
          ))}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="border-collapse w-full min-w-[600px]" style={{ tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th className="w-20 text-xs text-gray-400 font-normal text-right pr-2 pb-2">Horario</th>
              {DIAS.map(d => (
                <th key={d} className="text-xs text-gray-500 font-medium text-center pb-2 border-b">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SLOTS.map((slot, ri) => (
              <tr key={slot}>
                <td className="text-right pr-2 align-top" style={{ fontSize: 10, color: '#aaa', paddingTop: 3 }}>
                  {slot.endsWith(':00') ? slot : ''}
                </td>
                {DIAS.map((_, di) => {
                  const celda = grid[ri][di]
                  return (
                    <td
                      key={di}
                      className="relative border-l"
                      style={{
                        height: 22,
                        borderTop: slot.endsWith(':00') ? '1px solid #e5e7eb' : '1px solid #f3f4f6',
                        verticalAlign: 'top',
                        padding: 0,
                      }}
                    >
                      {celda?.isFirst && (
                        <div
                          onClick={() => {
                            setSeleccionada(celda.clase)
                            setAulaSeleccionada(celda.aula)
                          }}
                          className="absolute rounded cursor-pointer overflow-hidden"
                          style={{
                            background: colorMap[celda.clase.asignatura]?.bg,
                            height: celda.span * 22 - 2,
                            top: 1, left: 1, right: 1,
                            padding: '2px 4px',
                            zIndex: 1,
                          }}
                        >
                          <div style={{ color: colorMap[celda.clase.asignatura]?.tx, fontSize: 9, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {celda.clase.asignatura}
                          </div>
                          <div style={{ color: colorMap[celda.clase.asignatura]?.tx, fontSize: 8, opacity: 0.8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {celda.aula}
                          </div>
                          {celda.span >= 4 && (
                            <div style={{ color: colorMap[celda.clase.asignatura]?.tx, fontSize: 8, opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {celda.clase.docente}
                            </div>
                          )}
                          {celda.span >= 6 && (
                            <div style={{ color: colorMap[celda.clase.asignatura]?.tx, fontSize: 8, opacity: 0.6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {celda.clase.clave}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 p-3 bg-gray-50 rounded text-sm text-gray-600 min-h-[48px]">
        {seleccionada ? (
          <div className="flex flex-col gap-1">
            <div>
              <strong>{seleccionada.asignatura}</strong>
              <span className="ml-2 text-gray-400 text-xs">{seleccionada.clave}</span>
            </div>
            <div className="text-gray-500 text-xs">
              {aulaSeleccionada} — {seleccionada.docente} — {seleccionada.inscritos} estudiantes
            </div>
          </div>
        ) : (
          <span className="text-gray-400">
            {clases.length === 0 && !loading
              ? 'Sin clases registradas para este grupo.'
              : 'Haz clic en una clase para ver el detalle.'}
          </span>
        )}
      </div>
    </div>
  )
}