import React, { useState, useEffect } from 'react';
// CSSファイルは UiEditPrompt.css を使うと仮定します
import './UiEditPrompt.css'; 
import gearIcon from '../../assets/gear-icon.svg';
import { useLogin, getToken } from "../../authConfig";
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { v4 as uuidv4 } from "uuid";
// --- 型定義 ---

interface UserAccount {
  name: string;
  username: string;
}

interface Prompt {
  id: string | null | undefined;
  title: string;
  description: string;
}

interface UiEditPromptProps {
  user?: UserAccount;
}

// --- モックデータ ---
const MOCK_PROMPTS: Prompt[] = [
  { id: "1", title: 'ブログ記事のアイデア', description: '新しいブログ記事のアイデアを5個提案してください。' },
  { id: "2", title: 'メールの件名', description: '製品Aのプロモーションメールの件名を3パターン考えてください。' },
  { id: "3", title: 'コードのリファクタリング', description: '以下のPythonコードをリファクタリングしてください。' },
];

// --- メインコンポーネント ---
const UiEditPrompt: React.FC<UiEditPromptProps> = ({ user }) => {
  
  // --- パネル開閉ロジック ---
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const toggleSidebar = () => setIsOpen(prev => !prev);
  const closeSidebar = () => {
    setShowEditor(false);
    setIsOpen(false);
  };
      
  const [showEditor, setShowEditor] = useState(false);

  function openSettings() {
    setTimeout(() => {
      setShowEditor(false);
    }, 10); 
  }

  // --- プロンプト管理 ---
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);

  const [panelState, setpanelState] = useState('');
  const [panelMode, setPanelMode] = useState<'hidden' | 'partial' | 'full'>('hidden');
  const [applingPrompt, setapplingPrompt] = useState('');

  const client = useLogin ? useMsal().instance : undefined;

  useEffect(() => {
    setPanelMode('hidden');
    if (showEditor) {
      const timer = setTimeout(() => {
        setPanelMode('full');
        setpanelState('編集パネルを閉じる');
      }, 10); 

      // showEditor が false になったらタイマーをキャンセル
      return () => clearTimeout(timer);

    } else {
      requestAnimationFrame(() => {
        setPanelMode('partial');
        setpanelState('編集パネルを開く');
      }); 
    }
    // プロンプトモック
    setPrompts(MOCK_PROMPTS);
  }, [showEditor, isOpen]);


  // プロンプト取得表示
  useEffect(() => {
    const load = async () => {
      if (!client) return;
      const token = await getToken(client);
      if (!token) return;
      await fetchPromptsFromDB(token);
    };
    load();
  }, []);

  const fetchPromptsFromDB = async (token: string) => {
    try {
      const res = await fetch(`/api/getprompt/`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) throw new Error("Failed to fetch prompts");

      const data = await res.json();

      // --- 形式を合わせる ---
      const promptsFromDB: Prompt[] = data.map((p: any) => ({
        id: String(p.id),
        title: p.title ?? "",
        description: p.description ?? "",
      }));

      setPrompts(promptsFromDB);
      console.log("✅ Updated prompts from DB:", promptsFromDB);
    } catch (err) {
      console.error("❌ Failed to fetch prompts:", err);
    }
  };

  const handleApplyPrompt = (selectedPrompt: Prompt | null) => {
    if (selectedPrompt)
      setapplingPrompt(selectedPrompt.title);
      toggleSidebar();
      setShowEditor(false);
  };

  const handleSelectPrompt = (prompt: Prompt | null) => {
    if (selectedPrompt?.id === prompt?.id || null) {
      // 既に選択されているプロンプトをもう一度押した場合 → 選択解除
      setSelectedPrompt(null);
    } else {
      // それ以外は選択
      setSelectedPrompt(prompt);
    }
  };

  const handleSavePrompt = async (promptToSave: Prompt) => {
    const token = client ? await getToken(client) : undefined;
    const userId = client?.getActiveAccount()?.username || "unknown-user";
    const activeAccount = client?.getActiveAccount();
    const tenantId = activeAccount?.tenantId;
    let savedPrompt: Prompt;
    if (promptToSave.id) {
      console.log('Updating prompt:', promptToSave);
      setPrompts(prompts.map(p => p.id === promptToSave.id ? promptToSave : p));
      savedPrompt = promptToSave;
    } else {
      const newPrompt: Prompt = { ...promptToSave, id: uuidv4() };
      console.log('Creating new prompt:', newPrompt);
      setPrompts([...prompts, newPrompt]);
      setSelectedPrompt(newPrompt);
      savedPrompt = newPrompt;
    }
    // ✅ 更新・追加したものだけDBへ保存
    if (savedPrompt && token) {
      try {
        const res = await fetch(`/api/saveprompt/`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tenantId: tenantId,           // どこかで保持しているテナントID
            userId: userId,               // ログインユーザーID
            id: savedPrompt.id,           // 新規は uuid
            title: savedPrompt.title,
            description: savedPrompt.description,
          }),
        });

        if (!res.ok) throw new Error("Failed to save prompt");
        console.log("✅ Saved to DB:", savedPrompt);
        // --- 保存成功後：最新データを取得 ---
        await fetchPromptsFromDB(token);
      } catch (err) {
        console.error("❌ Save failed:", err);
        alert("保存に失敗しました");
        return;
      }
    }

    alert("保存しました！");
  };

  const handleDeletePrompt = async (promptId: string | null) => {
    if (!promptId || !window.confirm('本当に削除しますか？')) {
      return;
    }
    console.log('Deleting prompt with id:', promptId);
    setPrompts(prompts.filter(p => p.id !== promptId));
    setSelectedPrompt(null);
    alert('削除しました！');
  };

  

  return (
    <>
      {applingPrompt && (
        <button className="appling-prompt">
          {applingPrompt}
        </button>
      )}
      {/* 開閉ボタン */}
      <button
        className="settings-toggle-button"
        aria-label={isOpen ? 'メニューを閉じる' : 'メニューを開く'}
        onClick={() => {
          toggleSidebar();
          openSettings();
        }}
      >
        <img src={gearIcon} alt="設定" />
      </button>

      {/* オーバーレイ＋パネル */}
      {isOpen && (
        <>
          {/* オーバーレイ */}
          <div
            className="EditPrompt-overlay"
            onClick={closeSidebar} // オーバーレイの外クリックで閉じる
          />

          {/* パネル: 左側リスト + 右側エディタ */}
          <div className={`panel ${
            panelMode === 'partial' ? 'partial-open' :
            panelMode === 'full' ? 'full-open' : ''
          }`}>
              <div className="library">
                <PromptList
                  prompts={prompts}
                  selectedPrompt={selectedPrompt}
                  selectedPromptId={selectedPrompt ? selectedPrompt.id : null}
                  panelState={panelState}
                  onSelectPrompt={handleSelectPrompt}
                  onNewPrompt={() => handleApplyPrompt(selectedPrompt)}
                  onOpenEditor={() => setShowEditor(prev => !prev)}
                />
              </div>
            

            {/* 右側: エディタ */}
            <div className="editor-container">
                <PromptEditor
                  selectedPrompt={selectedPrompt}
                  onSave={handleSavePrompt}
                  onDelete={handleDeletePrompt}
                  setSelectedPrompt={handleSelectPrompt}
                />
            </div>
          </div>
        </>
      )}
    </>
  );
};

// --- サブコンポーネント ---

interface PromptListProps {
  prompts: Prompt[];
  selectedPrompt: Prompt | null;
  selectedPromptId: string | null | undefined;
  panelState: string;
  onSelectPrompt: (prompt: Prompt) => void;
  onNewPrompt: (prompt: Prompt | null) => void;
}

function PromptList({ prompts, selectedPrompt, selectedPromptId, panelState, onSelectPrompt, onNewPrompt, onOpenEditor }: PromptListProps & { onOpenEditor: () => void }) {
  return (
    <>
      <h2 style={{ padding: '10px 10px 0' }}>Prompt Library</h2>
      <button className="new-prompt-btn" onClick={() => onNewPrompt(selectedPrompt)}>
        適用
      </button>
      <div className="prompt-list">
        {prompts.map(prompt => (
          <div
            key={prompt.id}
            className={`prompt-list-item ${prompt.id === selectedPromptId ? 'selected' : ''}`}
            onClick={() => onSelectPrompt(prompt)}
          >
            {prompt.title}
          </div>
        ))}
      </div>
      
      <button className="open-editor-btn" onClick={onOpenEditor}>
        {panelState}
      </button>
    </>
  );
}

interface PromptEditorProps {
  selectedPrompt: Prompt | null;
  onSave: (prompt: Prompt) => void;
  onDelete: (promptId: string | null) => void;
  setSelectedPrompt: (prompt: Prompt | null) => void;
}

function PromptEditor({ selectedPrompt, onSave, onDelete, setSelectedPrompt }: PromptEditorProps) {
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<{ title?: string; description?: string }>({});

  useEffect(() => {
    if (selectedPrompt) {
      setTitle(selectedPrompt.title);
      setDescription(selectedPrompt.description);
      setErrors({}); 
    }
    else {
      // 初期画面用に空にする
      setTitle('');
      setDescription('');
      setErrors({}); 
    }
  }, [selectedPrompt]);

  const handleSaveClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    console.info("保存押下1");
    e.preventDefault();

    // 入力チェック
    const newErrors: typeof errors = {};
    if (!title.trim()) newErrors.title = "タイトルを入力してください";
    if (!description.trim()) newErrors.description = "プロンプトを入力してください";

    setErrors(newErrors);

    // 保存するプロンプトを作成
    if (Object.keys(newErrors).length === 0){
      const promptforDB: Prompt = selectedPrompt
        ? { ...selectedPrompt, title, description } // 既存プロンプトの更新
        : { id: uuidv4(), title, description };     // 新規プロンプト作成

      onSave(promptforDB); // 親コンポーネントに保存処理を渡す
    }

  };

  const handleDeleteClick = () => {
    if (!selectedPrompt || selectedPrompt.id == null) return;
    onDelete(selectedPrompt.id);
  };
  
  const handleNewClick = () => {
    setTitle('');
    setDescription('');
    setSelectedPrompt(null);
    setErrors({}); 
  };

  return (
    <div className="editor-container">
      <h2 className="editor-header">Edit Prompt</h2>

      {/* フォームは submit を使わず、ボタン単位で処理 */}
      <form className="editor-form" onSubmit={(e) => e.preventDefault()}>
        <label htmlFor="title">Title</label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={errors.title ? "input-error" : ""}
        />
        <span className="error-text">{errors.title || " "}</span>

        <label htmlFor="description">Prompt Description</label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={15}
          className={errors.description ? "input-error" : ""}
        />
        <span className="error-text">{errors.description || " "}</span>

        <div className="button-bar">
          {/* Delete ボタン */}
          <button
            type="button"
            className="delete-btn"
            onClick={handleDeleteClick}
            disabled={!selectedPrompt?.id}
          >
            Delete Prompt
          </button>
          
          {/* Save ボタン */}
          <button
            type="button"               // submit ではなく button
            className="save-btn"
            onClick={handleSaveClick}   // ここでのみ発火
          >
            Save Prompt
          </button>

          {/* New ボタン */}
          <button
            type="button"
            className="new-btn"
            onClick={handleNewClick}
          >
            New Prompt
          </button>
        </div>
      </form>
    </div>
  );
}

export default UiEditPrompt;
