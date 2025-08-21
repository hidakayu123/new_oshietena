import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getToken, useLogin, msalInstance } from "./authConfig";
import { useMsal } from "@azure/msal-react";
import Chat from "./pages/chat/Chat";
import type { InitialAnswerRaw } from "./api/models"; // 必要な型はこれだけになります

const ChatWrapper = () => {
    const { id } = useParams<{ id: string }>();
    const [initialAnswers, setInitialAnswers] = useState<InitialAnswerRaw[] | null>(null);
    const [loading, setLoading] = useState(true);
    const { accounts } = useMsal();

    // ★★★★★★★★★★★★★★★★★★★★★★★★★
    // ★ ここを修正します ★
    // ★★★★★★★★★★★★★★★★★★★★★★★★★
    // const fullHash = window.location.hash; // 例: "#/chat/some-conv-id#some-message-id"
    // const hashParts = fullHash.split('#'); // "#"で文字列を分割
    
    // // 分割後の配列の一番最後の要素が目的の「ID」になる
    // const idFromHash = hashParts.length > 1 ? hashParts[hashParts.length - 1] : null;
    // const targetId = idFromHash; // デコードは不要

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
                setInitialAnswers(data.reverse());

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

    // ★★★★★★★★★★★★★★★★★★★★★★★★★
    // ★ ここのpropsも修正します ★
    // ★★★★★★★★★★★★★★★★★★★★★★★★★
    return <Chat initialAnswers={initialAnswers} targetId={id} />;
};

export default ChatWrapper;