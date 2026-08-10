import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const busqueda = searchParams.get('busqueda') || ''
  const id = searchParams.get('id') || ''

  try {
    if (id) {
      const { data: docente } = await supabaseAdmin
        .from('docentes')
        .select('*')
        .eq('id', id)
        .single()

      const { data: seguimiento } = await supabaseAdmin
        .from('seguimiento_docente')
        .select('*')
        .eq('docente_id', id)
        .eq('ciclo', '2027-1')
        .single()

      const { data: grupos } = await supabaseAdmin
        .from('grupos_docente')
        .select('*')
        .eq('docente_id', id)
        .eq('ciclo', '2027-1')

      return NextResponse.json({ data: { ...docente, seguimiento, grupos } })
    }

    let query = supabaseAdmin
      .from('docentes')
      .select('id, id_centro, nombre, correo_centro, forma_pago, tabulador')
      .order('nombre')

    if (busqueda) query = query.ilike('nombre', `%${busqueda}%`)

    const { data, error } = await query.limit(200)
    if (error) throw error

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { docente_id, ciclo, ...campos } = body

    const { data, error } = await supabaseAdmin
      .from('seguimiento_docente')
      .upsert({ docente_id, ciclo: ciclo || '2027-1', ...campos }, { onConflict: 'docente_id,ciclo' })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ ok: true, data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}