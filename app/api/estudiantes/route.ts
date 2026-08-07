import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const busqueda = searchParams.get('busqueda') || ''
  const programa = searchParams.get('programa') || ''
  const semestre = searchParams.get('semestre') || ''

  try {
    let estudianteIds: number[] | null = null

    if (busqueda || programa) {
      let q = supabaseAdmin.from('estudiantes').select('id')
      if (busqueda) q = q.or(`nombre.ilike.%${busqueda}%,id_centro.ilike.%${busqueda}%`)
      if (programa) q = q.eq('programa', programa)
      const { data } = await q
      estudianteIds = (data || []).map(e => e.id)
      if (estudianteIds.length === 0) return NextResponse.json({ data: [] })
    }

    let claveIds: number[] | null = null
    if (semestre) {
      const { data } = await supabaseAdmin.from('claves').select('id').eq('semestre', semestre)
      claveIds = (data || []).map(c => c.id)
      if (claveIds.length === 0) return NextResponse.json({ data: [] })
    }

    let query = supabaseAdmin
      .from('matricula')
      .select(`
        id, estatus,
        estudiantes (id, id_centro, nombre, programa, curriculo),
        claves (id, clave, semestre, materia, docente, licenciatura, grupo)
      `)

    if (estudianteIds) query = query.in('estudiante_id', estudianteIds)
    if (claveIds) query = query.in('clave_id', claveIds)

    const { data, error } = await query.limit(500)
    if (error) throw error

    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener estudiantes' }, { status: 500 })
  }
}