// import { useEffect } from "react";
// import { Outlet } from "react-router-dom";
// import { useIsAuthenticated, useMsal } from "@azure/msal-react";
// import { InteractionStatus } from "@azure/msal-browser";
// import { loginRequest } from "./authConfig";
// import React from 'react';

// const LayoutWrapper = () => {
//     const { instance, inProgress } = useMsal();
//     const isAuthenticated = useIsAuthenticated();

//     // ★★★ 修正点 ① ★★★
//     // アプリ本体を表示すべきかどうかを、一つの変数にまとめます。
//     const shouldShowApp = isAuthenticated && inProgress === InteractionStatus.None;

//     useEffect(() => {
//         // リダイレクトを開始するロジックは変更ありません
//         if (!isAuthenticated && inProgress === InteractionStatus.None) {
//             instance.loginRedirect(loginRequest);
//         }
//     }, [isAuthenticated, inProgress, instance]);

//     // ★★★ 修正点 ② ★★★
//     // レンダリングロジックをシンプルな if/else にします。
//     if (shouldShowApp) {
//         // 条件を満たす場合のみ、アプリ本体（<Outlet />）を表示します。
//         return <Outlet />;
//     } else {
//         // それ以外のすべての場合（処理中、リダイレクト待ちなど）は
//         // 一貫してローディング画面を表示します。
//         // return <div>Loading...</div>;
//     }
// };

// export default LayoutWrapper;


import { AccountInfo, EventType, PublicClientApplication } from "@azure/msal-browser";
import { checkLoggedIn, msalConfig, useLogin } from "./authConfig";
import { useEffect, useState } from "react";
import { MsalProvider } from "@azure/msal-react";
import { LoginContext } from "./loginContext";
import Layout from "./pages/layout/Layout";
import React from 'react';
import { msalInstance } from './authConfig';

const LayoutWrapper = () => {
    const [loggedIn, setLoggedIn] = useState(false);
    if (useLogin) {
        // var msalInstance = new PublicClientApplication(msalConfig);
        // Default to using the first account if no account is active on page load
        if (!msalInstance.getActiveAccount() && msalInstance.getAllAccounts().length > 0) {
            // Account selection logic is app dependent. Adjust as needed for different use cases.
            msalInstance.setActiveAccount(msalInstance.getActiveAccount());
        }
        // Listen for sign-in event and set active account
        msalInstance.addEventCallback(event => {
            if (event.eventType === EventType.LOGIN_SUCCESS && event.payload) {
                const account = event.payload as AccountInfo;
                msalInstance.setActiveAccount(account);
            }
        });
        useEffect(() => {
            const fetchLoggedIn = async () => {
                setLoggedIn(await checkLoggedIn(msalInstance));
            };
            fetchLoggedIn();
        }, []);
        return (
            <MsalProvider instance={msalInstance}>
                <LoginContext.Provider
                    value={{
                        loggedIn,
                        setLoggedIn
                    }}
                >
                    <Layout />
                </LoginContext.Provider>
            </MsalProvider>
        );
    } else {
        return (
            <LoginContext.Provider
                value={{
                    loggedIn,
                    setLoggedIn
                }}
            >
                <Layout />
            </LoginContext.Provider>
        );
    }
};
export default LayoutWrapper;
