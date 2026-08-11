import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import * as XLSX from 'xlsx'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const archivo = formData.get('archivo') as File
    if (!archivo) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })

    const buffer = await archivo.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const filas: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

    let insertadas = 0
    let actualizadas = 0
    let omitidas = 0

    for (const fila of filas) {
      const clave = String(fila['Clave'] || '').trim()
      const materia = String(fila['Materia'] || '').trim()
      const docente = String(fila['Docente'] || '').trim()
      const semestre = String(fila['Semestre'] || '').trim()
      const licenciatura = String(fila['Licenciatura'] || '').trim()
      const enlace = String(fila['Enlace'] || '').trim() || null
      const grupo = parseInt(fila['Grupo']) || 0
      const bloque = String(fila['Bloque'] || '').trim() || null

      if (!clave || !materia || materia === 'Asignatura' || materia === 'OBSERVACIONES') {
        omitidas++
        continue
      }

      const { data: existente } = await supabaseAdmin
        .from('claves')
        .select('id')
        .eq('clave', clave)
        .single()

      if (existente) {
        const { error } = await supabaseAdmin
          .from('claves')
          .update({ materia, docente, semestre, licenciatura, enlace, grupo, bloque })
          .eq('clave', clave)
        if (!error) actualizadas++
      } else {
        const { error } = await supabaseAdmin
          .from('claves')
          .insert({ clave, materia, docente, semestre, licenciatura, enlace, grupo, bloque })
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