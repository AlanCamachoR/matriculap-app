import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { supabaseAdmin } from '@/lib/supabase'
import bcrypt from 'bcryptjs'

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const { data: user, error } = await supabaseAdmin
          .from('usuarios')
          .select('*')
          .eq('email', credentials.email)
          .single()

        if (error || !user) return null

        const passwordMatch = await bcrypt.compare(credentials.password, user.password_hash)
        if (!passwordMatch) return null

        return {
          id: user.id,
          email: user.email,
          name: user.nombre,
          role: user.rol,
          licenciatura: user.licenciatura,
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role
        token.licenciatura = (user as any).licenciatura
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).licenciatura = token.licenciatura;
      }
      return session
    }
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
})

export { handler as GET, handler as POST }