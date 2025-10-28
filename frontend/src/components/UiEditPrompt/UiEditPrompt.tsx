// UiEditPrompt.tsx
import React, { useState } from 'react';
import './UiEditPrompt.css'; // CSSをインポート
import gearIcon from '../../assets/gear-icon.svg';

// --- 型定義 (変更なし) ---
interface UserAccount {
  name: string;
  username: string;
}

interface UiEditPromptProps {
  children?: React.ReactNode;
  user?: UserAccount;
}

const UiEditPrompt: React.FC<UiEditPromptProps> = ({ children, user }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const toggleSidebar = () => setIsOpen(prev => !prev);
  const closeSidebar = () => setIsOpen(false);

  return (
    <>
      <button
        className="settings-toggle-button" // 新しいCSSクラス名
        aria-label={isOpen ? 'メニューを閉じる' : 'メニューを開く'}
        onClick={toggleSidebar}
      >
        <img 
          src={gearIcon} 
          alt="設定" 
        />
      </button>


      {/* --- オーバーレイとパネル (クラス名をCSSと合わせる) --- */}
      <div
        className={`EditPrompt-overlay ${isOpen ? 'open' : ''}`}
        onClick={closeSidebar}
      />

      {/* クラス名を 'EditPrompt' にします */}
      <div className={`EditPrompt ${isOpen ? 'open' : ''}`}>
        <div className="EditPrompt-content">
          
          {/* ユーザー情報 (変更なし) */}
          {user ? (
            <div className="user-profile">
              <p>ようこそ、<strong>{user.name}</strong> さん</p>
              <p>({user.username})</p>
            </div>
          ) : (
            <p>権限がありません</p>
          )}

          <hr />

          {/* children (変更なし) */}
          {children}
          
        </div>
      </div>
    </>
  );
};

export default UiEditPrompt;