// ChatWrapper.tsx

import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getToken, useLogin, msalInstance } from "./authConfig"; // パスは要確認
import { useMsal } from "@azure/msal-react";
import Chat from "./pages/chat/Chat";
import type { ChatAppResponse, HistoryItemFromDb } from "./api/models";

const ChatWrapper = () => {
    const { id } = useParams<{ id: string }>();
    // Stateの名前を、渡すデータの形式に合わせて変更
    const [initialAnswers, setInitialAnswers] = useState<[string, ChatAppResponse][] | null>(null);
    const [loading, setLoading] = useState(true);
    const { instance, accounts } = useMsal();

    useEffect(() => {
        const fetchChatDetail = async () => {
            if (!id || accounts.length === 0) return;

            try {
                const client = useLogin ? msalInstance : undefined;
                const token = client ? await getToken(client) : undefined;
                
                // APIエンドポイントの末尾にスラッシュを追加
                const response = await fetch(`/api/history/${id}/`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                console.log("【2. 変換処理開始】受け取った生データ:", response);

                if (!response.ok) {
                    throw new Error(`チャットの取得に失敗しました: ${response.statusText}`);
                }

                const data: HistoryItemFromDb = await response.json();
                
                // --- ★★★ ここでデータの「翻訳」を行う ★★★ ---
                const formattedAnswers: [string, ChatAppResponse][] = [
                    [
                        data.question, // ユーザーの質問
                        { // AIの回答。文字列からオブジェクト形式に変換
                            message: {
                                content: data.answer,
                                role: 'assistant'
                            },
                            // 他のプロパティはデフォルト値を設定
                            context: {}, 
                            session_state: null,
                            delta: null
                        }
                    ]
                ];
                
                setInitialAnswers(formattedAnswers);

            } catch (e) {
                console.error(e);
                setInitialAnswers(null); // エラー時はnullをセット
            } finally {
                setLoading(false);
            }
        };

        fetchChatDetail();
    }, [id, accounts]);

    if (loading) return <div>読み込み中...</div>;
    // initialAnswersがnullまたは空配列の場合にエラー表示
    if (!initialAnswers || initialAnswers.length === 0) return <div>チャットが見つかりません</div>;
    console.log("【3. 変換後のデータ】UI用の形式:", initialAnswers);
    // Chatコンポーネントに、初期値として整形済みのデータを渡す
    return <Chat initialAnswers={initialAnswers} />;
};

export default ChatWrapper;