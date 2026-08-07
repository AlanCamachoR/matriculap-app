import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const busqueda = searchParams.get('busqueda') || ''

  try {
    let query = supabaseAdmin
      .from('matricula')
      .select(`
        id,
        estatus,
        estudiantes (id, id_centro, nombre, programa, curriculo),
        claves (id, clave, semestre, materia, docente, licenciatura, grupo)
      `)

    if (busqueda) {
      // Primero buscar IDs de estudiantes que coincidan
      const { data: ests } = await supabaseAdmin
        .from('estudiantes')
        .select('id')
        .or(`nombre.ilike.%${busqueda}%,id_centro.ilike.%${busqueda}%`)

      const ids = (ests || []).map(e => e.id)
      if (ids.length === 0) {
        return NextResponse.json({ data: [] })
      }
      query = query.in('estudiante_id', ids)
    }

    const { data, error } = await query.limit(500)
    if (error) throw error

    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener estudiantes' }, { status: 500 })
  }
}