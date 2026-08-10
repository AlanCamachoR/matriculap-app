import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const clave_id = searchParams.get('clave_id')

  try {
    let query = supabaseAdmin
      .from('firmas_estudiantes')
      .select('estudiante_id, clave_id, firmado, fecha')

    if (clave_id) query = query.eq('clave_id', clave_id)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { clave_id, estudiantes_firmados, registrado_por } = await request.json()

    if (!clave_id || !estudiantes_firmados) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    }

    // Insertar o actualizar cada estudiante
    const registros = estudiantes_firmados.map((estudiante_id: number) => ({
      estudiante_id,
      clave_id,
      firmado: true,
      registrado_por,
      fecha: new Date().toISOString(),
    }))

    const { data, error } = await supabaseAdmin
      .from('firmas_estudiantes')
      .upsert(registros, { onConflict: 'estudiante_id,clave_id' })
      .select()

    if (error) throw error

    return NextResponse.json({ ok: true, data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}