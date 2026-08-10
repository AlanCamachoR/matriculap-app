import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const imagen = formData.get('imagen') as File
    const clave_id = formData.get('clave_id') as string
    const registrado_por = formData.get('registrado_por') as string

    if (!imagen || !clave_id) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    }

    const extension = imagen.name.split('.').pop()
    const filename = `acuse_${clave_id}_${Date.now()}.${extension}`
    const arrayBuffer = await imagen.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    const { error: uploadError } = await supabaseAdmin.storage
      .from('Firmas')
      .upload(filename, buffer, { contentType: imagen.type, upsert: true })

    if (uploadError) throw uploadError

    const { data: urlData } = supabaseAdmin.storage
      .from('Firmas')
      .getPublicUrl(filename)

    const { data, error } = await supabaseAdmin
      .from('firmas')
      .upsert({
        clave_id: parseInt(clave_id),
        imagen_url: urlData.publicUrl,
        registrado_por,
        fecha: new Date().toISOString(),
      }, { onConflict: 'clave_id' })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ ok: true, data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('firmas')
      .select('clave_id, imagen_url, fecha')
    if (error) throw error
    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}