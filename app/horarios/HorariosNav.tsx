'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import Breadcrumb from '@/app/components/Breadcrumb'

const TABS_CONSULTA = [
  { href: '/horarios/grupo',      label: '👥 Por grupo' },
  { href: '/horarios/aula',       label: '🏫 Por aula' },
  { href: '/horarios/semana',     label: '📅 Por día' },
  { href: '/horarios/docente',    label: '👨‍🏫 Por docente' },
  { href: '/horarios/estudiante', label: '🎓 Por estudiante' },
  { href: '/horarios/franja',     label: '⏱ Por franja' },
  { href: '/horarios/materia',    label: '📚 Por materia' },
]

const TABS_PLAN = [
  { href: '/horarios/planeacion',                  label: '📋 Asignaturas' },
  { href: '/horarios/planeacion/plantillas',       label: '🗓️ Plantillas' },
  { href: '/horarios/planeacion/tabla',            label: '📋 Claves' },
  { href: '/horarios/planeacion/aula',             label: '🏫 Ocupación' },
  { href: '/horarios/planeacion/demanda',          label: '👥 Demanda' },
  { href: '/horarios/planeacion/dispersion',       label: '🔀 Dispersión' },
]

export default function HorariosNav({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const isPlan = path.startsWith('/horarios/planeacion')
  const tabs = isPlan ? TABS_PLAN : TABS_CONSULTA

  const tabActual = [...TABS_CONSULTA, ...TABS_PLAN].find(t => t.href === path)?.label.replace(/^[^\s]+\s/, '') || 'Horarios'

  const isWide = isPlan

  return (
    <div className="min-h-screen bg-gray-50">
      <Breadcrumb items={[{ label: 'Horarios', href: '/horarios/grupo' }, { label: tabActual }]} />
      <div className="bg-white border-b border-gray-200">
        <div className={`${isWide ? 'w-full px-6' : 'max-w-screen-xl mx-auto px-4'} flex items-center gap-0`}>
          {/* Selector de modo */}
          <div className="flex border-r border-gray-200 mr-3 pr-3 py-2 gap-1">
            <Link
              href="/horarios/grupo"
              className={`px-2.5 py-1 rounded text-xs font-semibold transition ${
                !isPlan ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-100'
              }`}
            >
              Consulta
            </Link>
            <Link
              href="/horarios/planeacion"
              className={`px-2.5 py-1 rounded text-xs font-semibold transition ${
                isPlan ? 'bg-gray-900 text-white' : 'text-gray-400 hover:bg-gray-100'
              }`}
            >
              Planeación 2027-2
            </Link>
          </div>

          <nav className="flex gap-1 py-2">
            {tabs.map(t => (
              <Link
                key={t.href}
                href={t.href}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  path === t.href
                    ? isPlan ? 'bg-gray-900 text-white' : 'bg-blue-600 text-white'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {t.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
      <main className={`${isWide ? 'w-full px-6' : 'max-w-screen-xl mx-auto px-4'} py-6`}>
        {children}
      </main>
    </div>
  )
}
