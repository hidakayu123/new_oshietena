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
    const { accounts } = useMsal();
    

    useEffect(() => {
        const fetchChatDetail = async () => {
            if (!id || accounts.length === 0) {
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                const client = useLogin ? msalInstance : undefined;
                const token = client ? await getToken(client) : undefined;
                
                const response = await fetch(`/api/history/${id}/`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                console.info(response)
                // ★★★↓ここからが重要↓★★★
                if (!response.ok) {
                    // エラーの場合、レスポンスのボディをテキストとして読み取る
                    const errorBody = await response.text();
                    // エラーの詳細をコンソールに出力
                    console.error("APIエラーの詳細:", {
                        status: response.status,
                        statusText: response.statusText,
                        body: errorBody
                    });
                    // 読み取ったエラー内容を含めて、より詳細なエラーを投げる
                    throw new Error(`API returned ${response.status}: ${errorBody}`);
                }
                // ★★★↑ここまで↑★★★

                const data = await response.json();
                setInitialAnswers(data);
                
            } catch (e) {
                console.error("fetchChatDetail関数でキャッチした最終的なエラー:", e); // このログも確認
                setInitialAnswers(null);
            } finally {
                setLoading(false);
            }
        };

        fetchChatDetail();
    }, [id, accounts]);

    if (loading) return <div>読み込み中...</div>;
    
    if (!initialAnswers) return <div>チャットが見つかりません</div>;
    console.info("履歴表示用", initialAnswers)
    // key={id} を渡すことで、異なる履歴に切り替わった際にChatコンポーネントを確実に再マウントさせる
    return <Chat key={id} initialAnswers={initialAnswers} />;
};

export default ChatWrapper;