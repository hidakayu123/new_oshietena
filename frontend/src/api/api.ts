const BACKEND_URI = import.meta.env.VITE_BACKEND_URI || "";
import { getToken } from '../authConfig'; 
import { msalInstance } from '../authConfig';
import { ChatAppResponse, ChatAppResponseOrError, ChatAppRequest, Config, SimpleAPIResponse, HistoryListApiResponse, HistoryApiResponse } from "./models";
// import { useLogin, getToken, isUsingAppServicesLogin } from "../authConfig";

// export async function getHeaders(idToken: string | undefined): Promise<Record<string, string>> {
//     // If using login and not using app services, add the id token of the logged in account as the authorization
//     if (useLogin && !isUsingAppServicesLogin) {
//         if (idToken) {
//             return { Authorization: `Bearer ${idToken}` };
//         }
//     }

//     return {};
// }

// export async function configApi(): Promise<Config> {
//     const response = await fetch(`${BACKEND_URI}/config`, {
//         method: "GET"
//     });

//     return (await response.json()) as Config;
// }

// export async function askApi(request: ChatAppRequest, idToken: string | undefined): Promise<ChatAppResponse> {
//     const headers = await getHeaders(idToken);
//     const response = await fetch(`${BACKEND_URI}/ask`, {
//         method: "POST",
//         headers: { ...headers, "Content-Type": "application/json" },
//         body: JSON.stringify(request)
//     });

//     if (response.status > 299 || !response.ok) {
//         throw Error(`Request failed with status ${response.status}`);
//     }
//     console.log(response);
//     const parsedResponse: ChatAppResponseOrError = await response.json();
//     if (parsedResponse.error) {
//         throw Error(parsedResponse.error);
//     }

//     return parsedResponse as ChatAppResponse;
// }

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
    
    // 1. MSALから認証トークンを取得する
    // const authToken = localStorage.getItem('accessToken');
    // if (!authToken) {
    //     // トークンが取得できない場合は、認証エラーとして処理を中断する
    //     throw new Error("User is not authenticated. Token could not be retrieved.");
    // }

    // 2. DjangoのためのCSRFトークンをクッキーから取得する
    const csrfToken = getCookie('csrftoken');
    //console.log("Found CSRF Token:", csrfToken);
    const headers = {
        'Content-Type': 'application/json',
        //'Authorization': `Bearer ${authToken}`, // この行が重要
        'X-CSRFToken': csrfToken || '' ,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    // 3. ヘッダー付きでAPI呼び出しを行う
    return await fetch('/api/chat/', {
        method: "POST",
        credentials: "include",
        headers: headers,
        body: JSON.stringify(request)
    });
}

export async function getSpeechApi(text: string): Promise<string | null> {
    return await fetch("/speech", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            text: text
        })
    })
        .then(response => {
            if (response.status == 200) {
                return response.blob();
            } else if (response.status == 400) {
                console.log("Speech synthesis is not enabled.");
                return null;
            } else {
                console.error("Unable to get speech synthesis.");
                return null;
            }
        })
        .then(blob => (blob ? URL.createObjectURL(blob) : null));
}

export function getCitationFilePath(citation: string): string {
    return `${BACKEND_URI}/content/${citation}`;
}

export async function uploadFileApi(request: FormData, idToken: string): Promise<SimpleAPIResponse> {
    const response = await fetch("/upload", {
        method: "POST",
        headers: await getHeaders(idToken),
        body: request
    });

    if (!response.ok) {
        throw new Error(`Uploading files failed: ${response.statusText}`);
    }
console.log(response);
    const dataResponse: SimpleAPIResponse = await response.json();
    return dataResponse;
}

export async function deleteUploadedFileApi(filename: string, idToken: string): Promise<SimpleAPIResponse> {
    const headers = await getHeaders(idToken);
    const response = await fetch("/delete_uploaded", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ filename })
    });

    if (!response.ok) {
        throw new Error(`Deleting file failed: ${response.statusText}`);
    }
console.log(response);
    const dataResponse: SimpleAPIResponse = await response.json();
    return dataResponse;
}

export async function listUploadedFilesApi(idToken: string): Promise<string[]> {
    const response = await fetch(`/list_uploaded`, {
        method: "GET",
        headers: await getHeaders(idToken)
    });

    if (!response.ok) {
        throw new Error(`Listing files failed: ${response.statusText}`);
    }
console.log(response);
    const dataResponse: string[] = await response.json();
    return dataResponse;
}

export async function postChatHistoryApi(item: any, idToken: string): Promise<any> {
    const headers = await getHeaders(idToken);
    const response = await fetch("/chat_history", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(item)
    });

    if (!response.ok) {
        throw new Error(`Posting chat history failed: ${response.statusText}`);
    }
console.log(response);
    const dataResponse: any = await response.json();
    return dataResponse;
}

export async function getChatHistoryListApi(count: number, continuationToken: string | undefined, idToken: string): Promise<HistoryListApiResponse> {
    const headers = await getHeaders(idToken);
    let url = `${BACKEND_URI}/chat_history/sessions?count=${count}`;
    if (continuationToken) {
        url += `&continuationToken=${continuationToken}`;
    }

    const response = await fetch(url.toString(), {
        method: "GET",
        headers: { ...headers, "Content-Type": "application/json" }
    });

    if (!response.ok) {
        throw new Error(`Getting chat histories failed: ${response.statusText}`);
    }
console.log(response);
    const dataResponse: HistoryListApiResponse = await response.json();
    return dataResponse;
}

export async function getChatHistoryApi(id: string, idToken: string): Promise<HistoryApiResponse> {
    const headers = await getHeaders(idToken);
    const response = await fetch(`/chat_history/sessions/${id}`, {
        method: "GET",
        headers: { ...headers, "Content-Type": "application/json" }
    });

    if (!response.ok) {
        throw new Error(`Getting chat history failed: ${response.statusText}`);
    }
console.log(response);
    const dataResponse: HistoryApiResponse = await response.json();
    return dataResponse;
}

export async function deleteChatHistoryApi(id: string, idToken: string): Promise<any> {
    const headers = await getHeaders(idToken);
    const response = await fetch(`/chat_history/sessions/${id}`, {
        method: "DELETE",
        headers: { ...headers, "Content-Type": "application/json" }
    });

    if (!response.ok) {
        throw new Error(`Deleting chat history failed: ${response.statusText}`);
    }
}

// 保存する会話データの型を定義
interface ConversationData {
    userId: string;
    conversationId: string;
    question: string;
    answer: ChatAppResponse;
    tenantId?: string | null;
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