const BACKEND_URI = import.meta.env.VITE_BACKEND_URI || "";
import { getToken } from '../authConfig'; 
import { msalInstance } from '../authConfig';
import { ChatAppResponse, ChatAppResponseOrError, ChatAppRequest, Config, SimpleAPIResponse, HistoryListApiResponse, HistoryApiResponse } from "./models";

/**
 * DjangoのCSRFトークンをクッキーから取得するためのヘルパー関数
 * @param name クッキー名（通常は 'csrftoken'）
 * @returns トークンの文字列、またはnull
 */
function getCookie(name: string): string | null {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            // 探している名前で始まるクッキーか？ (例: "csrftoken=...")
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

export async function chatApi(request: ChatAppRequest, token: string | null): Promise<Response> {

    const csrfToken = getCookie('csrftoken');
    const headers = {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken || '' ,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    return await fetch('/api/chat/', {
        method: "POST",
        credentials: "include",
        headers: headers,
        body: JSON.stringify(request)
    });
}

export function getCitationFilePath(citation: string): string {
    return `${BACKEND_URI}/content/${citation}`;
}

// 保存する会話データの型を定義
interface ConversationData {
    userId: string;
    conversationId: string;
    question: string;
    answer: ChatAppResponse;
    tenantId?: string | null;
    historyBoxId?: string;
}

/**
 * 会話履歴をバックエンドAPI経由でCosmos DBに保存する関数
 * @param data 保存するデータ
 * @param token 認証トークン
 */
export async function saveConversationToDb(data: ConversationData, token: string | undefined): Promise<void> {
    // バックエンドに作成したAPIエンドポイントのURL
    const apiEndpoint = `/api/history/`;

    // 認証トークンがない場合は処理を中断
    if (!token) {
        console.warn("No token available. Skipping save to DB.");
        return;
    }

    try {
        const response = await fetch(apiEndpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            // API呼び出しが失敗した場合のエラーハンドリング
            console.log(response);
            const errorData = await response.json();
            throw new Error(errorData.message || "Failed to save conversation to DB");
        }

        console.log("Conversation saved successfully.");

    } catch (error) {
        console.error("Error saving conversation:", error);
        // ここでUIにエラー通知を出すなどの処理も可能
    }
}



/**
 * 認証・CSRF対策済みのPOSTリクエストをバックエンドに送信します。
 * @param url APIのエンドポイント (例: '/api/chat')
 * @param request 送信するデータオブジェクト
 * @param authToken バックエンドセッション用の認証トークン
 * @returns fetchのレスポンス
 */
export async function postApi(url: string, request: any, authToken: string | null) {
    // DjangoがセットしたCSRFトークンをクッキーから取得
    const csrfToken = getCookie('csrftoken');

    if (!authToken) {
        // 認証トークンがない場合はエラー（ログインしていない可能性）
        throw new Error("認証トークンがありません。ログインしていない可能性があります。");
    }
    
    if (!csrfToken) {
        // CSRFトークンが見つからない場合、警告を出す
        console.warn("CSRFトークンが見つかりません。DjangoへのPOSTリクエストは失敗する可能性があります。");
    }

    return await fetch(url, {
        method: "POST",
        headers: {
            'Content-Type': 'application/json',
            // 認証トークン（ログイン時にバックエンドから受け取ったもの）
            'Authorization': `Bearer ${authToken}`,
            // CSRFトークン（Djangoがクッキーにセットしたもの）
            'X-CSRFToken': csrfToken || '' // 見つからない場合は空文字を送る
        },
        body: JSON.stringify(request)
    });
}