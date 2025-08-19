import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getToken, useLogin, msalInstance } from "./authConfig";
import { useMsal } from "@azure/msal-react";
import Chat from "./pages/chat/Chat";
import type { InitialAnswerRaw } from "./api/models"; // 必要な型はこれだけになります

const ChatWrapper = () => {
    const { id } = useParams<{ id: string }>();
    // ★ 修正点1: Stateが<Chat>コンポーネントの期待する型を直接持つようにします
    const [initialAnswers, setInitialAnswers] = useState<InitialAnswerRaw[] | null>(null);
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

                if (!response.ok) {
                    const errorBody = await response.text();
                    throw new Error(`API returned ${response.status}: ${errorBody}`);
                }
               
                const data: InitialAnswerRaw[] = await response.json();
                setInitialAnswers(data);
                
            } catch (e) {
                console.error("fetchChatDetailでエラーをキャッチ:", e);
                setInitialAnswers(null);
            } finally {
                setLoading(false);
            }
        };

        fetchChatDetail();
    }, [id, accounts]);

    if (loading) return <div>読み込み中...</div>;
    
    if (!initialAnswers) return <div>チャットが見つかりません</div>;
    console.info("これでチャットに送る", initialAnswers)

    return <Chat key={id} initialAnswers={initialAnswers} />;
};

export default ChatWrapper;