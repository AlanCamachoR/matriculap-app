import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const busqueda = searchParams.get('busqueda') || ''
  const programa = searchParams.get('programa') || ''
  const semestre = searchParams.get('semestre') || ''
  const clave_id = searchParams.get('clave_id') || ''

  try {
    let qClaves = supabaseAdmin
      .from('claves')
      .select('id, clave, semestre, materia, docente, licenciatura, grupo')

    if (clave_id) qClaves = qClaves.eq('id', clave_id)
    if (busqueda) qClaves = qClaves.or(`clave.ilike.%${busqueda}%,materia.ilike.%${busqueda}%,docente.ilike.%${busqueda}%`)
    if (semestre) qClaves = qClaves.eq('semestre', semestre)
    if (programa) qClaves = qClaves.eq('licenciatura', programa)

    const { data: claves, error: clavesError } = await qClaves
    if (clavesError) throw clavesError

    const claveIds = (claves || []).map(c => c.id)
    if (claveIds.length === 0) return NextResponse.json({ data: [] })

    const { data: matriculas, error: matError } = await supabaseAdmin
      .from('matricula')
      .select('id, estudiante_id, clave_id, estudiantes (id, id_centro, nombre, programa)')
      .in('clave_id', claveIds)
    if (matError) throw matError

    const { data: firmas } = await supabaseAdmin
      .from('firmas')
      .select('clave_id, imagen_url, fecha')

    const firmasMap: Record<number, { imagen_url: string; fecha: string }> = {}
    for (const f of firmas || []) {
      firmasMap[f.clave_id] = f
    }

    const clavesMap: Record<number, any> = {}
    for (const c of claves || []) {
      clavesMap[c.id] = { ...c, estudiantes: [], firma: firmasMap[c.id] || null }
    }
    for (const m of matriculas || []) {
      if (clavesMap[m.clave_id]) {
        clavesMap[m.clave_id].estudiantes.push(m.estudiantes)
      }
    }

    const data = Object.values(clavesMap).sort((a: any, b: any) => a.clave.localeCompare(b.clave))
    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}