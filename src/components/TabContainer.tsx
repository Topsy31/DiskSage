import { ReactNode } from 'react'

export type TabId = 'explore' | 'by-risk' | 'marked'

interface Tab {
  id: TabId
  label: string
  count?: number
}

interface TabContainerProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  tabs: Tab[]
  children: ReactNode
}

export default function TabContainer({ activeTab, onTabChange, tabs, children }: TabContainerProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-white flex-shrink-0">
        <div className="flex gap-1 px-4">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                px-4 py-3 text-sm font-medium border-b-2 transition-colors
                ${activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }
              `}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`
                  ml-2 px-2 py-0.5 text-xs rounded-full
                  ${activeTab === tab.id
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600'
                  }
                `}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  )
}
