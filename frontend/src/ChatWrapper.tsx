import React, { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { getToken, useLogin, msalInstance } from "./authConfig";
import { useMsal } from "@azure/msal-react";
import Chat from "./pages/chat/Chat";
import type { InitialAnswerRaw } from "./api/models"; // 必要な型はこれだけになります
import styles from "./pages/chat/Chat.module.css";

const ChatWrapper = () => {
    const { id } = useParams<{ id: string }>();
    const [searchParams] = useSearchParams();
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
                const historyBoxId = searchParams.get('historyBoxId');

                const response = await fetch(`/api/history/${id}/?historyBoxId=${historyBoxId}`, {
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

    if (loading) {
    return (
        <div className={styles["spinner-container"]}>
            <div className={styles.spinner}></div>
        </div>
    );
    }

    if (!initialAnswers) return <div>チャットが見つかりません</div>;

    // ★★★★★★★★★★★★★★★★★★★★★★★★★
    // ★ ここのpropsも修正します ★
    // ★★★★★★★★★★★★★★★★★★★★★★★★★
    return <Chat initialAnswers={initialAnswers} targetId={id} />;
};

export default ChatWrapper;