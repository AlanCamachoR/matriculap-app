import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import * as XLSX from 'xlsx'

const LIC_MAP: Record<string, string> = {
  'Arquitectura': 'ARQ',
  'Computación Creativa': 'CC',
  'Mercadotecnia y Publicidad': 'MP',
  'Comunicación Visual': 'CV',
  'Diseño Industrial': 'DI',
  'Arquitectura de Interiores': 'AI',
  'Diseño Textil y Moda': 'DTM',
  'Cine y Televisión': 'CT',
  'Estudios Integrales': 'EI',
  'Negocios e Industrias Creativas': 'NC',
}

function toSemestre(n: number | string): string {
  const num = typeof n === 'string' ? parseInt(n) : n
  return `${num}°`
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buffer, { type: 'buffer' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<any>(ws)

    const registros: any[] = []
    const errores: string[] = []

    for (const row of rows) {
      const licNombre = row['Licenciatura']?.toString().trim()
      const lic = LIC_MAP[licNombre]
      if (!lic) {
        errores.push(`Licenciatura desconocida: "${licNombre}"`)
        continue
      }

      const planRaw = row['Plan']?.toString().trim()
      const plan = planRaw === '2021' || planRaw === '21' ? '21' : '25'

      const semRaw = row['Sem']
      const semestre = toSemestre(semRaw)

      const nombre = row['Asignatura']?.toString().trim()
      const clave_base = row['Clave']?.toString().trim()
      const horas_semana = row['HA'] != null ? Number(row['HA']) : null
      if (!nombre || !clave_base) {
        errores.push(`Fila incompleta: ${JSON.stringify(row)}`)
        continue
      }

      registros.push({ licenciatura: lic, plan, semestre, nombre, clave_base, horas_semana })
    }

    if (registros.length === 0) {
      return NextResponse.json({ error: 'No se encontraron filas válidas', errores }, { status: 400 })
    }

    // Upsert por (clave_base, nombre) — múltiples materias pueden compartir clave (versiones por licenciatura)
    let insertados = 0
    for (let i = 0; i < registros.length; i += 100) {
      const lote = registros.slice(i, i + 100)
      const { error } = await supabaseAdmin
        .from('plan_asignaturas')
        .upsert(lote, { onConflict: 'clave_base,nombre' })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      insertados += lote.length
    }

    return NextResponse.json({ ok: true, insertados, errores })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
