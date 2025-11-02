import { useState, useEffect } from 'react';
import { CollectTab } from './components/CollectTab';
import { ReviewTab } from './components/ReviewTab';
import { LibraryTab } from './components/LibraryTab';
import { SettingsTab } from './components/SettingsTab';

type Tab = 'collect' | 'review' | 'library' | 'settings';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('collect');

  // Message handlers for tab switching
  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.type === 'SWITCH_TO_LIBRARY') {
        setActiveTab('library');
      } else if (message.type === 'SWITCH_TO_QUIZ') {
        setActiveTab('review');
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  return (
    <div className="w-full h-full bg-gray-50">
      {/* Header */}
      <header className="bg-primary-600 text-white p-4">
        <h1 className="text-xl font-bold">CatchVoca</h1>
        <p className="text-sm text-primary-100">Local-First 어휘 학습</p>
      </header>

      {/* Tab Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="flex">
          <TabButton
            active={activeTab === 'collect'}
            onClick={() => setActiveTab('collect')}
          >
            📝 수집
          </TabButton>
          <TabButton
            active={activeTab === 'review'}
            onClick={() => setActiveTab('review')}
          >
            🎯 복습
          </TabButton>
          <TabButton
            active={activeTab === 'library'}
            onClick={() => setActiveTab('library')}
          >
            📚 라이브러리
          </TabButton>
          <TabButton
            active={activeTab === 'settings'}
            onClick={() => setActiveTab('settings')}
          >
            ⚙️ 설정
          </TabButton>
        </div>
      </nav>

      {/* Content */}
      <main className="p-4">
        {activeTab === 'collect' && <CollectTab />}
        {activeTab === 'review' && <ReviewTab />}
        {activeTab === 'library' && <LibraryTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </main>
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function TabButton({ active, onClick, children }: TabButtonProps) {
  return (
    <button
      className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-primary-600 text-primary-600'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export default App;
