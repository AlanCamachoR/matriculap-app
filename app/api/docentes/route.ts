import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const CAMPOS_SEG = ['asistencia', 'temarios_oficina', 'temarios_bs', 'materiales_bibliografia', 'evaluacion_intermedia', 'evaluacion_final', 'publicacion_calificaciones']

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const busqueda = searchParams.get('busqueda') || ''
  const id = searchParams.get('id') || ''

  try {
    if (id) {
      const { data: docente, error: docError } = await supabaseAdmin
        .from('docentes')
        .select('*')
        .eq('id', id)
        .single()

      if (docError) throw docError
      if (!docente) return NextResponse.json({ data: null })

      const [seguimientoRes, gruposRes] = await Promise.all([
        supabaseAdmin
          .from('seguimiento_docente')
          .select('*')
          .eq('docente_id', id)
          .eq('ciclo', '2027-1')
          .single(),
        supabaseAdmin
          .from('claves')
          .select('id, clave, materia, semestre, grupo, enlace')
          .ilike('docente', `%${docente.nombre}%`)
          .not('materia', 'in', '("Asignatura","OBSERVACIONES","Sección")')
          .not('materia', 'is', null)
          .order('clave'),
      ])

      const grupoIds = (gruposRes.data || []).map((g: any) => g.id)
      const { data: segMaterias } = grupoIds.length > 0
        ? await supabaseAdmin
            .from('seguimiento_materia')
            .select('*')
            .eq('docente_id', id)
            .eq('ciclo', '2027-1')
            .in('clave_id', grupoIds)
        : { data: [] }

      const segMap: Record<number, any> = {}
      for (const s of segMaterias || []) {
        segMap[s.clave_id] = s
      }

      const grupos = (gruposRes.data || []).map((g: any) => ({
        ...g,
        seguimiento: segMap[g.id] || null,
      }))

      let total = 0
      let completados = 0
      for (const g of grupos) {
        for (const c of CAMPOS_SEG) {
          total++
          if (g.seguimiento?.[c] === 'SI') completados++
        }
      }
      const porcentaje = total > 0 ? Math.round((completados / total) * 100) : 0

      return NextResponse.json({
        data: {
          ...docente,
          seguimiento: seguimientoRes.data || null,
          grupos,
          porcentaje,
        }
      })
    }

    // Lista de docentes
    let query = supabaseAdmin
      .from('docentes')
      .select('id, id_centro, nombre, correo_centro, forma_pago, tabulador')
      .order('nombre')

    if (busqueda) query = query.ilike('nombre', `%${busqueda}%`)

    const { data: docentes, error } = await query.limit(200)
    if (error) throw error

    const { data: claves } = await supabaseAdmin
      .from('claves')
      .select('id, docente')

    const conteoMap: Record<string, number> = {}
    for (const c of claves || []) {
      if (!conteoMap[c.docente]) conteoMap[c.docente] = 0
      conteoMap[c.docente]++
    }

    const { data: segMaterias } = await supabaseAdmin
      .from('seguimiento_materia')
      .select('docente_id, asistencia, temarios_oficina, temarios_bs, materiales_bibliografia, evaluacion_intermedia, evaluacion_final, publicacion_calificaciones')
      .eq('ciclo', '2027-1')

    const avanceMap: Record<number, { total: number; completados: number }> = {}
    for (const s of segMaterias || []) {
      if (!avanceMap[s.docente_id]) avanceMap[s.docente_id] = { total: 0, completados: 0 }
      for (const c of CAMPOS_SEG) {
        avanceMap[s.docente_id].total++
        if ((s as any)[c] === 'SI') avanceMap[s.docente_id].completados++
      }
    }

    const data = (docentes || []).map((d: any) => ({
      ...d,
      num_materias: conteoMap[d.nombre] || 0,
      porcentaje: avanceMap[d.id]
        ? Math.round((avanceMap[d.id].completados / avanceMap[d.id].total) * 100)
        : 0,
    }))

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { docente_id, clave_id, ciclo, ...campos } = body

    if (clave_id) {
      const { data, error } = await supabaseAdmin
        .from('seguimiento_materia')
        .upsert(
          { docente_id, clave_id, ciclo: ciclo || '2027-1', ...campos },
          { onConflict: 'docente_id,clave_id,ciclo' }
        )
        .select()
        .single()
      if (error) throw error
      return NextResponse.json({ ok: true, data })
    }

    const { data, error } = await supabaseAdmin
      .from('seguimiento_docente')
      .upsert(
        { docente_id, ciclo: ciclo || '2027-1', ...campos },
        { onConflict: 'docente_id,ciclo' }
      )
      .select()
      .single()
    if (error) throw error
    return NextResponse.json({ ok: true, data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { id, nombre } = await request.json()
    const { error } = await supabaseAdmin
      .from('docentes')
      .update({ nombre })
      .eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}