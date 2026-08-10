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

    // ===== HOJA RESUMEN =====
    const sheet = workbook.Sheets['Resumen']
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]

    // Encabezados en fila 0
    const headers = rows[0]

    // Datos de docentes filas 1-101 (seguimiento)
    const docentesSeguimiento: any[] = []
    for (let i = 1; i <= 101; i++) {
      const row = rows[i]
      if (!row || !row[0]) continue
      const obj: any = {}
      headers.forEach((h, idx) => {
        if (h) obj[h] = row[idx]
      })
      docentesSeguimiento.push(obj)
    }

    // Datos adicionales desde fila 103
    const docentesExtra: any[] = []
    for (let i = 103; i < rows.length; i++) {
      const row = rows[i]
      if (!row || !row[1]) continue // col B = ID
      docentesExtra.push({
        nombre: row[0],
        id_centro: String(row[1] || '').trim(),
        correo_centro: row[3],
        correo_personal: row[4],
        contacto: String(row[5] || '').trim(),
        forma_pago: row[9],
        tabulador: String(row[8] || '').trim(),
        fecha_ingreso: row[6] ? String(row[6]).split('T')[0] : null,
        extranjero: row[7] ? 'SI' : null,
      })
    }

    // Upsert docentes
    let docentesInsertados = 0
    const docentesPayload = docentesExtra.map(d => ({
      id_centro: d.id_centro,
      nombre: d.nombre,
      correo_centro: d.correo_centro || null,
      correo_personal: d.correo_personal || null,
      contacto: d.contacto || null,
      forma_pago: d.forma_pago || null,
      tabulador: d.tabulador || null,
      fecha_ingreso: d.fecha_ingreso || null,
      extranjero: d.extranjero || null,
    })).filter(d => d.id_centro)

    if (docentesPayload.length > 0) {
      const { error } = await supabaseAdmin
        .from('docentes')
        .upsert(docentesPayload, { onConflict: 'id_centro' })
      if (!error) docentesInsertados = docentesPayload.length
    }

    // Obtener IDs de docentes
    const { data: docentesDB } = await supabaseAdmin
      .from('docentes')
      .select('id, id_centro, nombre')

    const docentesPorId: Record<string, number> = {}
    const docentesPorNombre: Record<string, number> = {}
    for (const d of docentesDB || []) {
      docentesPorId[d.id_centro] = d.id
      docentesPorNombre[d.nombre?.toLowerCase()] = d.id
    }

    // Upsert seguimiento
    let seguimientoInsertado = 0
    for (const d of docentesSeguimiento) {
      const id_centro = String(d['ID DOCENTE'] || '').trim()
      const docente_id = docentesPorId[id_centro]
      if (!docente_id) continue

      const seg = {
        docente_id,
        ciclo: '2027-1',
        asistencia: d['Asistencia'] || null,
        temarios_oficina: d['Temarios en Oficina'] || null,
        temarios_bs: d['Temarios en BS'] || null,
        materiales_bibliografia: d['Materiales y Bibliografía'] || null,
        participacion_activa: d['Participación activa'] || null,
        evaluacion_intermedia: d['Evaluación intermedia'] || null,
        reposiciones: d['Reposiciones'] || null,
        evaluacion_final: d['Evaluacion final'] || null,
        acompanamiento: d['acompañamiento'] || null,
        publicacion_calificaciones: d['Publicacion de calificaciones'] || null,
        bloque: d['BLOQUE'] || null,
        documentos_institucionales: d['Documentos institucionales'] || null,
        retroalimentacion: d['Retroalimentacion'] || null,
        fecha_retro: d['fecha de retro'] ? String(d['fecha de retro']).split('T')[0] : null,
        acta_nacimiento: d['Acta de nacimiento'] || null,
        curp: d['CURP'] || null,
        ine: d['INE'] || null,
        constancia_fiscal: d['Constancia de situación fiscal'] || null,
        e_firma: d['e-firma'] || null,
        titulo_licenciatura: d['Título y cédula licenciatura'] || null,
        titulo_maestria: d['Título y cédula Maestría'] || null,
        titulo_doctorado: d['Título y cédula Doctorado'] || null,
        fm3: d['FM3'] || null,
        constancia_extranjero: d['Constancia extranjero'] || null,
        constancias_publicaciones: d['Constancias y publicaciones'] || null,
      }

      const { error } = await supabaseAdmin
        .from('seguimiento_docente')
        .upsert(seg, { onConflict: 'docente_id,ciclo' })
      if (!error) seguimientoInsertado++
    }

    // ===== HOJA DOCENTE1 =====
    const sheet2 = workbook.Sheets['Docente1']
    const rows2 = XLSX.utils.sheet_to_json(sheet2, { header: 1 }) as any[][]

    let gruposInsertados = 0
    for (let i = 4; i < rows2.length; i++) {
      const row = rows2[i]
      if (!row || !row[1]) continue // col B = Clave

      const id_docente = String(rows2[1]?.[0] || '').trim() // ID en fila 1
      const docente_id = docentesPorId[id_docente]
      if (!docente_id) continue

      const grupo = {
        docente_id,
        ciclo: '2027-1',
        semestre: row[0] || null,
        clave: row[1] || null,
        grupo: row[2] || null,
        materia: row[3] || null,
        bloque: row[6] || null,
        horas: String(row[7] || '').trim() || null,
        dia1: row[8] || null,
        horario1: row[9] || null,
        salon1: row[10] || null,
        dia2: row[11] || null,
        horario2: row[12] || null,
        salon2: row[13] || null,
      }

      const { error } = await supabaseAdmin
        .from('grupos_docente')
        .insert(grupo)
      if (!error) gruposInsertados++
    }

    return NextResponse.json({
      ok: true,
      resumen: {
        docentesInsertados,
        seguimientoInsertado,
        gruposInsertados,
      }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}