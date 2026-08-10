import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import * as XLSX from 'xlsx'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const archivo = formData.get('archivo') as File

    if (!archivo) {
      return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })
    }

    const buffer = await archivo.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(sheet, { range: 5 }) as any[]

    // Obtener claves existentes
    const { data: clavesDB } = await supabaseAdmin
      .from('claves')
      .select('id, clave')

    const clavesMap: Record<string, number> = {}
    for (const c of clavesDB || []) {
      clavesMap[c.clave] = c.id
    }

    const estudiantesNuevos: any[] = []
    const matriculasNuevas: { clave_id: number; estudiante_id_centro: string }[] = []
    const estudiantesMap: Record<string, any> = {}

    for (const row of rows) {
      const curso = String(row['Curso'] || '').trim()
      const seccion = String(row['Sección'] || '').trim()
      const joinKey = `${curso}-${seccion}`
      const clave_id = clavesMap[joinKey]

      if (!clave_id) continue

      // Normalizar ID quitando ceros a la izquierda
      const id_raw = String(row['Id'] || '').trim()
      const id_centro = id_raw.replace(/^0+/, '') // quitar ceros iniciales
      const nombre = String(row['Nombre'] || '').trim()
      const programa = String(row['Programa'] || '').trim()
      const curriculo = String(row['Currículum'] || '').trim()

      if (!id_centro || !nombre) continue

      if (!estudiantesMap[id_centro]) {
        estudiantesMap[id_centro] = { id_centro, nombre, programa, curriculo }
        estudiantesNuevos.push({ id_centro, nombre, programa, curriculo })
      }

      matriculasNuevas.push({ clave_id, estudiante_id_centro: id_centro })
    }

    // Upsert estudiantes
    let estudiantesActualizados = 0
    if (estudiantesNuevos.length > 0) {
      const BATCH = 200
      for (let i = 0; i < estudiantesNuevos.length; i += BATCH) {
        const batch = estudiantesNuevos.slice(i, i + BATCH)
        const { error } = await supabaseAdmin
          .from('estudiantes')
          .upsert(batch, { onConflict: 'id_centro' })
        if (!error) estudiantesActualizados += batch.length
      }
    }

    // Obtener IDs de estudiantes
    const { data: estDB } = await supabaseAdmin
      .from('estudiantes')
      .select('id, id_centro')

    const estMap: Record<string, number> = {}
    for (const e of estDB || []) {
      estMap[e.id_centro] = e.id
    }

    // Upsert matrículas
    let matriculasActualizadas = 0
    const matriculasPayload = matriculasNuevas
      .filter(m => estMap[m.estudiante_id_centro])
      .map(m => ({
        clave_id: m.clave_id,
        estudiante_id: estMap[m.estudiante_id_centro],
        estatus: 'Inscrito'
      }))

    if (matriculasPayload.length > 0) {
      const BATCH = 200
      for (let i = 0; i < matriculasPayload.length; i += BATCH) {
        const batch = matriculasPayload.slice(i, i + BATCH)
        const { error } = await supabaseAdmin
          .from('matricula')
          .upsert(batch, { onConflict: 'clave_id,estudiante_id' })
        if (!error) matriculasActualizadas += batch.length
      }
    }

    return NextResponse.json({
      ok: true,
      resumen: {
        estudiantesActualizados,
        matriculasActualizadas,
      }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}