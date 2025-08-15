import React, { useState, useCallback, useEffect, createContext, useContext } from "react";
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";

// --- AppAuthContextとAppAuthProviderは変更なし ---
interface AppAuthContextType {
    isSessionReady: boolean;
    appToken: any | null;
    login: (token: any) => void;
}

const AppAuthContext = React.createContext<AppAuthContextType>({
    isSessionReady: false,
    appToken: null,
    login: () => {}
});

export const useAppAuth = () => React.useContext(AppAuthContext);

export const AppAuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [isSessionReady, setIsSessionReady] = useState(false);
    const [appToken, setAppToken] = useState<any | null>(null);

    const login = useCallback((token: any) => {
        setAppToken(token);
        setIsSessionReady(true);
    }, []); // 依存配列は空でOK
    
    return (
        <AppAuthContext.Provider value={{ isSessionReady, appToken, login }}>
            {children}
        </AppAuthContext.Provider>
    );
};


// --- ここからが修正対象のコンポーネント ---
export const AuthHandler = ({ children }: { children: React.ReactNode }) => {
    const { instance, accounts, inProgress } = useMsal();
    const isAuthenticated = useIsAuthenticated();
    const { isSessionReady, login } = useAppAuth();

    console.log("AuthHandler State:", {
        isAuthenticated,
        isSessionReady,
        inProgress
    });

    useEffect(() => {
        if (isAuthenticated && !isSessionReady && inProgress === InteractionStatus.None) {
            
            const account = accounts[0];
            if (!account) return;

            console.log("MSAL authentication successful. Establishing backend session...");

            const idToken = account.idToken;
            const tenantId = account.idTokenClaims?.tid ?? null;
            if (!idToken) return;

            const establishBackendSession = async () => {
                try {
                    const response = await fetch(`/api/v1/auth/microsoft/callback/`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ idToken: idToken, tenantId: tenantId })
                    });
                    
                    // ★★★★★ ここからが重要な修正箇所 ★★★★★

                    // 1. まずレスポンスをテキストとして安全に読み取る
                    const responseText = await response.text();
                    
                    // 2. バックエンドが何を返したかコンソールで確認する
                    console.log("Backend Raw Response:", responseText);

                    if (!response.ok) {
                        // 通信自体が失敗した場合
                        throw new Error(`Backend request failed with status ${response.status}. Response: ${responseText}`);
                    }

                    // 3. 応答が空でないことを確認してからJSONとして解析する
                    if (!responseText) {
                        throw new Error("Backend returned an empty response.");
                    }
                    
                    const data = JSON.parse(responseText);
                    
                    console.log("Backend session established:", data);
                    login(data); 

                } catch (error) {
                    // 4. エラーが発生した場合、その内容をコンソールに詳しく表示する
                    console.error("Failed to establish backend session. See error below:");
                    console.error(error);
                }
            };

            establishBackendSession();
        }
    }, [isAuthenticated, isSessionReady, inProgress, accounts, instance, login]);

    if (isAuthenticated && !isSessionReady) {
        return <div>セッションを準備しています...</div>;
    }

    return <>{children}</>;
};
