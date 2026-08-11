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
      .select('id, clave, semestre, materia, docente, licenciatura, grupo, enlace, bloque')

    if (clave_id) qClaves = qClaves.eq('id', clave_id)
    if (busqueda) qClaves = qClaves.or(`clave.ilike.%${busqueda}%,materia.ilike.%${busqueda}%,docente.ilike.%${busqueda}%`)
    if (semestre) qClaves = qClaves.eq('semestre', semestre)
    if (programa) qClaves = qClaves.eq('licenciatura', programa)

    const { data: claves, error: clavesError } = await qClaves
    if (clavesError) throw clavesError

    const claveIds = (claves || []).map(c => c.id)
    if (claveIds.length === 0) return NextResponse.json({ data: [] })

    // Extraer clave base (sin el número de grupo al final) y el grupo
    // EI101-25-1 → clave base = EI101-25, grupo = 1
    // EI101-25-10 → clave base = EI101-25, grupo = 10
    const clavesBaseSet = new Set<string>()
    const claveGrupoMap: Record<string, { base: string; grupo: string }> = {}

    for (const c of claves || []) {
      const partes = c.clave.split('-')
      const base = partes.slice(0, -1).join('-')
      const grupoStr = partes[partes.length - 1]
      clavesBaseSet.add(base)
      claveGrupoMap[c.clave] = { base, grupo: grupoStr }
    }

    const [matriculasRes, firmasRes, seccionesRes] = await Promise.all([
      supabaseAdmin
        .from('matricula')
        .select('id, estudiante_id, clave_id, estudiantes (id, id_centro, nombre, programa)')
        .in('clave_id', claveIds),
      supabaseAdmin
        .from('firmas')
        .select('clave_id, imagen_url, fecha'),
      supabaseAdmin
        .from('secciones')
        .select('clave, seccion, salon, brightspace, altas, bajas, fecha_inicio, fecha_fin')
        .in('clave', Array.from(clavesBaseSet))
        .eq('ciclo', '2027-1'),
    ])

    if (matriculasRes.error) throw matriculasRes.error

    const firmasMap: Record<number, { imagen_url: string; fecha: string }> = {}
    for (const f of firmasRes.data || []) {
      firmasMap[f.clave_id] = f
    }

    // Mapa de secciones por clave-grupo: "EI101-25-1" → seccion data
    const seccionesMap: Record<string, any> = {}
    for (const s of seccionesRes.data || []) {
      const key = `${s.clave}-${s.seccion}`
      seccionesMap[key] = s
    }

    const clavesMap: Record<number, any> = {}
    for (const c of claves || []) {
      const sec = seccionesMap[c.clave] || null
      clavesMap[c.id] = {
        ...c,
        salon: sec?.salon || null,
        brightspace: sec?.brightspace || c.enlace || null,
        altas: sec?.altas || 0,
        bajas: sec?.bajas || 0,
        estudiantes: [],
        firma: firmasMap[c.id] || null
      }
    }

    for (const m of matriculasRes.data || []) {
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