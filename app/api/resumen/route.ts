import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    // Obtener todos los estudiantes con su programa
    const { data: estudiantes, error: estError } = await supabaseAdmin
      .from('estudiantes')
      .select('id, nombre, programa')

    if (estError) throw estError

    // Obtener todas las matrículas
    const { data: matriculas, error: matError } = await supabaseAdmin
      .from('matricula')
      .select('estudiante_id, clave_id')

    if (matError) throw matError

    // Obtener firmas individuales
    const { data: firmas, error: firError } = await supabaseAdmin
      .from('firmas_estudiantes')
      .select('estudiante_id, clave_id, firmado')
      .eq('firmado', true)

    if (firError) throw firError

    // Obtener claves con acuse completo
    const { data: acuses, error: acError } = await supabaseAdmin
      .from('firmas')
      .select('clave_id')

    if (acError) throw acError

    // Set de claves con acuse
    const clavesConAcuse = new Set((acuses || []).map(a => a.clave_id))

    // Set de estudiantes firmados individualmente
    const estudiantesFirmados = new Set(
      (firmas || []).map(f => `${f.estudiante_id}_${f.clave_id}`)
    )

    // Mapa de estudiante -> programa
    const estMap: Record<number, string> = {}
    for (const e of estudiantes || []) {
      estMap[e.id] = e.programa || 'Sin programa'
    }

    // Agrupar por programa
    const programaMap: Record<string, { total: Set<number>; firmados: Set<number> }> = {}

    for (const m of matriculas || []) {
      const programa = estMap[m.estudiante_id] || 'Sin programa'
      if (!programaMap[programa]) {
        programaMap[programa] = { total: new Set(), firmados: new Set() }
      }
      programaMap[programa].total.add(m.estudiante_id)

      // Firmado si tiene firma individual O si el grupo tiene acuse completo
      const tieneFirmaIndividual = estudiantesFirmados.has(`${m.estudiante_id}_${m.clave_id}`)
      const grupoTieneAcuse = clavesConAcuse.has(m.clave_id)

      if (tieneFirmaIndividual || grupoTieneAcuse) {
        programaMap[programa].firmados.add(m.estudiante_id)
      }
    }

    // Convertir a array
    const data = Object.entries(programaMap).map(([programa, stats]) => ({
      programa,
      total: stats.total.size,
      firmados: stats.firmados.size,
      pendientes: stats.total.size - stats.firmados.size,
      porcentaje: stats.total.size > 0 ? Math.round((stats.firmados.size / stats.total.size) * 100) : 0
    })).sort((a, b) => a.programa.localeCompare(b.programa))

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}