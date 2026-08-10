import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const busqueda = searchParams.get('busqueda') || ''

  try {
    // Buscar estudiantes
    const { data: estudiantes, error: estError } = await supabaseAdmin
      .from('estudiantes')
      .select('id, id_centro, nombre, programa, curriculo')
      .or(`nombre.ilike.%${busqueda}%,id_centro.ilike.%${busqueda}%`)
      .limit(20)

    if (estError) throw estError
    if (!estudiantes || estudiantes.length === 0) return NextResponse.json({ data: [] })

    const estIds = estudiantes.map(e => e.id)

    // Obtener matrículas con claves
    const { data: matriculas, error: matError } = await supabaseAdmin
      .from('matricula')
      .select(`
        estudiante_id,
        clave_id,
        claves (id, clave, materia, docente, semestre, licenciatura)
      `)
      .in('estudiante_id', estIds)

    if (matError) throw matError

    // Obtener firmas individuales
    const { data: firmasInd } = await supabaseAdmin
      .from('firmas_estudiantes')
      .select('estudiante_id, clave_id, firmado')
      .in('estudiante_id', estIds)
      .eq('firmado', true)

    // Obtener acuses de grupo
    const { data: acuses } = await supabaseAdmin
      .from('firmas')
      .select('clave_id')

    const acusesSet = new Set((acuses || []).map(a => a.clave_id))
    const firmasIndSet = new Set((firmasInd || []).map(f => `${f.estudiante_id}_${f.clave_id}`))

    // Agrupar por estudiante
    const gruposMap: Record<number, any[]> = {}
    for (const m of matriculas || []) {
      if (!gruposMap[m.estudiante_id]) gruposMap[m.estudiante_id] = []
      const c = m.claves as any
      if (!c) continue

      const firmado =
        firmasIndSet.has(`${m.estudiante_id}_${m.clave_id}`) ||
        acusesSet.has(m.clave_id)

      gruposMap[m.estudiante_id].push({
        clave: c.clave,
        materia: c.materia,
        docente: c.docente,
        semestre: c.semestre,
        licenciatura: c.licenciatura,
        firmado,
      })
    }

    // Construir respuesta
    const data = estudiantes.map(e => ({
      ...e,
      grupos: (gruposMap[e.id] || []).sort((a: any, b: any) => a.clave.localeCompare(b.clave))
    }))

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}