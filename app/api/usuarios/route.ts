import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import bcrypt from 'bcryptjs'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('usuarios')
      .select('id, email, nombre, rol, licenciatura, created_at')
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message, details: JSON.stringify(error) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, nombre, rol, licenciatura } = body

    if (!email || !password || !nombre) {
      return NextResponse.json({ error: 'Faltan datos obligatorios' }, { status: 400 })
    }

    const hash = await bcrypt.hash(password, 10)

    const { data, error } = await supabaseAdmin
      .from('usuarios')
      .insert({
        email,
        password_hash: hash,
        nombre,
        rol: rol || 'profesor',
        licenciatura: licenciatura || null,
      })
      .select('id, email, nombre, rol, licenciatura')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message, details: JSON.stringify(error) }, { status: 400 })
    }

    return NextResponse.json({ ok: true, data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message, details: JSON.stringify(error) }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json()

    const { error } = await supabaseAdmin
      .from('usuarios')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}