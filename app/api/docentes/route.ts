import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const CAMPOS_SEG = ['asistencia', 'temarios_oficina', 'temarios_bs', 'evaluacion_intermedia', 'evaluacion_final', 'publicacion_calificaciones']

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
<<<<<<< HEAD
          .eq('docente', docente.nombre)
          .order('clave'),
      ])

      // Traer seguimiento por materia
      const grupoIds = (gruposRes.data || []).map(g => g.id)
      const { data: segMaterias } = grupoIds.length > 0
        ? await supabaseAdmin
            .from('seguimiento_materia')
            .select('*')
            .eq('docente_id', id)
            .eq('ciclo', '2027-1')
            .in('clave_id', grupoIds)
        : { data: [] }

      // Mapear seguimiento por clave_id
      const segMap: Record<number, any> = {}
      for (const s of segMaterias || []) {
        segMap[s.clave_id] = s
      }

      const grupos = (gruposRes.data || []).map(g => ({
        ...g,
        seguimiento: segMap[g.id] || null,
      }))

      // Calcular % de avance general
      const campos = ['asistencia', 'temarios_oficina', 'temarios_bs', 'materiales_bibliografia', 'evaluacion_intermedia', 'evaluacion_final', 'publicacion_calificaciones']
      let total = 0, completados = 0
      for (const g of grupos) {
        for (const c of campos) {
=======
          .ilike('docente', `%${docente.nombre}%`)
          .not('materia', 'in', '("Asignatura","OBSERVACIONES","Seccion")')
          .neq('materia', '')
          .order('clave'),
      ])

      const grupoIds = (gruposRes.data || []).map((g: any) => g.id)

      const [segMateriasRes, firmasRes] = await Promise.all([
        grupoIds.length > 0
          ? supabaseAdmin
              .from('seguimiento_materia')
              .select('*')
              .eq('docente_id', id)
              .eq('ciclo', '2027-1')
              .in('clave_id', grupoIds)
          : Promise.resolve({ data: [] }),
        grupoIds.length > 0
          ? supabaseAdmin
              .from('firmas')
              .select('clave_id')
              .in('clave_id', grupoIds)
          : Promise.resolve({ data: [] }),
      ])

      const firmasSet = new Set((firmasRes.data || []).map((f: any) => f.clave_id))

      const segMap: Record<number, any> = {}
      for (const s of segMateriasRes.data || []) {
        segMap[s.clave_id] = s
      }

      const grupos = (gruposRes.data || []).map((g: any) => {
        const seg = segMap[g.id] || null
        const tieneAcuse = firmasSet.has(g.id)
        return {
          ...g,
          seguimiento: {
            asistencia: seg?.asistencia || null,
            temarios_oficina: tieneAcuse ? 'SI' : (seg?.temarios_oficina || null),
            temarios_bs: seg?.temarios_bs || null,
            materiales_bibliografia: seg?.materiales_bibliografia || null,
            evaluacion_intermedia: seg?.evaluacion_intermedia || null,
            evaluacion_final: seg?.evaluacion_final || null,
            publicacion_calificaciones: seg?.publicacion_calificaciones || null,
          }
        }
      })

      let total = 0
      let completados = 0
      for (const g of grupos) {
        for (const c of CAMPOS_SEG) {
>>>>>>> 092a1fe9ce7c9257f9b4f3640358b581ea5cd3f6
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

<<<<<<< HEAD
    // Lista de docentes con conteo de materias y porcentaje
    let query = supabaseAdmin
      .from('docentes')
      .select('id, id_centro, nombre, correo_centro, forma_pago, tabulador')
      .order('nombre')
=======
    // Lista de docentes
    const [docentesRes, segMateriasRes, todasClavesRes, firmasRes] = await Promise.all([
      (() => {
        let q = supabaseAdmin
          .from('docentes')
          .select('id, id_centro, nombre, correo_centro, forma_pago, tabulador')
          .order('nombre')
          .limit(200)
        if (busqueda) q = q.ilike('nombre', `%${busqueda}%`)
        return q
      })(),
      supabaseAdmin
        .from('seguimiento_materia')
        .select('docente_id, asistencia, temarios_oficina, temarios_bs, evaluacion_intermedia, evaluacion_final, publicacion_calificaciones')
        .eq('ciclo', '2027-1'),
      supabaseAdmin
        .from('claves')
        .select('id, docente')
        .neq('docente', ''),
      supabaseAdmin
        .from('firmas')
        .select('clave_id'),
    ])
>>>>>>> 092a1fe9ce7c9257f9b4f3640358b581ea5cd3f6

    if (docentesRes.error) throw docentesRes.error

<<<<<<< HEAD
    const { data: docentes, error } = await query.limit(200)
    if (error) throw error
=======
    const docentes = docentesRes.data || []
    const segMaterias = segMateriasRes.data || []
    const todasClaves = todasClavesRes.data || []
    const firmasSet = new Set((firmasRes.data || []).map((f: any) => f.clave_id))

    const completadosMap: Record<number, number> = {}
    for (const s of segMaterias) {
      if (!completadosMap[s.docente_id]) completadosMap[s.docente_id] = 0
      for (const c of CAMPOS_SEG) {
        if ((s as any)[c] === 'SI') completadosMap[s.docente_id]++
      }
    }

    const data = docentes.map((d: any) => {
      if (!d.nombre) return { ...d, num_materias: 0, porcentaje: 0 }
      const nombreLower = d.nombre.toLowerCase()
      const misClaves = (todasClaves || []).filter(c =>
        c.docente != null && c.docente.toLowerCase().includes(nombreLower)
      )
      const numMaterias = misClaves.length
      const acusesExtra = misClaves.filter(c => firmasSet.has(c.id)).length
      const totalCompletados = (completadosMap[d.id] || 0) + acusesExtra
      const porcentaje = numMaterias > 0
        ? Math.round((totalCompletados / (numMaterias * CAMPOS_SEG.length)) * 100)
        : 0
      return { ...d, num_materias: numMaterias, porcentaje }
    })
>>>>>>> 092a1fe9ce7c9257f9b4f3640358b581ea5cd3f6

    // Contar materias por docente
    const { data: claves } = await supabaseAdmin
      .from('claves')
      .select('id, docente')

    const conteoMap: Record<string, number> = {}
    for (const c of claves || []) {
      if (!conteoMap[c.docente]) conteoMap[c.docente] = 0
      conteoMap[c.docente]++
    }

    // Traer seguimiento por materia para calcular % de avance
    const { data: segMaterias } = await supabaseAdmin
      .from('seguimiento_materia')
      .select('docente_id, asistencia, temarios_oficina, temarios_bs, materiales_bibliografia, evaluacion_intermedia, evaluacion_final, publicacion_calificaciones')
      .eq('ciclo', '2027-1')

    const campos = ['asistencia', 'temarios_oficina', 'temarios_bs', 'materiales_bibliografia', 'evaluacion_intermedia', 'evaluacion_final', 'publicacion_calificaciones']
    const avanceMap: Record<number, { total: number; completados: number }> = {}
    for (const s of segMaterias || []) {
      if (!avanceMap[s.docente_id]) avanceMap[s.docente_id] = { total: 0, completados: 0 }
      for (const c of campos) {
        avanceMap[s.docente_id].total++
        if (s[c] === 'SI') avanceMap[s.docente_id].completados++
      }
    }

    const data = (docentes || []).map(d => ({
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
<<<<<<< HEAD
=======

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
>>>>>>> 092a1fe9ce7c9257f9b4f3640358b581ea5cd3f6

    if (clave_id) {
      // Guardar seguimiento por materia
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

    // Guardar seguimiento general (legacy)
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