import { BarChart3, DatabaseZap, FileInput, FolderArchive, Moon, Scale, Sun } from 'lucide-react'

interface NavbarProps {
  currentSection: 'input' | 'output' | 'analysis' | 'case-pack'
  onSectionChange: (section: 'input' | 'output' | 'analysis' | 'case-pack') => void
  darkMode: boolean
  onToggleDarkMode: () => void
}

export default function Navbar({ currentSection, onSectionChange, darkMode, onToggleDarkMode }: NavbarProps) {
  const sections = [
    { id: 'input' as const, label: '調證信息錄入', icon: FileInput },
    { id: 'output' as const, label: '調證結果輸出', icon: DatabaseZap },
    { id: 'analysis' as const, label: '案件數據分析', icon: BarChart3 },
    { id: 'case-pack' as const, label: '案件整理打包', icon: FolderArchive },
  ]

  return (
    <nav className="navbar-glass">
      <div className="container mx-auto px-3 sm:px-6">
        <div className="flex items-center justify-between h-16 sm:h-20">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="p-1.5 sm:p-2 rounded-xl bg-black/35 dark:bg-black/45 shadow-lg border border-white/15">
              <Scale className="w-4 h-4 sm:w-6 sm:h-6 text-gray-200" />
            </div>
            <div>
              <span className="text-base sm:text-xl font-bold text-gray-800 dark:text-gray-100 block">
                司法調證工具
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-500">v2.2</span>
            </div>
          </div>

          <div className="flex items-center space-x-1 sm:space-x-2">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => onSectionChange(section.id)}
                className={`px-2 sm:px-5 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-base font-medium transition-all duration-200
                  ${
                    currentSection === section.id
                      ? 'bg-black/45 dark:bg-black/55 text-gray-100 shadow-lg shadow-black/30 border border-white/20'
                      : 'bg-white/30 dark:bg-zinc-900/45 text-slate-700 dark:text-slate-300 hover:bg-white/45 dark:hover:bg-zinc-800/55 border border-white/25 dark:border-white/10'
                  } backdrop-blur-sm`}
              >
                <section.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2 inline-block align-middle" />
                <span className="hidden sm:inline">{section.label}</span>
              </button>
            ))}
            
            <button
              onClick={onToggleDarkMode}
              className="p-2 sm:p-3 rounded-lg sm:rounded-xl bg-white/30 dark:bg-zinc-900/45 
                       hover:bg-white/45 dark:hover:bg-zinc-800/55
                       border border-white/25 dark:border-white/10
                       backdrop-blur-sm transition-all duration-200
                       hover:scale-105 active:scale-95"
              title={darkMode ? '切換淺色模式' : '切換深色模式'}
            >
              {darkMode ? (
                <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300" />
              ) : (
                <Moon className="w-4 h-4 sm:w-5 sm:h-5 text-slate-700" />
              )}
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
