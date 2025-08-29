/**
 * @fileoverview Tab navigation component for stock detail sections
 * @description Provides accessible keyboard navigation between stock information tabs
 * @author Claude Code Quality Agent F
 * @version 1.0.0
 */

'use client';

import { useCallback, memo } from 'react';
import { TabId, TabItem } from '@/types/stock';

interface TabNavigationProps {
  /** Currently active tab ID */
  readonly activeTab: TabId;
  /** Array of available tabs */
  readonly tabs: readonly TabItem[];
  /** Callback function when tab changes */
  readonly onTabChange: (tabId: TabId) => void;
}

/**
 * Handles keyboard navigation for tab controls
 * 
 * @param event - Keyboard event
 * @param currentIndex - Current tab index
 * @param tabs - Array of available tabs
 * @param onTabChange - Callback when tab changes
 */
const handleTabKeyDown = (
  event: React.KeyboardEvent,
  currentIndex: number,
  tabs: readonly TabItem[],
  onTabChange: (tabId: TabId) => void
): void => {
  const tabIds = tabs.map(tab => tab.id);
  
  switch (event.key) {
    case 'ArrowLeft':
      event.preventDefault();
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : tabIds.length - 1;
      onTabChange(tabIds[prevIndex]!);
      break;
    case 'ArrowRight':
      event.preventDefault();
      const nextIndex = currentIndex < tabIds.length - 1 ? currentIndex + 1 : 0;
      onTabChange(tabIds[nextIndex]!);
      break;
    case 'Home':
      event.preventDefault();
      onTabChange(tabIds[0]!);
      break;
    case 'End':
      event.preventDefault();
      onTabChange(tabIds[tabIds.length - 1]!);
      break;
    case ' ':
    case 'Enter':
      event.preventDefault();
      onTabChange(tabIds[currentIndex]!);
      break;
  }
};

/**
 * Tab navigation component with full keyboard accessibility support
 * 
 * @param props - Component props
 * @param props.activeTab - Currently active tab ID
 * @param props.tabs - Array of available tabs
 * @param props.onTabChange - Callback function when tab changes
 * @returns JSX element representing the tab navigation
 * 
 * @example
 * ```tsx
 * <TabNavigation
 *   activeTab="overview"
 *   tabs={tabs}
 *   onTabChange={setActiveTab}
 * />
 * ```
 */
export const TabNavigation = memo<TabNavigationProps>(function TabNavigation({
  activeTab,
  tabs,
  onTabChange,
}) {
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent, index: number) => {
      handleTabKeyDown(event, index, tabs, onTabChange);
    },
    [tabs, onTabChange]
  );

  const handleTabClick = useCallback(
    (tabId: TabId) => {
      onTabChange(tabId);
    },
    [onTabChange]
  );

  return (
    <div className="border-b border-gray-200">
      <nav 
        className="flex space-x-8 px-6" 
        role="tablist"
        aria-label="Stock information sections"
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            onKeyDown={event => handleKeyDown(event, index)}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`tabpanel-${tab.id}`}
            id={`tab-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <span className="mr-2" aria-hidden="true">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
});

TabNavigation.displayName = 'TabNavigation';