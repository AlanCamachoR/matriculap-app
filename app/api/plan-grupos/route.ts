import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const periodo = searchParams.get('periodo') || '2027-2'
  // Intentar con columnas opcionales; si no existen, caer a las básicas
  let { data, error } = await supabaseAdmin
    .from('plan_grupos')
    .select('id,asignatura_id,aula_id,dia,hora_inicio,hora_fin,grupo_num,inscritos_estimados,num_sesiones,horas_sesiones,licenciaturas,num_grupos')
    .eq('periodo', periodo)
  if (error) {
    const res2 = await supabaseAdmin
      .from('plan_grupos')
      .select('id,asignatura_id,aula_id,dia,hora_inicio,hora_fin,grupo_num,inscritos_estimados')
      .eq('periodo', periodo)
    if (res2.error) return NextResponse.json({ error: res2.error.message }, { status: 500 })
    data = res2.data
  }
  return NextResponse.json({ data })
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, num_sesiones, horas_sesiones, licenciaturas, num_grupos } = body
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

    const { default: pool } = await import('@/lib/db')
    await pool.query(`
      ALTER TABLE plan_grupos
        ADD COLUMN IF NOT EXISTS num_sesiones integer,
        ADD COLUMN IF NOT EXISTS horas_sesiones jsonb,
        ADD COLUMN IF NOT EXISTS licenciaturas text[],
        ADD COLUMN IF NOT EXISTS num_grupos integer
    `)

    const r = await pool.query(
      `UPDATE plan_grupos
       SET num_sesiones = $1,
           horas_sesiones = $2::jsonb,
           licenciaturas = $3::text[],
           num_grupos = $4
       WHERE id = $5
       RETURNING id, asignatura_id, num_sesiones, horas_sesiones, licenciaturas, num_grupos`,
      [num_sesiones, JSON.stringify(horas_sesiones), licenciaturas, num_grupos ?? 1, id]
    )
    if (r.rowCount === 0) return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 })
    return NextResponse.json({ data: r.rows[0] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { asignatura_id, periodo, grupo_num } = body
    const { data, error } = await supabaseAdmin
      .from('plan_grupos')
      .upsert({ asignatura_id, periodo, grupo_num: grupo_num ?? 1 }, { onConflict: 'asignatura_id,periodo' })
      .select('id,asignatura_id,aula_id,dia,hora_inicio,hora_fin,grupo_num,inscritos_estimados')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const asignatura_id = searchParams.get('asignatura_id')
    const periodo = searchParams.get('periodo') || '2027-2'
    if (!asignatura_id) return NextResponse.json({ error: 'asignatura_id required' }, { status: 400 })
    const { error } = await supabaseAdmin
      .from('plan_grupos')
      .delete()
      .eq('asignatura_id', asignatura_id)
      .eq('periodo', periodo)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
