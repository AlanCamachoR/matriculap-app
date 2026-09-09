import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import * as XLSX from 'xlsx'

// GET: obtener asistencias por docente o por estudiante
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const docente_id  = searchParams.get('docente_id')
  const estudiante_id = searchParams.get('estudiante_id')
  const ciclo = searchParams.get('ciclo') || '2027-1'

  try {
    if (docente_id) {
      // id_docente en el Excel viene como "P000020111"; id_centro en docentes es "20111"
      // Buscamos por sufijo numérico para compatibilidad
      const r = await pool.query(
        `SELECT DISTINCT ON (clave_asignatura)
           clave_asignatura, nombre_asignatura, id_docente, nombre_docente,
           sesiones_por_clase, fecha_corte
         FROM asistencias_core
         WHERE id_docente LIKE '%' || $1 AND ciclo = $2
         ORDER BY clave_asignatura, fecha_corte DESC`,
        [docente_id, ciclo]
      )
      return NextResponse.json({ data: r.rows })
    }

    if (estudiante_id) {
      const r = await pool.query(
        `SELECT DISTINCT ON (clave_asignatura)
           clave_asignatura, nombre_asignatura, nombre_docente,
           sesiones_por_clase, asistencias, faltas, porcentaje_asistencia,
           calificacion_final, fecha_corte
         FROM asistencias_core
         WHERE id_estudiante LIKE '%' || $1 AND ciclo = $2
         ORDER BY clave_asignatura, fecha_corte DESC`,
        [estudiante_id, ciclo]
      )
      return NextResponse.json({ data: r.rows })
    }

    // Sin filtro: resumen de cargas
    const r = await pool.query(
      `SELECT ciclo, fecha_corte, COUNT(*) as filas
       FROM asistencias_core
       GROUP BY ciclo, fecha_corte
       ORDER BY fecha_corte DESC`
    )
    return NextResponse.json({ data: r.rows })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST: cargar Excel de asistencias Core
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const ciclo = (formData.get('ciclo') as string) || '2027-1'
    if (!file) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buffer, { type: 'buffer' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as any[][]

    // La fila 3 (índice 3) tiene los encabezados reales
    const headers = raw[3] as string[]
    const rows = raw.slice(4).map(r => {
      const obj: Record<string, any> = {}
      headers.forEach((h, i) => { if (h) obj[h] = r[i] })
      return obj
    }).filter(r => r['Nombre Departamento'] &&
      String(r['Nombre Departamento']).toLowerCase().includes('integrales'))

    if (rows.length === 0) return NextResponse.json({ error: 'No se encontraron filas de Estudios Integrales' }, { status: 400 })

    const fechaCorte = new Date().toISOString().slice(0, 10)

    // Eliminar registros anteriores del mismo ciclo
    await pool.query(`DELETE FROM asistencias_core WHERE ciclo = $1`, [ciclo])

    // Insertar en lotes
    let insertados = 0
    for (const r of rows) {
      const sesiones = r['Número Sesiones por Clase'] != null ? Number(r['Número Sesiones por Clase']) : null
      const asistencias = r['Asistencias'] != null ? Number(r['Asistencias']) : null
      const faltas = r['Faltas'] != null ? Number(r['Faltas']) : null
      const pct = r['Porcentaje de Asistencia'] != null ? Number(r['Porcentaje de Asistencia']) : null
      const cal = r['Calificación final calculada'] != null ? Number(r['Calificación final calculada']) : null

      await pool.query(
        `INSERT INTO asistencias_core
           (ciclo, fecha_corte, id_estudiante, nombre_estudiante, id_docente, nombre_docente,
            clave_asignatura, nombre_asignatura, nombre_departamento,
            sesiones_por_clase, asistencias, faltas, porcentaje_asistencia, calificacion_final)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [ciclo, fechaCorte,
         r['ID Estudiante'], r['Nombre Estudiante'],
         r['ID Docente'], r['Nombre Docente'],
         r['Clave Asignatura'], r['Nombre Asignatura'], r['Nombre Departamento'],
         sesiones, asistencias, faltas, pct, cal]
      )
      insertados++
    }

    return NextResponse.json({ ok: true, insertados, fecha_corte: fechaCorte })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
