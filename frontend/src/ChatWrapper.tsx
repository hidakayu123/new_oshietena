import React, { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { getToken, useLogin, msalInstance } from "./authConfig";
import { useMsal } from "@azure/msal-react";
import Chat from "./pages/chat/Chat";
import type { ChatAppResponse } from "./api/models";

// APIから受け取るデータの型を定義
interface ChatHistoryTurn {
    user: string;
    gpt: string;
}
interface HistoryItemFromDb {
    id: string;
    question: string;
    answer: string;
    chatHistory: ChatHistoryTurn[];
}

const ChatWrapper = () => {
    const { id } = useParams<{ id: string }>();
    
    const [initialAnswers, setInitialAnswers] = useState<[string, ChatAppResponse][] | null>(null);
    const [loading, setLoading] = useState(true);
    const { instance, accounts } = useMsal();
    const loadedIdRef = useRef<string | undefined>();

    useEffect(() => {
        const fetchChatDetail = async (fetchId: string) => {
            try {
                const client = useLogin ? msalInstance : undefined;
                const token = client ? await getToken(client) : undefined;
                
                const response = await fetch(`/api/history/${fetchId}/`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!response.ok) {
                    throw new Error(`チャットの取得に失敗しました: ${response.statusText}`);
                }

                const data: HistoryItemFromDb = await response.json();

                if (data.chatHistory && data.chatHistory.length > 0) {
                    const formattedAnswers: [string, ChatAppResponse][] = data.chatHistory.map(turn => {
                        return [
                            turn.user,
                            {
                                message: { content: turn.gpt, role: 'assistant' },
                                context: {}, session_state: null, delta: null
                            }
                        ];
                    });
                    setInitialAnswers(formattedAnswers);
                } else {
                    const formattedAnswers: [string, ChatAppResponse][] = [[
                        data.question,
                        {
                            message: { content: data.answer, role: 'assistant' },
                            context: {}, session_state: null, delta: null
                        }
                    ]];
                    setInitialAnswers(formattedAnswers);
                }
                
                loadedIdRef.current = fetchId;

            } catch (e) {
                console.error(e);
                setInitialAnswers(null);
            } finally {
                setLoading(false);
            }
        };

        // URLにIDがない場合 (新規チャット)
        if (!id) {
            setInitialAnswers([]);
            setLoading(false);
            loadedIdRef.current = undefined; // IDの記憶をリセット
            return;
        }

        // --- ★★★ ここが最終修正の核心 ★★★ ---
        // 既に読み込み済みのIDと同じであれば、何もしない
        if (loadedIdRef.current === id) {
            // ただし、ローディング状態は必ずfalseにしておく
            if (loading) setLoading(false);
            return;
        }

        // 新しいIDに切り替わったので、一度Stateをリセットしてローディングを開始する
        setLoading(true);
        setInitialAnswers(null); // ← これが調理台を空にする処理

        fetchChatDetail(id);

    }, [id, accounts, loading]); // loadingを依存配列に追加

    if (loading) return <div>読み込み中...</div>;
    
    if (!initialAnswers) return <div>チャットが見つかりません</div>;
    
    return <Chat key={id} initialAnswers={initialAnswers} />;
};

export default ChatWrapper;