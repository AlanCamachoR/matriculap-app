import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

export async function GET() {
  const hash = await bcrypt.hash('admin1234', 10)
  
  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .insert({
      email: 'admin@integrales.mx',
      password_hash: hash,
      nombre: 'Administrador',
      rol: 'admin',
      licenciatura: null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, user: data.email })
}