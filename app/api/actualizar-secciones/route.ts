import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import * as XLSX from 'xlsx'

function esEI(departamento: string): boolean {
  const dep = departamento.trim().toLowerCase()
  return dep === 'estudios integrales' || dep.includes('estudios integrales')
}

function excelFecha(valor: any): string | null {
  if (!valor) return null
  if (typeof valor === 'number') {
    const date = XLSX.SSF.parse_date_code(valor)
    if (!date) return null
    const mes = String(date.m).padStart(2, '0')
    const dia = String(date.d).padStart(2, '0')
    return `${date.y}-${mes}-${dia}`
  }
  return String(valor).trim() || null
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const archivo = formData.get('archivo') as File
    if (!archivo) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })

    const buffer = await archivo.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: false })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]

    const rawData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
    let headerRow = 0
    for (let i = 0; i < rawData.length; i++) {
      if (rawData[i].some((cell: any) =>
        String(cell).includes('Academic Year') ||
        String(cell).includes('Legal Name') ||
        String(cell).includes('Department Desc')
      )) {
        headerRow = i
        break
      }
    }

    const headers = rawData[headerRow] as string[]
    const filas: any[] = rawData.slice(headerRow + 1).map(row => {
      const obj: any = {}
      headers.forEach((h, i) => { obj[String(h).trim()] = row[i] ?? '' })
      return obj
    })

    let insertadas = 0
    let actualizadas = 0
    let omitidas = 0

    for (const fila of filas) {
      const departamento = String(fila['Department Desc'] || '').trim()
      const programa = String(fila['Program'] || '').trim()
      const docente = String(fila['Legal Name'] || '').trim()

      // Omitir filas sin docente (grupos no abiertos)
      if (!docente) { omitidas++; continue }
      if (!esEI(departamento)) { omitidas++; continue }
      if (!programa.toLowerCase().includes('licenc')) { omitidas++; continue }

      const clave = String(fila['Secc Event ID'] || '').trim()
      const seccion = String(fila['Section'] || '').trim()
      const materia = String(fila['Publication Name'] || '').trim()
      const semestre = String(fila['Class Level'] || '').trim()
      const licenciatura = departamento
      const brightspace = String(fila['Brightspace'] || '').trim() || null
      const salon = String(fila['Salón'] || fila['Salon'] || '').trim() || null
      const altas = Number(fila['Altas']) || 0
      const bajas = Number(fila['Bajas']) || 0
      const fecha_inicio = excelFecha(fila['Start Date'])
      const fecha_fin = excelFecha(fila['End Date'])
      const programas = String(fila['Programas'] || '').trim() || null

      if (!clave || !materia) { omitidas++; continue }

      const { data: existente } = await supabaseAdmin
        .from('secciones')
        .select('id')
        .eq('clave', clave)
        .eq('seccion', seccion)
        .eq('ciclo', '2027-1')
        .single()

      if (existente) {
        const { error } = await supabaseAdmin
          .from('secciones')
          .update({
            materia, docente, semestre, licenciatura, programa,
            departamento, brightspace, salon, altas, bajas,
            fecha_inicio, fecha_fin, programas,
            updated_at: new Date().toISOString()
          })
          .eq('id', existente.id)
        if (!error) actualizadas++
      } else {
        const { error } = await supabaseAdmin
          .from('secciones')
          .insert({
            ciclo: '2027-1', clave, seccion, materia, docente,
            semestre, licenciatura, programa, departamento,
            brightspace, salon, altas, bajas,
            fecha_inicio, fecha_fin, programas
          })
        if (!error) insertadas++
      }
    }

    return NextResponse.json({
      ok: true,
      resumen: { insertadas, actualizadas, omitidas }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}