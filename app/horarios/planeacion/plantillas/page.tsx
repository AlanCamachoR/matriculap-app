'use client'

import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'

interface ClaseSlot {
  grupo_num: number
  num_sesiones: number | null
  asignatura_id: number
  pg_id: number | null
  clave_base: string
  materia: string
  semestre: string
  horas_sesiones: number[] | null
  inscritos_estimados: number | null
  dia: string | null
  hora_inicio: string | null
  hora_fin: string | null
  aula_nombre: string | null
  dia2: string | null
  hora_inicio2: string | null
  hora_fin2: string | null
  aula_nombre2: string | null
  docente_nombre: string | null
  licenciatura: string | null
}

interface DragItem {
  claveBase: string
  materia: string
  grupoNum: number
  asignaturaId: number
  pgId: number | null
  sesion: 1 | 2
  duracionSlots: number
  color: typeof PALETTE[0]
  fromGrid: boolean  // true = ya estaba colocado, soltar en leyenda lo desasigna
}

const DIAS     = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']
const DIAS_ABR = ['LUN',   'MAR',    'MIE',       'JUE',   'VIE']
const SLOTS: string[] = Array.from({ length: 31 }, (_, i) => {
  const mins = 7 * 60 + i * 30
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
})

// Color fijo por licenciatura
const LIC_PALETTE: Record<string, { bg: string; border: string; text: string }> = {
  AI:  { bg: '#FFFF00', border: '#C6B800', text: '#3E2700' }, // Amarillo
  ARQ: { bg: '#A2C4C9', border: '#6A9DA4', text: '#1A3D41' }, // Verde agua
  MP:  { bg: '#FF00FF', border: '#BB00BB', text: '#3D003D' }, // Magenta
  CV:  { bg: '#93C47D', border: '#5E9B3A', text: '#1B3D0A' }, // Verde
  CT:  { bg: '#B4A7D6', border: '#7B68B0', text: '#2D1F6E' }, // Lila/morado
  DTM: { bg: '#EA9999', border: '#C0504D', text: '#5A0A07' }, // Salmón/rojo suave
  EI:  { bg: '#CFE2F3', border: '#7EADD4', text: '#0D3A6E' }, // Azul claro
  DI:  { bg: '#D9D9D9', border: '#999999', text: '#1F1F1F' }, // Gris
  CC:  { bg: '#F6B26B', border: '#D47F2A', text: '#4E2000' }, // Naranja
  NC:  { bg: '#C5CAE9', border: '#5C6BC0', text: '#1A237E' }, // Índigo
  POSG:{ bg: '#FFF9C4', border: '#F9A825', text: '#3E2700' }, // Dorado
}
const DEFAULT_COLOR = { bg: '#F9FAFB', border: '#D1D5DB', text: '#374151' }

const PALETTE = Object.values(LIC_PALETTE)

const LICS = ['ARQ','CC','MP','CV','DI','AI','DTM','CT','EI']
const SEMS = ['1°','2°','3°','4°','5°','6°','7°','8°','9°','10°']

function slotIdx(time: string | null): number {
  if (!time) return -1
  const [h, m] = time.split(':').map(Number)
  return Math.round((h * 60 + m - 7 * 60) / 30)
}

function duracionDeHoras(horas_sesiones: number[] | null, sesion: 1 | 2): number {
  if (!horas_sesiones) return 3
  const h = horas_sesiones[sesion - 1] ?? horas_sesiones[0] ?? 1.5
  return Math.max(1, Math.round(h * 2))
}

// ── Block metadata (includes drag source info) ───────────────────────────────
interface Block {
  materia: string
  aula: string | null
  inscritos: number | null
  docente: string | null
  span: number
  color: typeof PALETTE[0]
  claveBase: string
  grupoNum: number
  asignaturaId: number
  pgId: number | null
  numSesiones: number
  sesion: 1 | 2
}

const GROUP_COLORS = [
  { bg: '#DBEAFE', border: '#3B82F6', text: '#1E3A5F' },
  { bg: '#FEE2E2', border: '#EF4444', text: '#5F1E1E' },
  { bg: '#D1FAE5', border: '#10B981', text: '#1E5F42' },
  { bg: '#FEF3C7', border: '#F59E0B', text: '#5F4A1E' },
  { bg: '#EDE9FE', border: '#8B5CF6', text: '#3D1E5F' },
  { bg: '#FDF2F8', border: '#EC4899', text: '#5F1E4A' },
  { bg: '#F0FDF4', border: '#22C55E', text: '#1A4D2E' },
  { bg: '#FFF7ED', border: '#F97316', text: '#7C2D12' },
]

// ── Vista Materia: calendario único combinado ──────────────────────────────────
function MateriaReadGrid({ grupos, gruposVisibles, filtMateria }: {
  grupos: [number, ClaseSlot[]][]
  gruposVisibles: Set<number> | null
  filtMateria: string
}) {
  const SH = 22
  type DayBlock = { grupoNum: number; startSlot: number; endSlot: number; color: typeof GROUP_COLORS[0]; sesion: 1 | 2 }
  const dayBlocks: DayBlock[][] = [[], [], [], [], []]

  const visibleGrupos = grupos.filter(([gn]) => gruposVisibles === null || gruposVisibles.has(gn))

  visibleGrupos.forEach(([gn, gc], gi) => {
    const color = GROUP_COLORS[gi % GROUP_COLORS.length]
    gc.filter(c => c.clave_base === filtMateria).forEach(c => {
      const ns = c.num_sesiones ?? 1
      const push = (dia: string | null, hi: string | null, hf: string | null, sesion: 1 | 2) => {
        if (!dia || !hi) return
        const d = DIAS.indexOf(dia)
        if (d < 0) return
        const start = slotIdx(hi)
        const storedSpan = hf ? slotIdx(hf) - start : 0
        const configSpan = c.horas_sesiones ? duracionDeHoras(c.horas_sesiones, sesion) : 0
        const span = configSpan > 0 ? configSpan : (storedSpan > 0 ? storedSpan : 3)
        if (start < 0 || span <= 0) return
        dayBlocks[d].push({ grupoNum: gn, startSlot: start, endSlot: start + span, color, sesion })
      }
      push(c.dia, c.hora_inicio, c.hora_fin, 1)
      if (ns >= 2) push(c.dia2, c.hora_inicio2, c.hora_fin2, 2)
    })
  })

  const allBlocks = dayBlocks.flat()
  if (allBlocks.length === 0) return (
    <div className="text-center py-8 text-gray-400 text-sm">Sin clases asignadas para esta materia en los grupos visibles.</div>
  )

  const minSlot = Math.max(0, Math.min(...allBlocks.map(b => b.startSlot)) - 1)
  const maxSlot = Math.min(SLOTS.length, Math.max(...allBlocks.map(b => b.endSlot)) + 1)
  const visSlots = SLOTS.slice(minSlot, maxSlot)
  const totalH = visSlots.length * SH

  const dayAssignments = dayBlocks.map(dbs => {
    const sorted = [...dbs].sort((a, b) => a.startSlot - b.startSlot)
    const endPerCol: number[] = []
    const result: { block: DayBlock; col: number; totalCols: number }[] = []
    sorted.forEach(block => {
      let ci = endPerCol.findIndex(end => end <= block.startSlot)
      if (ci < 0) { ci = endPerCol.length; endPerCol.push(0) }
      endPerCol[ci] = block.endSlot
      result.push({ block, col: ci, totalCols: 0 })
    })
    result.forEach(a => {
      const nCols = result.filter(b =>
        b.block.startSlot < a.block.endSlot && b.block.endSlot > a.block.startSlot
      ).reduce((m, b) => Math.max(m, b.col + 1), 1)
      a.totalCols = nCols
    })
    return result
  })

  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse" style={{ minWidth: 480 }}>
        <thead>
          <tr>
            <th className="w-12" />
            {DIAS_ABR.map(d => (
              <th key={d} className="text-center py-1 font-semibold text-gray-600 border-b border-gray-200 text-xs" style={{ width: '18%' }}>{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ verticalAlign: 'top', padding: 0 }}>
              {visSlots.map(slot => (
                <div key={slot} style={{ height: SH, fontSize: 8, color: '#9ca3af', lineHeight: `${SH}px`, textAlign: 'right', paddingRight: 4 }}>
                  {slot.endsWith(':00') ? slot : ''}
                </div>
              ))}
            </td>
            {DIAS.map((_, di) => (
              <td key={di} className="border-l border-gray-200 relative" style={{ height: totalH, verticalAlign: 'top', padding: 0 }}>
                {visSlots.map((slot, i) => (
                  <div key={slot} style={{
                    position: 'absolute', left: 0, right: 0, top: i * SH, height: 1,
                    background: slot.endsWith(':00') ? '#e5e7eb' : '#f3f4f6',
                  }} />
                ))}
                {dayAssignments[di].map(({ block, col, totalCols }, bi) => {
                  const top = (block.startSlot - minSlot) * SH + 1
                  const height = (block.endSlot - block.startSlot) * SH - 2
                  const w = totalCols > 0 ? 100 / totalCols : 100
                  return (
                    <div key={bi} style={{
                      position: 'absolute', top, height,
                      left: `calc(${col * w}% + 1px)`,
                      width: `calc(${w}% - 2px)`,
                      background: block.color.bg,
                      border: `1px solid ${block.color.border}`,
                      borderRadius: 4,
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center',
                      overflow: 'hidden', padding: '2px 3px',
                    }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: block.color.text }}>G{block.grupoNum}</span>
                      {height > 30 && <span style={{ fontSize: 8, color: block.color.text, opacity: 0.75 }}>C{block.sesion} · {SLOTS[block.startSlot]}–{SLOTS[Math.min(block.endSlot, SLOTS.length - 1)]}</span>}
                    </div>
                  )
                })}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ── Schedule Grid ─────────────────────────────────────────────────────────────
function ScheduleGrid({
  clases, colorMap, grupoNum, dragItemRef, onDrop, onClear,
}: {
  clases: ClaseSlot[]
  colorMap: Map<string, typeof PALETTE[0]>
  grupoNum: number
  dragItemRef: React.MutableRefObject<DragItem | null>
  onDrop: (dayIdx: number, slotIdx: number) => void
  onClear: (asignaturaId: number, sesion: 1 | 2) => void
}) {
  const [hover, setHover] = useState<{ d: number; s: number } | null>(null)
  // track which block key is being dragged from this grid (to show placeholder)
  const [draggingKey, setDraggingKey] = useState<string | null>(null)

  const blocks = new Map<string, Block>()
  const skip = new Set<string>()

  const addBlock = (
    dia: string | null, hi: string | null, hf: string | null,
    aula: string | null, materia: string, clave: string,
    asignaturaId: number, pgId: number | null, sesion: 1 | 2,
    inscritos: number | null, docente: string | null,
    horasSesiones: number[] | null, numSesiones: number,
  ) => {
    if (!dia || !hi) return
    const d = DIAS.indexOf(dia)
    if (d < 0) return
    const s = slotIdx(hi)
    if (s < 0 || s >= SLOTS.length) return
    const storedSpan = hf ? slotIdx(hf) - s : 0
    // horas_sesiones is the source of truth for duration; hora_fin is a fallback
    const configSpan = horasSesiones ? duracionDeHoras(horasSesiones, sesion) : 0
    const span = Math.min(configSpan > 0 ? configSpan : (storedSpan > 0 ? storedSpan : 3), SLOTS.length - s)
    if (span <= 0) return
    blocks.set(`${d}-${s}`, {
      materia, aula, inscritos, docente, span,
      color: colorMap.get(clave) ?? PALETTE[0],
      claveBase: clave, grupoNum, asignaturaId, pgId, sesion, numSesiones,
    })
    for (let r = s + 1; r < s + span; r++) skip.add(`${d}-${r}`)
  }

  clases.forEach(c => {
    const ns = c.num_sesiones ?? 1
    addBlock(c.dia, c.hora_inicio, c.hora_fin, c.aula_nombre, c.materia, c.clave_base, c.asignatura_id, c.pg_id, 1, c.inscritos_estimados, c.docente_nombre, c.horas_sesiones, ns)
    if (ns >= 2)
      addBlock(c.dia2, c.hora_inicio2, c.hora_fin2, c.aula_nombre2, c.materia, c.clave_base, c.asignatura_id, c.pg_id, 2, c.inscritos_estimados, c.docente_nombre, c.horas_sesiones, ns)
  })

  const item = dragItemRef.current
  const previewSet = new Set<string>()
  if (item && hover) {
    for (let r = 0; r < item.duracionSlots; r++) {
      const s = hover.s + r
      if (s < SLOTS.length) previewSet.add(`${hover.d}-${s}`)
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            <th className="py-1 text-[9px] font-bold text-white bg-gray-800 border border-gray-600 text-center" style={{ width: '14%' }}>HR</th>
            {DIAS_ABR.map(d => (
              <th key={d} className="py-1 text-[9px] font-bold text-white bg-gray-800 border border-gray-600 text-center" style={{ width: '17.2%' }}>
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SLOTS.map((slot, si) => (
            <tr key={slot}>
              <td className="py-0 text-[8px] text-gray-500 border border-gray-200 text-center bg-gray-50 h-5">
                {slot}
              </td>
              {DIAS.map((_, di) => {
                const key = `${di}-${si}`
                if (skip.has(key)) return null

                const b = blocks.get(key)
                if (b) {
                  const isDraggingThis = draggingKey === key
                  return (
                    <td key={di} rowSpan={b.span}
                      draggable
                      onDragStart={() => {
                        setDraggingKey(key)
                        dragItemRef.current = {
                          claveBase: b.claveBase,
                          materia: b.materia,
                          grupoNum,
                          asignaturaId: b.asignaturaId,
                          pgId: b.pgId,
                          sesion: b.sesion,
                          duracionSlots: b.span,
                          color: b.color,
                          fromGrid: true,
                        }
                      }}
                      onDragEnd={() => { setDraggingKey(null); dragItemRef.current = null }}
                      className="p-1 cursor-grab active:cursor-grabbing transition-opacity relative"
                      style={{
                        background: b.color.bg,
                        outline: `1px solid ${b.color.border}66`,
                        outlineOffset: '-1px',
                        opacity: isDraggingThis ? 0.35 : 1,
                        verticalAlign: 'middle',
                      }}
                    >
                      <button
                        onMouseDown={e => e.stopPropagation()}
                        onClick={e => { e.stopPropagation(); onClear(b.asignaturaId, b.sesion) }}
                        className="absolute top-0.5 right-0.5 w-4 h-4 flex items-center justify-center rounded-full text-[9px] leading-none opacity-0 hover:opacity-100 transition-opacity z-10"
                        style={{ background: b.color.border + 'aa', color: '#fff' }}
                        title="Quitar del horario"
                      >×</button>
                      {/fotografí?a\s*I\b/i.test(b.materia) && b.span >= 4 ? (
                        // Fotografía I: split single 4h block into Teoría (top) + Lab (bottom)
                        <div className="flex flex-col h-full" style={{ color: b.color.text }}>
                          {['Teoría', 'Lab'].map((label, li) => (
                            <div key={label} className="flex-1 flex flex-col items-center justify-center text-center gap-0.5 py-0.5"
                              style={{ borderBottom: li === 0 ? `1px solid ${b.color.border}66` : undefined }}>
                              <span className="font-bold text-[10px] leading-tight">{b.materia}</span>
                              <span className="text-[9px] font-mono opacity-80">{b.claveBase}-{b.grupoNum}</span>
                              <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full"
                                style={{ background: b.color.border + (li === 0 ? '55' : '99') }}>
                                {label}
                              </span>
                              {li === 0 && b.aula && <span className="text-[9px] opacity-75">{b.aula}</span>}
                              {li === 0 && b.docente && <span className="text-[8px] opacity-65 leading-tight">{b.docente}</span>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center text-center h-full gap-0.5" style={{ color: b.color.text }}>
                          <span className="font-bold text-[10px] leading-tight">{b.materia}</span>
                          <span className="text-[9px] font-mono opacity-80">{b.claveBase}-{b.grupoNum}</span>
                          {b.inscritos != null && <span className="text-[9px] font-semibold opacity-90">{b.inscritos} est.</span>}
                          {b.aula && <span className="text-[9px] opacity-75">{b.aula}</span>}
                          {b.docente && <span className="text-[8px] opacity-65 leading-tight">{b.docente}</span>}
                        </div>
                      )}
                    </td>
                  )
                }

                const isPreview = previewSet.has(key)
                return (
                  <td key={di}
                    className="border border-gray-200 h-5 transition-colors"
                    style={{
                      background: isPreview ? (item?.color.bg ?? '#e0e7ff') : si % 2 === 0 ? '#fff' : '#f9fafb',
                      borderColor: isPreview ? (item?.color.border ?? '#a5b4fc') : undefined,
                      cursor: dragItemRef.current ? 'copy' : 'default',
                    }}
                    onDragOver={e => { if (!dragItemRef.current) return; e.preventDefault(); setHover({ d: di, s: si }) }}
                    onDragLeave={() => setHover(null)}
                    onDrop={e => { e.preventDefault(); setHover(null); onDrop(di, si) }}
                  />
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function PlantillasPage() {
  const { data: session } = useSession()
  const userRol = (session?.user as any)?.rol as string | undefined
  const userLic = (session?.user as any)?.licenciatura as string | null | undefined

  const [clases, setClases] = useState<ClaseSlot[]>([])
  const [loading, setLoading] = useState(false)
  const [filtLic, setFiltLic] = useState('EI')
  const [filtSem, setFiltSem] = useState('1°')
  const [saving, setSaving] = useState(false)
  const [legendOver, setLegendOver] = useState<number | null>(null) // grupoNum hovering over legend
  const [error, setError] = useState<string | null>(null)
  const [gruposVisibles, setGruposVisibles] = useState<Set<number> | null>(null) // null = todos
  const [showGruposPicker, setShowGruposPicker] = useState(false)
  const gruposPickerRef = useRef<HTMLDivElement>(null)
  const [copySource, setCopySource] = useState<number | null>(null) // grupoNum being copied from
  const [copyingTo, setCopyingTo] = useState<number | null>(null)  // grupoNum being pasted to
  const [showDispersion, setShowDispersion] = useState(false)
  const [showMateria, setShowMateria] = useState(false)
  const [filtMateria, setFiltMateria] = useState('')
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  // Undo/redo stacks
  type Snapshot = { clases: ClaseSlot[]; pending: Map<string, Record<string, unknown>> }
  const undoStack = useRef<Snapshot[]>([])
  const redoStack = useRef<Snapshot[]>([])
  const pendingRef = useRef<Map<string, Record<string, unknown>>>(new Map())

  // Lock coord to their licenciatura
  useEffect(() => {
    if (userRol === 'coord' && userLic) setFiltLic(userLic)
  }, [userRol, userLic])

  useEffect(() => {
    if (!showGruposPicker) return
    const h = (e: MouseEvent) => {
      if (gruposPickerRef.current && !gruposPickerRef.current.contains(e.target as Node))
        setShowGruposPicker(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [showGruposPicker])

  // Cambios pendientes: pgKey → { body }
  const [pending, setPending] = useState<Map<string, Record<string, unknown>>>(new Map())

  const dragItemRef = useRef<DragItem | null>(null)
  const pgIds = useRef<Record<string, number>>({})
  const clasesRef = useRef<ClaseSlot[]>(clases)

  // Keep pendingRef in sync for undo — must come after [pending] state declaration
  useEffect(() => { pendingRef.current = pending }, [pending])

  // Undo/redo helpers — use a ref so they're callable from zero-dep callbacks
  const pushUndoRef = useRef<() => void>(() => {})
  pushUndoRef.current = () => {
    undoStack.current.push({ clases: [...clasesRef.current], pending: new Map(pendingRef.current) })
    redoStack.current = []
    setCanUndo(true)
    setCanRedo(false)
  }

  function undo() {
    const snap = undoStack.current.pop()
    if (!snap) return
    redoStack.current.push({ clases: [...clasesRef.current], pending: new Map(pendingRef.current) })
    setClases(snap.clases)
    setPending(snap.pending)
    setCanUndo(undoStack.current.length > 0)
    setCanRedo(true)
  }

  function redo() {
    const snap = redoStack.current.pop()
    if (!snap) return
    undoStack.current.push({ clases: [...clasesRef.current], pending: new Map(pendingRef.current) })
    setClases(snap.clases)
    setPending(snap.pending)
    setCanUndo(true)
    setCanRedo(redoStack.current.length > 0)
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    setGruposVisibles(null)
  }, [filtLic, filtSem])

  useEffect(() => {
    if (!filtLic || !filtSem) { setClases([]); return }
    setLoading(true)
    fetch(`/api/plan-grupos/plantilla?periodo=2027-2&licenciatura=${encodeURIComponent(filtLic)}&semestre=${encodeURIComponent(filtSem)}`)
      .then(r => r.json())
      .then(j => {
        const data: ClaseSlot[] = j.data ?? []
        setClases(data)
        pgIds.current = {}
        data.forEach(c => { if (c.pg_id) pgIds.current[`${c.asignatura_id}-${c.grupo_num}`] = c.pg_id })
        setLoading(false)
      })
  }, [filtLic, filtSem, reloadKey])

  const colorMap = useMemo(() => {
    const map = new Map<string, typeof DEFAULT_COLOR>()
    clases.forEach(c => {
      if (!map.has(c.clave_base)) {
        map.set(c.clave_base, LIC_PALETTE[c.licenciatura ?? ''] ?? DEFAULT_COLOR)
      }
    })
    return map
  }, [clases])

  const grupos = useMemo(() => {
    const map = new Map<number, ClaseSlot[]>()
    clases.forEach(c => {
      if (!map.has(c.grupo_num)) map.set(c.grupo_num, [])
      map.get(c.grupo_num)!.push(c)
    })
    return [...map.entries()].sort((a, b) => a[0] - b[0])
  }, [clases])

  // Keep ref in sync with state so callbacks always see current clases
  clasesRef.current = clases

  // Detección de conflictos dentro del mismo grupo
  function checkConflict(item: DragItem, grupoNum: number, newDia: string, newHI: string, newHF: string): string | null {
    const tMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
    // Compute effective end time using horas_sesiones (matches visual span), fall back to hora_fin
    const effectiveEnd = (hi: string, hf: string | null, horasSesiones: number[] | null, sesion: 1 | 2) => {
      if (horasSesiones) {
        const si = slotIdx(hi)
        const effSpan = duracionDeHoras(horasSesiones, sesion)
        const effSlot = Math.min(si + effSpan, SLOTS.length - 1)
        return tMin(SLOTS[effSlot])
      }
      return hf ? tMin(hf) : tMin(hi) + 90
    }
    const ns = tMin(newHI), ne = tMin(newHF)
    for (const c of clasesRef.current) {
      if (c.grupo_num !== grupoNum || c.asignatura_id === item.asignaturaId) continue
      if (c.dia === newDia && c.hora_inicio) {
        const ce = effectiveEnd(c.hora_inicio, c.hora_fin, c.horas_sesiones, 1)
        if (ns < ce && ne > tMin(c.hora_inicio)) return c.materia
      }
      if (c.dia2 === newDia && c.hora_inicio2) {
        const ce = effectiveEnd(c.hora_inicio2, c.hora_fin2, c.horas_sesiones, 2)
        if (ns < ce && ne > tMin(c.hora_inicio2)) return c.materia
      }
    }
    return null
  }

  // Acumula cambio en pending y actualiza UI localmente
  const persistDrop = useCallback((
    item: DragItem, grupoNum: number,
    patch: Record<string, unknown>
  ) => {
    // Detectar conflicto si es una asignación (no un quitar)
    const newDia = (patch.dia ?? patch.dia2) as string | undefined
    const newHI = (patch.hora_inicio ?? patch.hora_inicio2) as string | undefined
    const newHF = (patch.hora_fin ?? patch.hora_fin2) as string | undefined
    if (newDia && newHI && newHF) {
      const conflict = checkConflict(item, grupoNum, newDia, newHI, newHF)
      if (conflict) {
        setError(`Conflicto de horario: "${item.materia}" se traslapa con "${conflict}" en el Grupo ${grupoNum} el ${newDia} ${newHI}–${newHF}.`)
        dragItemRef.current = null
        return
      }
    }

    const pgKey = `${item.asignaturaId}-${grupoNum}`
    const existingId = pgIds.current[pgKey] ?? item.pgId
    const body: Record<string, unknown> = existingId
      ? { id: existingId }
      : { asignatura_id: item.asignaturaId, periodo: '2027-2', grupo_num: grupoNum }
    Object.assign(body, patch)

    pushUndoRef.current()
    setError(null)
    // Actualizar UI
    setClases(prev => prev.map(c => {
      if (c.asignatura_id !== item.asignaturaId || c.grupo_num !== grupoNum) return c
      return { ...c, ...patch }
    }))

    // Acumular en pending (merge con cambios anteriores del mismo pgKey)
    setPending(prev => {
      const next = new Map(prev)
      next.set(pgKey, { ...(next.get(pgKey) ?? {}), ...body })
      return next
    })

    dragItemRef.current = null
  }, [])

  // Guarda todos los cambios pendientes en la BD
  async function guardarTodo() {
    setSaving(true)
    try {
      const results = await Promise.all([...pending.entries()].map(([, body]) =>
        fetch('/api/plan-grupos', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }).then(r => r.json())
      ))
      // Actualizar pgIds con los ids reales devueltos
      const keys = [...pending.keys()]
      results.forEach((json, i) => {
        if (json.data?.id) pgIds.current[keys[i]] = json.data.id
        // Actualizar pg_id en clases
        if (json.data?.id) {
          const [asignaturaId, grupoNum] = keys[i].split('-').map(Number)
          setClases(prev => prev.map(c =>
            c.asignatura_id === asignaturaId && c.grupo_num === grupoNum
              ? { ...c, pg_id: json.data.id }
              : c
          ))
        }
      })
      setPending(new Map())
    } finally {
      setSaving(false)
    }
  }

  // Copia el horario del grupo origen al destino (solo materias compartidas)
  async function copiarHorarioA(origen: number, destino: number) {
    setCopyingTo(destino)
    const clasesSrc = clasesRef.current.filter(c => c.grupo_num === origen)
    const clavesSrc = new Set(clasesSrc.map(c => c.clave_base))
    const clasesDst = clasesRef.current.filter(c => c.grupo_num === destino && clavesSrc.has(c.clave_base))
    const clavesDst = new Set(clasesDst.map(c => c.clave_base))

    pushUndoRef.current()
    const patches: Record<string, unknown>[] = []
    for (const src of clasesSrc) {
      if (!clavesDst.has(src.clave_base)) continue // destino no tiene esta materia
      const dstId = pgIds.current[`${src.asignatura_id}-${destino}`]
        ?? clasesDst.find(c => c.clave_base === src.clave_base)?.pg_id
        ?? null
      const body: Record<string, unknown> = dstId
        ? { id: dstId }
        : { asignatura_id: src.asignatura_id, periodo: '2027-2', grupo_num: destino }
      body.dia          = src.dia
      body.hora_inicio  = src.hora_inicio
      body.hora_fin     = src.hora_fin
      body.dia2         = src.dia2
      body.hora_inicio2 = src.hora_inicio2
      body.hora_fin2    = src.hora_fin2
      patches.push(body)
      // Actualizar UI inmediatamente
      setClases(prev => prev.map(c =>
        c.clave_base === src.clave_base && c.grupo_num === destino
          ? { ...c, dia: src.dia, hora_inicio: src.hora_inicio, hora_fin: src.hora_fin,
                    dia2: src.dia2, hora_inicio2: src.hora_inicio2, hora_fin2: src.hora_fin2 }
          : c
      ))
    }
    // Guardar en DB
    await Promise.all(patches.map(body =>
      fetch('/api/plan-grupos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(r => r.json()).then(json => {
        if (json.data?.id) {
          const asigId = patches.find(p => p === body) ? (body.asignatura_id as number) : 0
          if (asigId) pgIds.current[`${asigId}-${destino}`] = json.data.id
        }
      })
    ))
    setCopyingTo(null)
    setCopySource(null)
  }

  // Drop on grid cell → move/place
  const handleDrop = useCallback((grupoNum: number, dayIdx: number, si: number) => {
    const item = dragItemRef.current
    if (!item) return
    const hora_inicio = SLOTS[si]
    const hora_fin = SLOTS[Math.min(si + item.duracionSlots, SLOTS.length - 1)]
    const dia = DIAS[dayIdx]
    const patch = item.sesion === 1
      ? { dia, hora_inicio, hora_fin }
      : { dia2: dia, hora_inicio2: hora_inicio, hora_fin2: hora_fin }
    persistDrop(item, grupoNum, patch)
  }, [persistDrop])

  // Drop on legend → unassign (clear time)
  const handleUnassign = useCallback((grupoNum: number) => {
    const item = dragItemRef.current
    if (!item || !item.fromGrid) return
    const patch = item.sesion === 1
      ? { dia: null, hora_inicio: null, hora_fin: null }
      : { dia2: null, hora_inicio2: null, hora_fin2: null }
    persistDrop(item, grupoNum, patch)
    setLegendOver(null)
  }, [persistDrop])

  return (
    <div>
      {/* Filtros */}
      <div className="flex gap-3 items-end mb-6">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 font-medium">Licenciatura</label>
          {userRol === 'coord' ? (
            <div className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-gray-50 text-gray-700 font-semibold">
              {filtLic}
            </div>
          ) : (
            <select value={filtLic} onChange={e => setFiltLic(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-400">
              <option value="">— Selecciona —</option>
              <option value="TODAS">Todas</option>
              {LICS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 font-medium">Semestre</label>
          <select value={filtSem} onChange={e => setFiltSem(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-400">
            <option value="">— Selecciona —</option>
            {SEMS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {grupos.length > 0 && (
          <div className="flex items-center gap-3 pb-0.5">
            <span className="text-sm text-gray-500"><strong className="text-gray-800">{grupos.length}</strong> grupos</span>
            {/* Selector de grupos visibles */}
            <div className="relative" ref={gruposPickerRef}>
              <button
                onClick={() => setShowGruposPicker(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 hover:bg-gray-50 transition text-gray-600"
              >
                <span>Ver grupos</span>
                {gruposVisibles !== null && (
                  <span className="bg-gray-800 text-white rounded-full px-1.5 py-0.5 text-[10px] leading-none">
                    {gruposVisibles.size}
                  </span>
                )}
                <span className="text-gray-400">▾</span>
              </button>
              {showGruposPicker && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl p-3 z-50 min-w-[220px]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-600">Grupos visibles</span>
                    <div className="flex gap-2">
                      <button onClick={() => setGruposVisibles(null)}
                        className="text-[10px] text-indigo-600 hover:underline font-medium">Todos</button>
                      <button onClick={() => setGruposVisibles(new Set())}
                        className="text-[10px] text-gray-400 hover:underline">Ninguno</button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {grupos.map(([gn]) => {
                      const visible = gruposVisibles === null || gruposVisibles.has(gn)
                      return (
                        <button
                          key={gn}
                          onClick={() => {
                            setGruposVisibles(prev => {
                              const base = prev === null
                                ? new Set(grupos.map(([n]) => n))
                                : new Set(prev)
                              if (base.has(gn)) base.delete(gn)
                              else base.add(gn)
                              return base.size === grupos.length ? null : base
                            })
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                            visible
                              ? 'bg-gray-900 text-white border-gray-900'
                              : 'bg-white text-gray-400 border-gray-200'
                          }`}
                        >
                          G{gn}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
            {pending.size > 0 && (
              <>
                <span className="text-xs text-amber-600 font-medium">{pending.size} {pending.size === 1 ? 'cambio sin guardar' : 'cambios sin guardar'}</span>
                <button onClick={() => { setPending(new Map()); window.location.reload() }}
                  className="px-3 py-1 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100 transition border border-gray-200">
                  Descartar
                </button>
              </>
            )}
            <button onClick={undo} disabled={!canUndo} title="Deshacer (Ctrl+Z)"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-500 border border-gray-200 hover:bg-gray-50 transition disabled:opacity-30">
              ↩
            </button>
            <button onClick={redo} disabled={!canRedo} title="Rehacer (Ctrl+Y)"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-500 border border-gray-200 hover:bg-gray-50 transition disabled:opacity-30">
              ↪
            </button>
            <button onClick={() => { setShowDispersion(v => !v); setShowMateria(false) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${showDispersion ? 'bg-indigo-600 text-white border-indigo-600' : 'text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
              🔀 Dispersión
            </button>
            <button onClick={() => { setShowMateria(v => !v); setShowDispersion(false) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${showMateria ? 'bg-teal-600 text-white border-teal-600' : 'text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
              📚 Materia
            </button>
            <button onClick={() => setReloadKey(k => k + 1)} disabled={saving || pending.size > 0}
              title="Recargar datos de la base de datos"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-500 border border-gray-200 hover:bg-gray-50 transition disabled:opacity-40">
              ↻ Actualizar
            </button>
            <button onClick={guardarTodo} disabled={saving || pending.size === 0}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${pending.size > 0 ? 'bg-gray-900 text-white hover:bg-gray-700' : 'bg-gray-100 text-gray-400 cursor-default'}`}>
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        )}
      </div>

      {/* Error de conflicto */}
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 mb-4 bg-red-50 border border-red-200 rounded-xl">
          <span className="text-sm text-red-700 flex-1">⚠️ {error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
        </div>
      )}

      {/* Vista Dispersión */}
      {showDispersion && clases.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto mb-4">
          <table className="text-xs border-collapse min-w-max">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left bg-gray-900 text-white sticky left-0 z-10 min-w-[200px] rounded-tl-xl">Materia</th>
                {grupos
                  .filter(([gn]) => gruposVisibles === null || gruposVisibles.has(gn))
                  .map(([gn]) => (
                  <th key={gn} className="px-3 py-2 text-center bg-gray-900 text-white min-w-[90px] font-semibold">G{gn}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...new Map(clases.map(c => [c.clave_base, c])).values()]
                .sort((a, b) => {
                  const si = SEMS.indexOf(a.semestre) - SEMS.indexOf(b.semestre)
                  return si !== 0 ? si : a.clave_base.localeCompare(b.clave_base)
                })
                .flatMap(matRow => {
                  const numSes = matRow.num_sesiones ?? 1
                  return Array.from({ length: numSes }, (_, sesIdx) => {
                    const sesion = (sesIdx + 1) as 1 | 2
                    const col = colorMap.get(matRow.clave_base) ?? DEFAULT_COLOR
                    const visibles = grupos.filter(([gn]) => gruposVisibles === null || gruposVisibles.has(gn))
                    return (
                      <tr key={`${matRow.clave_base}-${sesion}`} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2 sticky left-0 bg-white border-r border-gray-100 font-medium text-gray-700 z-[5]"
                          style={{ borderLeft: `4px solid ${col.border}` }}>
                          <div className="truncate max-w-[190px]">
                            {matRow.materia}{numSes >= 2 ? <span className="ml-1 text-gray-400">S{sesion}</span> : null}
                          </div>
                          <div className="text-[9px] text-gray-400 font-mono">{matRow.clave_base} · {matRow.semestre}</div>
                        </td>
                        {visibles.map(([gn, grupoClases]) => {
                          const c = grupoClases.find(x => x.clave_base === matRow.clave_base)
                          if (!c) return (
                            <td key={gn} className="px-2 py-1.5 text-center text-gray-200 border-r border-gray-50">—</td>
                          )
                          const dia   = sesion === 1 ? c.dia   : c.dia2
                          const hi    = sesion === 1 ? c.hora_inicio  : c.hora_inicio2
                          const placed = !!dia && !!hi
                          return (
                            <td key={gn} className="px-2 py-1.5 text-center border-r border-gray-50"
                              style={{ background: placed ? col.bg : undefined }}>
                              {placed ? (
                                <span className="font-medium text-[10px] leading-tight whitespace-nowrap"
                                  style={{ color: col.text }}>
                                  {dia!.slice(0,3).toUpperCase()} {hi!.slice(0,5)}
                                </span>
                              ) : (
                                <span className="text-gray-200">—</span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })
                })}
            </tbody>
          </table>
        </div>
      )}

      {/* Vista Materia */}
      {showMateria && clases.length > 0 && (() => {
        const materias = [...new Map(clases.map(c => [c.clave_base, c])).values()]
          .sort((a, b) => a.materia.localeCompare(b.materia))
        const visibles = grupos.filter(([gn]) => gruposVisibles === null || gruposVisibles.has(gn))
        const gruposConMateria = filtMateria
          ? visibles.filter(([, gc]) => gc.some(c => c.clave_base === filtMateria))
          : []
        return (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-4">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3 flex-wrap">
              <span className="text-sm font-semibold text-gray-700">Vista por materia</span>
              <select
                value={filtMateria}
                onChange={e => setFiltMateria(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-400 max-w-xs"
              >
                <option value="">— Selecciona una materia —</option>
                {materias.map(m => (
                  <option key={m.clave_base} value={m.clave_base}>{m.materia} ({m.clave_base})</option>
                ))}
              </select>
              {filtMateria && gruposConMateria.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {gruposConMateria.map(([gn], gi) => {
                    const col = GROUP_COLORS[gi % GROUP_COLORS.length]
                    return (
                      <span key={gn} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border"
                        style={{ background: col.bg, borderColor: col.border, color: col.text }}>
                        G{gn}
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
            {filtMateria ? (
              <div className="p-4">
                <MateriaReadGrid grupos={grupos} gruposVisibles={gruposVisibles} filtMateria={filtMateria} />
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400 text-sm">Selecciona una materia para ver su distribución en todos los grupos.</div>
            )}
          </div>
        )
      })()}

      {!filtLic || !filtSem ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-400">
          Selecciona licenciatura y semestre para ver las plantillas.
        </div>
      ) : loading ? (
        <div className="text-center py-20 text-gray-400">Cargando…</div>
      ) : grupos.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-400">
          Sin grupos configurados para {filtLic} · {filtSem}.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {(() => {
            const visibles = grupos.filter(([gn]) => gruposVisibles === null || gruposVisibles.has(gn))
            return Array.from({ length: Math.ceil(visibles.length / 3) }, (_, ri) =>
              visibles.slice(ri * 3, ri * 3 + 3)
            )
          })().map((fila, ri) => (
            <div key={ri} className="flex gap-4 overflow-x-auto pb-2">
              {fila.map(([grupoNum, clasesDel]) => {
                const materiasDel = [...new Map(clasesDel.map(c => [c.clave_base, c])).values()]
                const isLegendTarget = legendOver === grupoNum
                return (
                  <div key={grupoNum} className="bg-white rounded-xl shadow-sm overflow-hidden flex-shrink-0 relative" style={{ width: '38vw' }}>
                    <div className="px-4 py-2 bg-gray-900 text-white font-bold text-sm flex items-center justify-between">
                      <span>Grupo {grupoNum}</span>
                      {copySource === grupoNum ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-normal text-gray-400">Copiar a:</span>
                          {grupos.filter(([gn]) => gn !== grupoNum).map(([gn]) => (
                            <button key={gn}
                              onClick={() => copiarHorarioA(grupoNum, gn)}
                              disabled={copyingTo === gn}
                              className="text-[10px] px-2 py-0.5 rounded bg-white text-gray-900 hover:bg-indigo-100 font-semibold disabled:opacity-50 transition">
                              {copyingTo === gn ? '...' : `G${gn}`}
                            </button>
                          ))}
                          <button onClick={() => setCopySource(null)}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition">✕</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setCopySource(grupoNum)}
                          title="Copiar horario a otro grupo"
                          className="text-[10px] font-semibold px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 transition">
                          Copiar ↗
                        </button>
                      )}
                    </div>
                    <div className="flex items-stretch overflow-hidden">
                      <div className="flex-1 p-2 min-w-0">
                        <ScheduleGrid
                          clases={clasesDel}
                          colorMap={colorMap}
                          grupoNum={grupoNum}
                          dragItemRef={dragItemRef}
                          onDrop={(d, s) => handleDrop(grupoNum, d, s)}
                          onClear={(asigId, sesion) => {
                            const c = clases.find(c => c.asignatura_id === asigId && c.grupo_num === grupoNum)
                            if (!c) return
                            const pgId = pgIds.current[`${asigId}-${grupoNum}`] ?? c.pg_id
                            const patch = sesion === 1
                              ? { dia: null, hora_inicio: null, hora_fin: null }
                              : { dia2: null, hora_inicio2: null, hora_fin2: null }
                            persistDrop(
                              { claveBase: c.clave_base, materia: c.materia, grupoNum, asignaturaId: asigId, pgId: pgId ?? null, sesion, duracionSlots: 0, color: colorMap.get(c.clave_base) ?? PALETTE[0], fromGrid: true },
                              grupoNum,
                              patch
                            )
                          }}
                        />
                      </div>
                      <div
                        className="flex flex-col gap-1.5 p-2 border-l min-w-[88px] max-w-[96px] transition-colors rounded-br-xl overflow-y-auto"
                        style={{
                          borderColor: isLegendTarget ? '#374151' : '#f3f4f6',
                          background: isLegendTarget ? '#f3f4f6' : 'transparent',
                          maxHeight: 660,
                        }}
                        onWheel={e => e.stopPropagation()}
                        onDragOver={e => {
                          const item = dragItemRef.current
                          if (item?.fromGrid && item.grupoNum === grupoNum) { e.preventDefault(); setLegendOver(grupoNum) }
                        }}
                        onDragLeave={() => setLegendOver(null)}
                        onDrop={e => { e.preventDefault(); handleUnassign(grupoNum) }}
                      >
                        {isLegendTarget && (
                          <div className="text-[9px] text-gray-500 text-center font-semibold mb-1">Soltar para quitar</div>
                        )}
                        {materiasDel.flatMap(c => {
                          const col = colorMap.get(c.clave_base) ?? PALETTE[0]
                          const sesiones: Array<1 | 2> = (c.num_sesiones ?? 1) >= 2 ? [1, 2] : [1]
                          return sesiones.map(s => {
                            const dur = duracionDeHoras(c.horas_sesiones, s)
                            const placed = s === 1 ? !!c.dia : !!c.dia2
                            return (
                              <div key={`${c.clave_base}-${s}`}
                                draggable
                                onDragStart={() => {
                                  dragItemRef.current = {
                                    claveBase: c.clave_base, materia: c.materia, grupoNum,
                                    asignaturaId: c.asignatura_id,
                                    pgId: pgIds.current[`${c.asignatura_id}-${grupoNum}`] ?? c.pg_id,
                                    sesion: s, duracionSlots: dur, color: col, fromGrid: false,
                                  }
                                }}
                                onDragEnd={() => { dragItemRef.current = null }}
                                className="flex flex-col items-center justify-center text-center rounded-lg border px-1 py-1.5 gap-0.5 select-none transition-all"
                                style={{
                                  background: col.bg, borderColor: placed ? col.border : '#d1d5db',
                                  color: col.text, opacity: placed ? 0.45 : 1, cursor: 'grab',
                                  outline: placed ? `2px solid ${col.border}` : 'none',
                                  outlineOffset: placed ? '-2px' : '0',
                                }}
                                title={placed ? `C${s} colocada — arrastra desde el horario para moverla` : `Arrastra al horario para asignar`}
                              >
                                <span className="text-[10px] font-semibold leading-tight">{c.materia}</span>
                                <span className="text-[9px] font-mono opacity-80">{c.clave_base}</span>
                                <span className="text-[9px] font-bold">
                                  {/fotografí?a\s*I\b/i.test(c.materia)
                                    ? (s === 1 ? 'Teoría/Lab' : `G${grupoNum} C${s}`)
                                    : `G${grupoNum} C${s}`}
                                </span>
                                {placed && <span className="text-[8px] opacity-60">✓</span>}
                              </div>
                            )
                          })
                        })}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
