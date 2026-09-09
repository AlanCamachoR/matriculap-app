import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import pool from '@/lib/db'

// publicacion_calificaciones se excluye del % hasta fin de semestre
const CAMPOS_SEG = ['asistencia', 'temarios_oficina', 'temarios_bs', 'materiales_bibliografia', 'evaluacion_intermedia']

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
        pool.query(
          `SELECT id, clave, materia, semestre, grupo, enlace, bloque FROM claves
           WHERE docente ILIKE $1
             AND materia NOT IN ('Asignatura','OBSERVACIONES','Seccion')
             AND materia <> ''
           ORDER BY clave`,
          [`%${docente.nombre}%`]
        ).then(r => ({ data: r.rows, error: null })),
      ])

      const todosGrupoIds = (gruposRes.data || []).map((g: any) => g.id)

      // Filtrar solo grupos con al menos un estudiante inscrito
      const { data: matriculasExisten } = todosGrupoIds.length > 0
        ? await supabaseAdmin
            .from('matricula')
            .select('clave_id')
            .in('clave_id', todosGrupoIds)
        : { data: [] }

      const clavesConAlumnos = new Set((matriculasExisten || []).map((m: any) => m.clave_id))
      const gruposAbiertos = (gruposRes.data || []).filter((g: any) => clavesConAlumnos.has(g.id))

      const grupoIds = gruposAbiertos.map((g: any) => g.id)

      // Clave base de cada grupo para buscar en secciones
      const clavesBases = [...new Set(gruposAbiertos.map((g: any) => {
        const p = g.clave.split('-'); return p.slice(0, -1).join('-')
      }))]
      const materiaMap: Record<string, string> = {}
      for (const g of gruposAbiertos) materiaMap[g.clave] = g.materia

      const [segMateriasRes, firmasRes, seccionesRes] = await Promise.all([
        grupoIds.length > 0
          ? supabaseAdmin
              .from('seguimiento_materia')
              .select('id, docente_id, clave_id, ciclo, asistencia, temarios_oficina, temarios_bs, materiales_bibliografia, evaluacion_intermedia, evaluacion_final, publicacion_calificaciones, observaciones')
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
        clavesBases.length > 0
          ? supabaseAdmin
              .from('secciones')
              .select('clave, seccion, salon')
              .in('clave', clavesBases)
              .eq('ciclo', '2027-1')
              .not('salon', 'is', null)
          : Promise.resolve({ data: [] }),
      ])

      const firmasSet = new Set((firmasRes.data || []).map((f: any) => f.clave_id))

      const segMap: Record<number, any> = {}
      for (const s of segMateriasRes.data || []) {
        segMap[s.clave_id] = s
      }

      // Fusionar filas con misma clave (ej. "Fotografía I | Salón" + "Fotografía I | Laboratorio")
      // Agrupar todos los ids por clave para revisar firmas/seguimiento en cualquiera de ellos
      const idsPorClave: Record<string, number[]> = {}
      for (const g of gruposAbiertos) {
        if (!idsPorClave[g.clave]) idsPorClave[g.clave] = []
        idsPorClave[g.clave].push(g.id)
      }

      const gruposMerged: any[] = []
      const vistoClave = new Set<string>()
      for (const g of gruposAbiertos) {
        if (vistoClave.has(g.clave)) continue
        vistoClave.add(g.clave)
        const todosIds = idsPorClave[g.clave] || [g.id]
        // Nombre limpio sin sufijo de aula
        const materiaNombre = g.materia.replace(/\s*\|\s*(Sal[oó]n|Laboratorio|Lab)$/i, '').trim()
        // Usar el seguimiento del primer id que tenga datos guardados
        const seg = todosIds.map(id => segMap[id]).find(s => s != null) || null
        // Acuse: vale SI si cualquiera de los ids tiene firma
        const tieneAcuse = todosIds.some(id => firmasSet.has(id))
        gruposMerged.push({
          ...g,
          materia: materiaNombre,
          bloque: g.bloque || null,
          seguimiento: {
            asistencia: seg?.asistencia || null,
            temarios_oficina: tieneAcuse ? 'SI' : (seg?.temarios_oficina || null),
            temarios_bs: seg?.temarios_bs || null,
            materiales_bibliografia: seg?.materiales_bibliografia || null,
            evaluacion_intermedia: seg?.evaluacion_intermedia || null,
            evaluacion_final: seg?.evaluacion_final || null,
            publicacion_calificaciones: seg?.publicacion_calificaciones || null,
            observaciones: seg?.observaciones || null,
          }
        })
      }
      const grupos = gruposMerged

      let total = 0
      let completados = 0
      for (const g of grupos) {
        if (g.bloque === '2') continue  // bloque 2 inicia en octubre, no cuenta aún
        for (const c of CAMPOS_SEG) {
          total++
          if (g.seguimiento?.[c] === 'SI') completados++
          else if (g.seguimiento?.[c] === 'A DESTIEMPO') completados += 0.8
          else if (g.seguimiento?.[c] === 'FALTA') completados += 0.5
        }
      }
      const porcentaje = total > 0 ? Math.round((completados / total) * 100) : 0

      // Construir tabla de horarios desde secciones
      const horarios: { clave: string; materia: string; salon: string }[] = []
      for (const s of seccionesRes.data || []) {
        const candidatos = [`${s.clave}-${s.seccion}`, `${s.clave}-${String(s.seccion).padStart(2, '0')}`]
        const claveCompleta = candidatos.find(k => materiaMap[k])
        if (claveCompleta) horarios.push({ clave: claveCompleta, materia: materiaMap[claveCompleta], salon: s.salon })
      }
      horarios.sort((a, b) => a.clave.localeCompare(b.clave))

      return NextResponse.json({
        data: {
          ...docente,
          seguimiento: seguimientoRes.data || null,
          grupos,
          porcentaje,
          horarios,
        }
      })
    }

    // Lista de docentes
    const [docentesRes, segMateriasRes, todasClavesRes, firmasRes, matriculaDistRes, segDocenteRes, sesionCoreRes] = await Promise.all([
      (() => {
        let q = supabaseAdmin
          .from('docentes')
          .select('id, id_centro, nombre, correo_centro, forma_pago, tabulador, etiqueta')
          .order('nombre')
          .limit(200)
        if (busqueda) q = q.ilike('nombre', `%${busqueda}%`)
        return q
      })(),
      supabaseAdmin
        .from('seguimiento_materia')
        .select('docente_id, clave_id, asistencia, temarios_oficina, temarios_bs, materiales_bibliografia, evaluacion_intermedia, publicacion_calificaciones')
        .eq('ciclo', '2027-1')
        .limit(10000),
      supabaseAdmin
        .from('claves')
        .select('id, clave, docente, bloque, materia')
        .neq('docente', '')
        .limit(20000),
      supabaseAdmin
        .from('firmas')
        .select('clave_id')
        .limit(10000),
      // clave_ids distintos que tienen al menos un alumno inscrito
      supabaseAdmin.rpc('distinct_clave_ids_con_alumnos'),
      supabaseAdmin
        .from('seguimiento_docente')
        .select('docente_id, primera_evaluacion_enviada')
        .eq('ciclo', '2027-1')
        .limit(500),
      pool.query(
        `SELECT id_docente,
                MIN(sesiones_por_clase) as min_sesiones,
                COUNT(DISTINCT clave_asignatura) as materias_registradas,
                COUNT(DISTINCT CASE WHEN sesiones_por_clase >= 4 THEN clave_asignatura END) as materias_al_dia
         FROM asistencias_core WHERE ciclo = '2027-1'
         GROUP BY id_docente`
      ),
    ])

    if (docentesRes.error) throw docentesRes.error

    const docentes = docentesRes.data || []
    const segMaterias = segMateriasRes.data || []
    const MATERIAS_EXCLUIDAS = new Set(['Asignatura', 'OBSERVACIONES', 'Seccion'])
    const todasClaves = (todasClavesRes.data || []).filter((c: any) =>
      c.materia && !MATERIAS_EXCLUIDAS.has(c.materia) && c.materia !== ''
    )
    const firmasSet = new Set((firmasRes.data || []).map((f: any) => f.clave_id))
    const clavesConAlumnos = new Set<number>((matriculaDistRes.data || []).map((r: any) => typeof r === 'object' ? r.distinct_clave_ids_con_alumnos : r))
    const correoEnviadoMap: Record<number, boolean> = {}
    for (const s of segDocenteRes.data || []) {
      correoEnviadoMap[s.docente_id] = !!s.primera_evaluacion_enviada
    }

    // sesion_status por id_centro (id_docente en Core = P000020111, id_centro = 20111)
    const sesionCoreMap: Record<string, { min_sesiones: number; materias_registradas: number; materias_al_dia: number }> = {}
    for (const row of (sesionCoreRes as any).rows || []) {
      sesionCoreMap[row.id_docente] = {
        min_sesiones: Number(row.min_sesiones),
        materias_registradas: Number(row.materias_registradas),
        materias_al_dia: Number(row.materias_al_dia),
      }
    }

    // Mapa anidado: docente_id → clave_id → seguimiento
    const segPorDocente: Record<number, Record<number, any>> = {}
    for (const s of segMaterias) {
      if (!segPorDocente[s.docente_id]) segPorDocente[s.docente_id] = {}
      segPorDocente[s.docente_id][s.clave_id] = s
    }

    // Agrupar ids por string de clave — solo los que tienen alumnos (período actual)
    const idsPorClaveStr: Record<string, number[]> = {}
    for (const c of todasClaves) {
      if (!c.clave || !clavesConAlumnos.has(c.id)) continue
      if (!idsPorClaveStr[c.clave]) idsPorClaveStr[c.clave] = []
      idsPorClaveStr[c.clave].push(c.id)
    }

    const data = docentes.map((d: any) => {
      if (!d.nombre) return { ...d, num_materias: 0, porcentaje: 0 }
      const nombreLower = d.nombre.toLowerCase()
      const segDeEsteDocente = segPorDocente[d.id] || {}
      // Solo claves con alumnos (igual que el detalle)
      const misClavesTodas = (todasClaves || []).filter(c =>
        c.docente != null && c.docente.toLowerCase().includes(nombreLower)
        && clavesConAlumnos.has(c.id)
      )
      // Deduplicar strings de clave (Salón + Lab aparecen como misma clave)
      const vistasClaves = new Set<string>()
      const misClaves = misClavesTodas.filter(c => {
        if (vistasClaves.has(c.clave)) return false
        vistasClaves.add(c.clave)
        return true
      })
      // Bloque 2 no cuenta en el % (inicia en octubre)
      const clavesParaPct = misClaves.filter(c => c.bloque !== '2')
      const numMaterias = clavesParaPct.length
      if (misClaves.length === 0) return { ...d, num_materias: 0, porcentaje: 0 }

      let totalSI = 0
      const camposPendientesSet = new Set<string>()
      for (const clave of clavesParaPct) {
        const todosIds = idsPorClaveStr[clave.clave] || [clave.id]
        const seg = todosIds.map(id => segDeEsteDocente[id]).find(s => s != null)
        const tieneAcuse = todosIds.some(id => firmasSet.has(id))
        for (const campo of CAMPOS_SEG) {
          let valor = seg?.[campo] || null
          if (campo === 'temarios_oficina' && tieneAcuse) valor = 'SI'
          if (valor === 'SI') totalSI++
          else if (valor === 'A DESTIEMPO') totalSI += 0.8
          else if (valor === 'FALTA') totalSI += 0.5
          if (valor !== 'SI') camposPendientesSet.add(campo)
        }
      }

      const porcentaje = numMaterias > 0 ? Math.round((totalSI / (numMaterias * CAMPOS_SEG.length)) * 100) : 0
      // sin_pendientes = ningún campo es null/NO/FALTA (solo SI o A DESTIEMPO)
      const sinPendientes = numMaterias > 0 && clavesParaPct.every(clave => {
        const todosIds2 = idsPorClaveStr[clave.clave] || [clave.id]
        const seg2 = todosIds2.map(id => segDeEsteDocente[id]).find((s: any) => s != null)
        const tieneAcuse2 = todosIds2.some(id => firmasSet.has(id))
        return CAMPOS_SEG.every(campo => {
          let v2 = seg2?.[campo] || null
          if (campo === 'temarios_oficina' && tieneAcuse2) v2 = 'SI'
          return v2 === 'SI' || v2 === 'A DESTIEMPO'
        })
      })
      const coreKey = Object.keys(sesionCoreMap).find(k => k.endsWith(String(d.id_centro)))
      const coreData = coreKey != null ? sesionCoreMap[coreKey] : null
      const sesion_status = coreData == null ? 'sin_registros' : coreData.min_sesiones >= 4 ? 'al_dia' : 'con_atrasos'
      const materias_al_dia = coreData?.materias_al_dia ?? 0
      return { ...d, num_materias: misClaves.length, porcentaje, sin_pendientes: sinPendientes, campos_pendientes: [...camposPendientesSet], correo_enviado: correoEnviadoMap[d.id] || false, sesion_status, materias_al_dia }
    })

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
      const cicloVal = ciclo || '2027-1'
      // Buscar si ya existe un registro
      const existing = await pool.query(
        `SELECT id FROM seguimiento_materia WHERE docente_id=$1 AND clave_id=$2 AND ciclo=$3`,
        [docente_id, clave_id, cicloVal]
      )
      if (existing.rows.length > 0) {
        // UPDATE
        const keys = Object.keys(campos)
        if (keys.length > 0) {
          const setClauses = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ')
          const vals = [...Object.values(campos), existing.rows[0].id]
          await pool.query(
            `UPDATE seguimiento_materia SET ${setClauses}, updated_at=now() WHERE id=$${vals.length}`,
            vals
          )
        }
      } else {
        // INSERT con siguiente id
        const maxRes = await pool.query('SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM seguimiento_materia')
        const nextId = maxRes.rows[0].next_id
        const allCampos = { id: nextId, docente_id, clave_id, ciclo: cicloVal, ...campos }
        const keys = Object.keys(allCampos)
        const vals = Object.values(allCampos)
        const placeholders = keys.map((_, i) => `$${i + 1}`)
        await pool.query(
          `INSERT INTO seguimiento_materia (${keys.map(k => `"${k}"`).join(', ')}) VALUES (${placeholders})`,
          vals
        )
      }
      return NextResponse.json({ ok: true })
    }

    const cicloVal = ciclo || '2027-1'
    const existing2 = await pool.query(
      `SELECT id FROM seguimiento_docente WHERE docente_id=$1 AND ciclo=$2`,
      [docente_id, cicloVal]
    )
    if (existing2.rows.length > 0) {
      const keys = Object.keys(campos)
      if (keys.length > 0) {
        const setClauses = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ')
        const vals = [...Object.values(campos), existing2.rows[0].id]
        await pool.query(
          `UPDATE seguimiento_docente SET ${setClauses} WHERE id=$${vals.length}`,
          vals
        )
      }
    } else {
      const maxRes2 = await pool.query('SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM seguimiento_docente')
      const nextId2 = maxRes2.rows[0].next_id
      const allCampos2 = { id: nextId2, docente_id, ciclo: cicloVal, ...campos }
      const keys = Object.keys(allCampos2)
      const vals = Object.values(allCampos2)
      const placeholders = keys.map((_, i) => `$${i + 1}`)
      await pool.query(
        `INSERT INTO seguimiento_docente (${keys.map(k => `"${k}"`).join(', ')}) VALUES (${placeholders})`,
        vals
      )
    }
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, docente_id, nombre, etiqueta } = body
    const targetId = id || docente_id
    const updates: Record<string, any> = {}
    if (nombre !== undefined) updates.nombre = nombre
    if (etiqueta !== undefined) updates.etiqueta = etiqueta
    const { error } = await supabaseAdmin
      .from('docentes')
      .update(updates)
      .eq('id', targetId)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { nombre, id_centro, correo_centro, correo_personal, contacto, forma_pago } = body
    if (!nombre) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })

    const maxRes = await pool.query('SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM docentes')
    const nextId = maxRes.rows[0].next_id

    const { data, error } = await supabaseAdmin
      .from('docentes')
      .insert({ id: nextId, nombre, id_centro: id_centro || null, correo_centro: correo_centro || null, correo_personal: correo_personal || null, contacto: contacto || null, forma_pago: forma_pago || 'Honorarios' })
      .select()
      .single()
    if (error) throw error
    return NextResponse.json({ ok: true, data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}