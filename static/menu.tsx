import React, { useState, useEffect } from 'react'; // useEffectをインポート
import './menu.css';

// コンポーネントの型を定義
type Props = {};

// APIレスポンスの型を定義
type UsageResponse = {
  count: number;
  limit: number;
};

// チャット履歴アイテムの型を定義
type ChatHistoryItem = {
    id: string;
    title: string;
};


const SidebarMenu: React.FC<Props> = () => {
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  
  // --- 利用回数表示用のstate ---
  const [usageCount, setUsageCount] = useState<UsageResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true); // 初期状態は読み込み中
  const [error, setError] = useState<string | null>(null);

  // チャット履歴表示用のstateを追加
  const [history, setHistory] = useState<ChatHistoryItem[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState<boolean>(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

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

    // チャット履歴を取得する関数を追加
    const fetchHistory = async () => {
        setIsHistoryLoading(true);
        setHistoryError(null);
        try {
            // Djangoで作成したAPIエンドポイントを呼び出す
            const apiUrl = `${import.meta.env.VITE_API_URL}/get/history/`;
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error(`HTTPエラー: ${response.status}`);
            const data: { history: ChatHistoryItem[] } = await response.json();
            setHistory(data.history); // 取得した履歴をstateに保存
        } catch (e) {
            if (e instanceof Error) setHistoryError(e.message);
            else setHistoryError('不明なエラーが発生しました。');
            console.error('Failed to fetch history:', e);
        } finally {
            setIsHistoryLoading(false);
        }
    };

    fetchUsageCount(); 
    fetchHistory();

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
            {isHistoryLoading ? (
                <li>読み込み中...</li>
            ) : historyError ? (
                <li className="error">履歴の取得に失敗</li>
            ) : history.length > 0 ? (
                history.map(item => (
                    <li key={item.id}>
                        <a href={`/chat/${item.id}`}>{item.title}</a>
                    </li>
                ))
            ) : (
                <li>チャット履歴はありません</li>
            )}
        </ul>
        <div className="sidebar-footer">
          <UsageDisplay />
        </div>
      </nav>
    </>
  );
}

export default SidebarMenu;
