import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const busqueda = (searchParams.get('q') || '').trim()
  const programa = searchParams.get('programa') || ''
  const semestre = searchParams.get('semestre') || ''

  const client = await pool.connect()
  try {
    const conditions = [`e.id_centro NOT ILIKE '%P%'`]
    const params: unknown[] = []

    if (busqueda) {
      params.push(`%${busqueda}%`)
      conditions.push(`(e.nombre ILIKE $${params.length} OR e.id_centro ILIKE $${params.length})`)
    }
    if (programa) {
      params.push(programa)
      conditions.push(`e.programa = $${params.length}`)
    }
    if (semestre) {
      params.push(semestre)
      conditions.push(`EXISTS (
        SELECT 1 FROM matricula m2
        JOIN claves c2 ON c2.id = m2.clave_id
        WHERE m2.estudiante_id = e.id AND c2.semestre = $${params.length}
      )`)
    }

    const where = `WHERE ${conditions.join(' AND ')}`

    const { rows } = await client.query(
      `SELECT
         e.id, e.id_centro, e.nombre, e.programa,
         COUNT(m.id) AS materias_count,
         SUM(CASE WHEN fe.firmado = true THEN 1 ELSE 0 END) AS firmadas,
         SUM(CASE WHEN fe.firmado = false AND fe.id IS NOT NULL THEN 1 ELSE 0 END) AS no_firmadas,
         -- Asistencias Core: max faltas y min porcentaje para detectar casos críticos
         (SELECT SUM(ac.faltas)
          FROM asistencias_core ac
          WHERE ac.id_estudiante LIKE '%' || e.id_centro AND ac.ciclo = '2027-1') AS total_faltas,
         (SELECT MIN(ac.porcentaje_asistencia)
          FROM asistencias_core ac
          WHERE ac.id_estudiante LIKE '%' || e.id_centro AND ac.ciclo = '2027-1') AS min_pct_asistencia
       FROM estudiantes e
       LEFT JOIN matricula m ON m.estudiante_id = e.id
       LEFT JOIN firmas_estudiantes fe ON fe.estudiante_id = e.id AND fe.clave_id = m.clave_id
       ${where}
       GROUP BY e.id, e.id_centro, e.nombre, e.programa
       ORDER BY e.nombre
       LIMIT 300`,
      params
    )

    return NextResponse.json({ data: rows })
  } catch (e: any) {
    console.error('[lista] error:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  } finally {
    client.release()
  }
}
