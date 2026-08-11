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

    // Usar mapa para deduplicar claves repetidas
    const payloadMap: Record<string, any> = {}
    let omitidas = 0

    for (const fila of filas) {
      const clave = String(fila['Clave'] || '').trim()
      const materia = String(fila['Materia'] || '').trim()
      const docente = String(fila['Docente'] || '').trim()
      const semestre = String(fila['Semestre'] || '').trim()
      const enlace = String(fila['Enlace'] || '').trim() || null
      const grupo = Number(fila['Grupo']) || 0
      const bloque = String(fila['Bloque'] || '').trim() || null

      if (!clave || !materia || materia === 'Asignatura' || materia === 'OBSERVACIONES') {
        omitidas++
        continue
      }

      // Si ya existe la clave, solo actualizamos si esta fila tiene más info
      if (!payloadMap[clave] || enlace) {
        payloadMap[clave] = { clave, materia, docente, semestre, licenciatura: 'Estudios Integrales', enlace, grupo, bloque }
      }
    }

    const payload = Object.values(payloadMap)

    // Upsert en batches de 50
    let actualizadas = 0
    let errores: string[] = []
    const BATCH = 50
    for (let i = 0; i < payload.length; i += BATCH) {
      const batch = payload.slice(i, i + BATCH)
      const { error } = await supabaseAdmin
        .from('claves')
        .upsert(batch, { onConflict: 'clave' })
      if (error) {
        errores.push(error.message)
        console.log('Error upsert:', error.message, 'batch:', i)
      } else {
        actualizadas += batch.length
      }
    }

    return NextResponse.json({
      ok: true,
      resumen: { insertadas: 0, actualizadas, omitidas, errores }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}