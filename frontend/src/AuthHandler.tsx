// AuthHandler.tsx

import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import React, { useEffect, useState } from "react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { useAuthToken } from "./AuthContext";
// AppAuthProviderなど、あなたのアプリの状態管理に合わせてください
// import { useAppAuth } from "./AuthProvider"; 

export const AuthHandler = ({ children }: { children: React.ReactNode }) => {
    console.log("🔥🔥🔥 AuthHandler component is rendering! 🔥🔥🔥");
    const { instance } = useMsal();
    const isAuthenticated = useIsAuthenticated();
    // const { setIsSessionReady } = useAppAuth(); // アプリのセッション準備完了を伝えるための状態更新関数

    const [loginAttempted, setLoginAttempted] = useState(false);
    const { setToken } = useAuthToken();
    useEffect(() => {
        console.log("✅ [AuthHandler Effect] useEffect is running.");
        // MSALでの認証が成功し、まだバックエンドセッションの確立を試みていない場合
        if (isAuthenticated && !loginAttempted) {
            setLoginAttempted(true);

            const establishBackendSession = async () => {
                try {
                    // 1. MSALからIDトークンを取得（バックエンドへの身分証明書）
                    const activeAccount = instance.getActiveAccount();
                    if (!activeAccount) {
                        throw new Error("No active MSAL account.");
                    }
                    const msalTokenResponse = await instance.acquireTokenSilent({
                        account: activeAccount,
                        scopes:[import.meta.env.VITE_API_SCOPE_URI] // ログイン時に使用したスコープ
                    });
                    setToken(msalTokenResponse.accessToken);
                    console.log("Token set:", msalTokenResponse.accessToken);
                    console.log("✅ MSALアクセストークンの取得と設定に成功しました。");

                } catch (error) {
                    console.error("Failed to establish backend session:", error);
                    console.error("バックエンドセッションの確立に失敗しました:", error);
                    // エラーハンドリング（例：エラーページにリダイレクト）
                    if (error instanceof InteractionRequiredAuthError) {
                        const tokenResponse = await instance.acquireTokenPopup({
                        scopes: [import.meta.env.VITE_API_SCOPE_URI], // 必要なスコープ
                        });
                        setToken(tokenResponse.accessToken);
                    } else {
                        throw error;
                    }
                }
            };

            establishBackendSession();
        
        }
        return () => {
        // このログが表示されれば、コンポーネントがアンマウントされたことが確定します
        console.log("❌ [AuthHandler Cleanup] Component is unmounting!");
    };
    }, [isAuthenticated, instance, loginAttempted, setToken]);
//#, setIsSessionReady

    return <>{children}</>;
};