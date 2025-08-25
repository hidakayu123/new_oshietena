import React, { useState, useEffect, useCallback } from 'react';
import './menu.css';
import { useMsal } from "@azure/msal-react";
import { getToken, useLogin } from "../frontend/src/authConfig";
import { useNavigate } from "react-router-dom"; 

// 型定義
type Props = {};
type UsageResponse = { count?: number | null; limit: number };
type ChatHistoryItem = { id: string; title: string };

const SidebarMenu: React.FC<Props> = () => {
  const navigate = useNavigate();
  const onSelectChat = (id: string) => {
      // 1. クリックされたIDを元に、history配列から該当するアイテムを探します
      const clickedItem = history.find(item => item.id === id);

      // 2. アイテムが見つからなかった場合は、念のため処理を中断します
      if (!clickedItem) {
          console.error("Clicked history item not found!");
          return;
      }

      console.log("【1. クリック検知】クリックされたアイテム:", clickedItem);

      // 3. URLの末尾に「# + 質問のタイトル」を追加してページを移動させます
      navigate(`/chat/${clickedItem.id}#${clickedItem.id}`);
  };
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const [usageCount, setUsageCount] = useState<UsageResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [history, setHistory] = useState<ChatHistoryItem[] | undefined>(undefined)
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const { instance: msalInstance, accounts } = useMsal();
  const client = useLogin ? msalInstance : undefined;

  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  // チャット履歴（summary）の他に、選択されたチャットの詳細データを別途取得したり
  // あるいは履歴の中に詳細があるならそちらを使う

  // 選択時に詳細を取得する例（fetchChatDetailは別途作成する想定）
  //const [selectedChatDetail, setSelectedChatDetail] = useState<ChatDetailType | null>(null);
  const [isChatLoading, setIsChatLoading] = useState(false);

  // --- 利用回数取得 ---
  const fetchUsageCount = useCallback(async () => {
    if (accounts.length === 0) {
      setError("認証されていません。");
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setIsHistoryLoading(true);
      const userId = accounts[0].username;
      const params = new URLSearchParams({ userId });
      console.log(" ✅✅✅✅✅:✅", params);
      const dbToken = client ? await getToken(client) : undefined;

      const response = await fetch(`/api/checkcount/?${params}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${dbToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error(`HTTPエラー: ${response.status}`);

      const data: UsageResponse = await response.json();
      setUsageCount(data);
      setError(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : "不明なエラー";
      setError(message);
      console.error("Usage count fetch failed:", e);
    } finally {
      setIsLoading(false);
    }
  }, [accounts]);



  // --- 履歴取得 ---
  const fetchHistory = useCallback(async () => {
    if (accounts.length === 0) {
      setHistoryError("認証されていません。");
      setIsHistoryLoading(false);
      return;
    }

    try {
      setIsHistoryLoading(true);
      const userId = accounts[0].username;
      if (!userId) throw new Error("userIdがアカウントに含まれていません。");

      const params = new URLSearchParams({ userId });
      console.log(" ✅✅✅✅✅:✅", params);
      const dbToken = client ? await getToken(client) : undefined;

      const response = await fetch(`/api/history/?${params}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${dbToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error(`HTTPエラー: ${response.status}`);

      const data: ChatHistoryItem[] = await response.json();
      console.log("✅ fetchHistory setHistorysetHistorysetHistory:", data); // これを追加
      setHistory(data);
      setHistoryError(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : "不明なエラー";
      setHistoryError(message);
      console.error("History fetch failed:", e);
    } finally {
      setIsHistoryLoading(false);
    }
  }, [accounts, client]);
  
    const onHamburgerClick = () => {
    setIsMenuOpen(!isMenuOpen)
    fetchUsageCount();  // 非同期関数を呼んでいるだけ（awaitは不要）
    fetchHistory();
  };

  // --- 利用回数表示用コンポーネント ---
  const UsageDisplay: React.FC = () => {
    if (!usageCount) return <div className="usage-display error">取得中</div>;

    return (
      <div className="usage-display">
        <span>今月の利用回数:</span>
        <strong style={{ marginLeft: '8px' }}>
          {usageCount.count ?? 0} / {usageCount.limit}
        </strong>
      </div>
    );
  };

  const handleNewChat = () => {
    navigate("/");        // ← ここで新しいチャット画面に遷移
    setIsMenuOpen(false);     // メニューを閉じる（任意）
  };

  
  // const onSelectChat = async (id: string) => {
  // setSelectedChatId(id);
  // setIsChatLoading(true);

  //   try {
  //     const dbToken = client ? await getToken(client) : undefined;

  //     const response = await fetch(`/api/history/${id}/`, {
  //       method: "GET",
  //       headers: {
  //         Authorization: `Bearer ${dbToken}`,
  //         'Content-Type': 'application/json',
  //       },
  //     });

  //     const data = await response.json();

  //     if (!response.ok) throw new Error("Failed to fetch chat detail");

  //     setSelectedChatDetail(data);  // ← 取得データを保存

  //   } catch (e) {
  //     console.error(e);
  //     setSelectedChatDetail(null);  // ← エラー時はnull
  //   } finally {
  //     setIsChatLoading(false);
  //   }
  // };


  // --- メニューUI ---
  return (
    <>
      <div className={`overlay ${isMenuOpen ? 'active' : ''}`} onClick={() => setIsMenuOpen(false)}></div>

      <button 
        className="hamburger-menu" 
        aria-label="メニューを開く" 
        onClick={onHamburgerClick}
      >
        <span></span><span></span><span></span>
      </button>

      <nav className={`sidebar ${isMenuOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <button className="new-chat-button" onClick={handleNewChat}>＋ 新規チャット開始</button>
        </div>

        <ul className="chat-history">
        {isHistoryLoading ? (
          <li>読み込み中...</li>
        ) : Array.isArray(history) && history.length > 0 ? (
          history.map((item: ChatHistoryItem) => (
            <li key={item.id}>
              {/* aタグをやめてボタンやspanに変更 */}
              <button className="chat-history-button" onClick={() => onSelectChat(item.id)}>
                {item.title}
              </button>
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
};

export default SidebarMenu;