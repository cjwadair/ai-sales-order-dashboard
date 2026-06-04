import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMoon, faSun } from '@fortawesome/free-solid-svg-icons'
import { useTheme } from '../contexts'

type PageHeaderProps = {
  title: string
  children?: React.ReactNode
}

export function PageHeader({ title, children }: PageHeaderProps) {
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="w-full dark:bg-neutral-900 py-2">
      <div className="page-row flex h-14 items-center justify-between">
        <div>
          <h2 className="text-xl text-neutral-800 font-medium tracking-tight dark:text-neutral-100">{title}</h2>
        </div>
        <div className="flex items-center gap-10">
          {children}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={toggleTheme}
              className="button-link gap-1.5 "
              aria-label="Toggle dark mode"
            >
              {theme === 'light'
                ? <FontAwesomeIcon icon={faMoon} className="text-lg" />
                : <FontAwesomeIcon icon={faSun} className="text-lg" />}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex flex-col gap-x-2 text-right text-base leading-4 dark:text-neutral-100">
              <div className="text-neutral-800 font-medium">Person Name</div>
              <div className="text-accent-700 text-sm dark:text-neutral-400">Company Name</div>
            </div>
            <div className="flex items-center rounded-full bg-accent-200 px-2 py-1 text-lg font-semibold text-accent-800 dark:bg-neutral-700 dark:text-neutral-100">PN</div>
          </div>
        </div>
      </div>
    </div>
  )
}

