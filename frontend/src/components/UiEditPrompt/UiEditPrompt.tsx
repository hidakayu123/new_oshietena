import React, { useState, useEffect } from 'react';
// CSSファイルは UiEditPrompt.css を使うと仮定します
import './UiEditPrompt.css'; 
import gearIcon from '../../assets/gear-icon.svg';

// --- 型定義 ---

interface UserAccount {
  name: string;
  username: string;
}

interface Prompt {
  id: number | null;
  title: string;
  description: string;
}

interface UiEditPromptProps {
  user?: UserAccount;
}

// --- モックデータ ---
const MOCK_PROMPTS: Prompt[] = [
  { id: 1, title: 'ブログ記事のアイデア', description: '新しいブログ記事のアイデアを5個提案してください。' },
  { id: 2, title: 'メールの件名', description: '製品Aのプロモーションメールの件名を3パターン考えてください。' },
  { id: 3, title: 'コードのリファクタリング', description: '以下のPythonコードをリファクタリングしてください。' },
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
    setShowEditor(false);
  }

  // --- プロンプト管理 ---
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);

  const [panelClass, setPanelClass] = useState('');

 useEffect(() => {
  if (showEditor) {
    // showEditor が true になった時の処理
    const timer = setTimeout(() => {
      // この中身が実行される時点では showEditor は true
      setPanelClass('open'); 
    }, 10); 

    // showEditor が false になったらタイマーをキャンセル
    return () => clearTimeout(timer);

  } else {
    // showEditor が false になった時の処理 (タイマー不要)
    setPanelClass('');
  }
}, [showEditor]);

  useEffect(() => {
    setPrompts(MOCK_PROMPTS);
  }, []);

  const handleNewPrompt = () => {
    setSelectedPrompt({
      id: null,
      title: '',
      description: '',
    });
  };

  const handleSelectPrompt = (prompt: Prompt) => {
    setSelectedPrompt(prompt);
  };

  const handleSavePrompt = async (promptToSave: Prompt) => {
    if (promptToSave.id) {
      console.log('Updating prompt:', promptToSave);
      setPrompts(prompts.map(p => p.id === promptToSave.id ? promptToSave : p));
    } else {
      const newId = Math.max(...prompts.map(p => p.id || 0)) + 1;
      const newPrompt: Prompt = { ...promptToSave, id: newId };
      console.log('Creating new prompt:', newPrompt);
      setPrompts([...prompts, newPrompt]);
      setSelectedPrompt(newPrompt);
    }
    alert('保存しました！');
  };

  const handleDeletePrompt = async (promptId: number | null) => {
    if (!promptId || !window.confirm('本当に削除しますか？')) {
      return;
    }
    console.log('Deleting prompt with id:', promptId);
    setPrompts(prompts.filter(p => p.id !== promptId));
    setSelectedPrompt(null);
    alert('削除しました！');
  };

  const handleApplyPrompt = (prompt: Prompt) => {
    alert(`プロンプトを適用します:\n\n${prompt.description}`);
  };

  // エディタのクラス名
  const editPromptClass = `panel ${showEditor ? 'open' : ''}`;
  

  return (
    <>
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
          <div className={`panel ${panelClass}`} onClick={e => e.stopPropagation()}>
            {/* 左側: プロンプリスト */}
            {/* {showPromptList && ( */}
              <div className="library">
                <PromptList
                  prompts={prompts}
                  selectedPromptId={selectedPrompt ? selectedPrompt.id : null}
                  onSelectPrompt={handleSelectPrompt}
                  onNewPrompt={handleNewPrompt}
                  onOpenEditor={() => setShowEditor(true)}
                />
              </div>
            {/* )} */}
            

            {/* 右側: エディタ */}
            <div className="editor-container">
              {/* {showEditor && ( */}
                <PromptEditor
                  selectedPrompt={selectedPrompt}
                  onSave={handleSavePrompt}
                  onDelete={handleDeletePrompt}
                  onApply={handleApplyPrompt}
                  onClose={() => setShowEditor(false)}
                />
              {/* )} */}
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
  selectedPromptId: number | null;
  onSelectPrompt: (prompt: Prompt) => void;
  onNewPrompt: () => void;
}

function PromptList({ prompts, selectedPromptId, onSelectPrompt, onNewPrompt, onOpenEditor }: PromptListProps & { onOpenEditor: () => void }) {
  return (
    <>
      <h2 style={{ padding: '10px 10px 0' }}>Prompt Library</h2>
      <button className="new-prompt-btn" onClick={onNewPrompt}>
        + New Prompt
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
        📝 編集パネルを開く
      </button>
    </>
  );
}

interface PromptEditorProps {
  selectedPrompt: Prompt | null;
  onSave: (prompt: Prompt) => void;
  onDelete: (promptId: number | null) => void;
  onApply: (prompt: Prompt) => void;
  onClose: () => void;
}

function PromptEditor({ selectedPrompt, onSave, onDelete, onApply }: PromptEditorProps) {
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (selectedPrompt) {
      setTitle(selectedPrompt.title);
      setDescription(selectedPrompt.description);
    }
  }, [selectedPrompt]);

  if (!selectedPrompt) {
    return (
      <div className="editor-container">
        <div className="editor-placeholder">
          左のリストからプロンプトを選択するか、「+ New Prompt」で新規作成してください。
        </div>
      </div>
    );
  }

  const handleSaveClick = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...selectedPrompt,
      title: title,
      description: description,
    });
  };

  const handleDeleteClick = () => {
    onDelete(selectedPrompt.id);
  };
  
  const handleApplyClick = () => {
    onApply({ ...selectedPrompt, title, description });
  };

  return (
    <div className="editor-container">
      <h2 className="editor-header">Edit Prompt</h2>
      <form className="editor-form" onSubmit={handleSaveClick}>
        <label htmlFor="title">Title</label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        
        <label htmlFor="description">Prompt Description</label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={15}
        />

        <div className="button-bar">
          <button
            type="button"
            className="delete-btn"
            onClick={handleDeleteClick}
            disabled={!selectedPrompt.id}
          >
            Delete Prompt
          </button>
          
          <button type="submit" className="save-btn">
            Save Prompt
          </button>

          <button
            type="button"
            className="apply-btn"
            onClick={handleApplyClick}
          >
            Apply Prompt
          </button>
        </div>
      </form>
    </div>
  );
}

export default UiEditPrompt;
