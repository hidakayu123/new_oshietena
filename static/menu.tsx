import React, { useState, useEffect } from 'react'; // useEffectをインポート
import './menu.css';

// コンポーネントの型を定義
type Props = {};

// APIレスポンスの型を定義
type UsageResponse = {
  count: number;
  limit: number;
};

const SidebarMenu: React.FC<Props> = () => {
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  
  // --- 利用回数表示用のstate ---
  const [usageCount, setUsageCount] = useState<UsageResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true); // 初期状態は読み込み中
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // データを非同期で取得する関数を定義
    const fetchUsageCount = async () => {
      try {
        const apiUrl = `${import.meta.env.VITE_API_URL}/checkcount`;
        const response = await fetch(apiUrl);

        if (!response.ok) {
          throw new Error(`HTTPエラー: ${response.status}`);
        }

        const data: UsageResponse = await response.json();
        setUsageCount(data); // 取得したデータをstateに保存

      } catch (e) {
        if (e instanceof Error) {
          setError(e.message);
        } else {
          setError('不明なエラーが発生しました。');
        }
        console.error('Failed to fetch usage count:', e);
      } finally {
        setIsLoading(false); // 読み込み完了（成功・失敗問わず）
      }
    };

    fetchUsageCount(); // 上で定義した関数を実行

  }, []); 
  
  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  // --- 利用回数を表示するためのUI要素 ---
  // 読み込み中、エラー、成功の状態で表示を切り替える
  const UsageDisplay = () => {
    if (isLoading) {
      return <div className="usage-display loading">利用回数を取得中...</div>;
    }
    if (error) {
      return <div className="usage-display error">DB未接続</div>;
    }
    if (usageCount) {
      return (
        <div className="usage-display">
          <span>今月の利用回数:</span>
          <strong style={{ marginLeft: '8px' }}>
            {usageCount.count} / {usageCount.limit}
          </strong>
        </div>
      );
    }
    return null; // データがない場合は何も表示しない
  };

  return (
    <>
      <div 
        className={`overlay ${isMenuOpen ? 'active' : ''}`}
        onClick={closeMenu}
      ></div>

      <button
        className="hamburger-menu"
        id="hamburger-menu"
        aria-label="メニューを開く"
        onClick={toggleMenu}
      >
        <span></span>
        <span></span>
        <span></span>
      </button>

      <nav 
        className={`sidebar ${isMenuOpen ? 'open' : ''}`} 
        id="sidebar"
      >
        <div className="sidebar-header">
          <button className="new-chat-button">＋ 新規チャット開始</button>
        </div>
        <ul className="chat-history">
          <li><a href="#">過去のチャットタイトル1</a></li>
          <li><a href="#">長めのチャットタイトルがここにはい...</a></li>
          <li><a href="#">過去のチャットタイトル3</a></li>
        </ul>
        <div className="sidebar-footer">
          <UsageDisplay />
        </div>
      </nav>
    </>
  );
}

export default SidebarMenu;
