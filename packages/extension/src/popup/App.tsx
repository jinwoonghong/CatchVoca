import { useState, useEffect } from 'react';
import { CollectTab } from './components/CollectTab';
import { QuizTab } from './components/QuizTab';
import { LibraryTab } from './components/LibraryTab';
import { SettingsTab } from './components/SettingsTab';
import { AIAnalysisTab } from './components/AIAnalysisTab';

type Tab = 'collect' | 'ai' | 'review' | 'library' | 'settings';

interface UserInfo {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('collect');
  const [currentUser, setCurrentUser] = useState<UserInfo | null>(null);

  // Load current user on mount
  useEffect(() => {
    checkCurrentUser();
  }, []);

  // Message handlers for tab switching and user updates
  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.type === 'SWITCH_TO_LIBRARY') {
        setActiveTab('library');
      } else if (message.type === 'SWITCH_TO_QUIZ') {
        setActiveTab('review');
      } else if (message.type === 'SWITCH_TO_SETTINGS') {
        setActiveTab('settings');
      } else if (message.type === 'SWITCH_TO_AI') {
        setActiveTab('ai');
      } else if (message.type === 'USER_SIGNED_IN' || message.type === 'USER_SIGNED_OUT') {
        // Refresh user info when auth state changes
        checkCurrentUser();
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  const checkCurrentUser = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_CURRENT_USER' });
      if (response.success && response.data) {
        setCurrentUser(response.data);
      } else {
        setCurrentUser(null);
      }
    } catch (err) {
      console.error('[App] Check user error:', err);
      setCurrentUser(null);
    }
  };

  return (
    <div className="w-full h-full bg-gray-50">
      {/* Header */}
      <header className="bg-primary-600 text-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">CatchVoca</h1>
            <p className="text-sm text-primary-100">Local-First 어휘 학습</p>
          </div>

          {/* User Status */}
          <div className="flex items-center gap-2">
            {currentUser ? (
              <button
                onClick={() => setActiveTab('settings')}
                className="flex items-center gap-2 px-3 py-1.5 bg-primary-700 hover:bg-primary-800 rounded-lg transition-colors"
                title={currentUser.email || '사용자'}
              >
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt="Profile"
                    className="w-6 h-6 rounded-full"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center text-xs">
                    {currentUser.email?.charAt(0).toUpperCase() || '?'}
                  </div>
                )}
                <span className="text-xs max-w-[120px] truncate">
                  {currentUser.displayName || currentUser.email || '사용자'}
                </span>
              </button>
            ) : (
              <button
                onClick={() => setActiveTab('settings')}
                className="px-3 py-1.5 bg-primary-700 hover:bg-primary-800 rounded-lg text-xs transition-colors"
              >
                로그인
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="flex">
          <TabButton
            active={activeTab === 'collect'}
            onClick={() => setActiveTab('collect')}
          >
            🔍 검색
          </TabButton>
          <TabButton
            active={activeTab === 'ai'}
            onClick={() => setActiveTab('ai')}
          >
            🤖 AI분석
          </TabButton>
          <TabButton
            active={activeTab === 'review'}
            onClick={() => setActiveTab('review')}
          >
            🎯 학습
          </TabButton>
          <TabButton
            active={activeTab === 'library'}
            onClick={() => setActiveTab('library')}
          >
            📚 단어장
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
        {activeTab === 'collect' && <CollectTab onSwitchToSettings={() => setActiveTab('settings')} />}
        {activeTab === 'ai' && <AIAnalysisTab onSwitchToSettings={() => setActiveTab('settings')} />}
        {activeTab === 'review' && <QuizTab onSwitchToSettings={() => setActiveTab('settings')} />}
        {activeTab === 'library' && <LibraryTab />}
        {activeTab === 'settings' && <SettingsTab onUserAuthChanged={checkCurrentUser} />}
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
      className={`flex-1 py-3 px-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
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
