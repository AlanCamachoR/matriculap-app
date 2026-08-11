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
    const rows = XLSX.utils.sheet_to_json(sheet, { range: 5 }) as any[]

    // Obtener claves existentes
    const { data: clavesDB } = await supabaseAdmin
      .from('claves')
      .select('id, clave')

    const clavesMap: Record<string, number> = {}
    for (const c of clavesDB || []) {
      clavesMap[c.clave] = c.id
    }

    // Obtener secciones para cruce de irregulares
    const { data: seccionesDB } = await supabaseAdmin
      .from('secciones')
      .select('clave, seccion, materia, salon')
      .eq('ciclo', '2027-1')
      .not('salon', 'is', null)
      .not('docente', 'is', null)

    // Mapa: "materia|salon_normalizado" -> clave de EI
    const seccionPorMateriaYSalon: Record<string, string> = {}
    for (const s of seccionesDB || []) {
      if (!s.salon || !s.materia) continue
      // Solo claves de EI (que empiezan con EI o TCAI con plan 25)
      const esEI = s.clave.includes('-25') || s.clave.startsWith('EI')
      if (!esEI) continue
      const salonBase = s.salon.split(',')[0].trim() // tomar solo el primer salón
      const key = `${s.materia.toLowerCase().trim()}|${salonBase.toLowerCase()}`
      const claveCompleta = `${s.clave}-${s.seccion}`
      seccionPorMateriaYSalon[key] = claveCompleta
    }

    // Mapa inverso: clave irregular -> materia y salon
    const seccionIrregular: Record<string, { materia: string; salon: string }> = {}
    for (const s of seccionesDB || []) {
      if (!s.salon || !s.materia) continue
      const esIrregular = !s.clave.includes('-25') && !s.clave.startsWith('EI')
      if (!esIrregular) continue
      const salonBase = s.salon.split(',')[0].trim()
      const claveCompleta = `${s.clave}-${s.seccion}`
      seccionIrregular[claveCompleta] = {
        materia: s.materia.toLowerCase().trim(),
        salon: salonBase.toLowerCase()
      }
    }

    const estudiantesNuevos: any[] = []
    const matriculasNuevas: { clave_id: number; estudiante_id_centro: string; irregular: boolean }[] = []
    const estudiantesMap: Record<string, any> = {}

    for (const row of rows) {
      const curso = String(row['Curso'] || '').trim()
      const seccion = String(row['Sección'] || '').trim()
      const joinKey = `${curso}-${seccion}`

      let clave_id = clavesMap[joinKey]
      let irregular = false

      if (!clave_id) {
        // Intentar cruce por materia + salón
        const infoIrregular = seccionIrregular[joinKey]
        if (infoIrregular) {
          const keyBusqueda = `${infoIrregular.materia}|${infoIrregular.salon}`
          const claveEI = seccionPorMateriaYSalon[keyBusqueda]
          if (claveEI && clavesMap[claveEI]) {
            clave_id = clavesMap[claveEI]
            irregular = true
          }
        }
      }

      if (!clave_id) continue

      const id_raw = String(row['Id'] || '').trim()
      const id_centro = id_raw.replace(/^0+/, '')
      const nombre = String(row['Nombre'] || '').trim()
      const programa = String(row['Programa'] || '').trim()
      const curriculo = String(row['Currículum'] || '').trim()

      if (!id_centro || !nombre) continue

      if (!estudiantesMap[id_centro]) {
        estudiantesMap[id_centro] = { id_centro, nombre, programa, curriculo }
        estudiantesNuevos.push({ id_centro, nombre, programa, curriculo })
      }

      matriculasNuevas.push({ clave_id, estudiante_id_centro: id_centro, irregular })
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
    let irregularesInscritos = 0

    const matriculasPayload = matriculasNuevas
      .filter(m => estMap[m.estudiante_id_centro])
      .map(m => ({
        clave_id: m.clave_id,
        estudiante_id: estMap[m.estudiante_id_centro],
        estatus: 'Inscrito',
        irregular: m.irregular
      }))

    if (matriculasPayload.length > 0) {
      const BATCH = 200
      for (let i = 0; i < matriculasPayload.length; i += BATCH) {
        const batch = matriculasPayload.slice(i, i + BATCH)
        const { error } = await supabaseAdmin
          .from('matricula')
          .upsert(batch, { onConflict: 'clave_id,estudiante_id' })
        if (!error) {
          matriculasActualizadas += batch.filter(m => !m.irregular).length
          irregularesInscritos += batch.filter(m => m.irregular).length
        }
      }
    }

    return NextResponse.json({
      ok: true,
      resumen: {
        estudiantesActualizados,
        matriculasActualizadas,
        irregularesInscritos,
      }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}