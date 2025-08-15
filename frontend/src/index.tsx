// index.tsx または main.tsx

import React, { useEffect } from 'react';
import ReactDOM from "react-dom/client";
import { createHashRouter, RouterProvider } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import { HelmetProvider } from "react-helmet-async";
import { initializeIcons } from "@fluentui/react";
import { PublicClientApplication, EventType, InteractionType, EventMessage, AuthenticationResult } from "@azure/msal-browser";
import { MsalProvider, MsalAuthenticationTemplate } from "@azure/msal-react";
import { msalConfig } from "./authConfig";

import "./index.css";

import Chat from "./pages/chat/Chat";
import LayoutWrapper from "./layoutWrapper";
import i18next from "./i18n/config";
import { AppAuthProvider, AuthHandler } from "./AuthHandler";

export const msalInstance = new PublicClientApplication(msalConfig);

// msalInstance.addEventCallback((event: EventMessage) => {
//     if (event.eventType === EventType.LOGIN_SUCCESS && event.payload) {
//         const payload = event.payload as AuthenticationResult;
//         if (payload.account) {
//             msalInstance.setActiveAccount(payload.account);
//         }
//     }
// });

// msalInstance.handleRedirectPromise().then((response) => {
//   if (response) {
//     msalInstance.setActiveAccount(response.account);
//   } else {
//     const currentAccounts = msalInstance.getAllAccounts();
//     if (currentAccounts.length === 1) {
//       msalInstance.setActiveAccount(currentAccounts[0]);
//     }
//   }
// });

// initializeIcons();

const router = createHashRouter([
    {
        path: "/",
        element: (
            <MsalAuthenticationTemplate interactionType={InteractionType.Redirect}>
                <AuthHandler>
                    <LayoutWrapper />
                </AuthHandler>
            </MsalAuthenticationTemplate>
        ),
        children: [
            {
                index: true,
                element: <Chat />
            },
            {
                path: "qa",
                lazy: () => import("./pages/ask/Ask")
            },
            {
                path: "*",
                lazy: () => import("./pages/NoPage")
            }
        ]
    }
]);

// ★★★★★ 修正点 1: 新しいルートコンポーネントを作成 ★★★★★
const App = () => {
    // このuseEffectフックを使って、アプリケーション起動時に一度だけCSRFクッキーを取得します。
    useEffect(() => {
        const fetchCsrfToken = async () => {
            try {
                // Djangoで作成したCSRFトークン取得用のAPIを呼び出します。
                await fetch('/api/csrf-token/');
                console.log("CSRFクッキーが正常にセットされました。");
            } catch (error) {
                console.error("CSRFクッキーの取得に失敗しました:", error);
            }
        };

        fetchCsrfToken();
    }, []); // 空の配列[]を指定することで、最初のレンダリング時に一度だけ実行されます。

    // アプリケーションのプロバイダーとルーターをレンダリングします。
    return (
        <MsalProvider instance={msalInstance}>
            <AppAuthProvider>
                <I18nextProvider i18n={i18next}>
                    <HelmetProvider>
                        <RouterProvider router={router} />
                    </HelmetProvider>
                </I18nextProvider>
            </AppAuthProvider>
        </MsalProvider>
    );
};

// // ★★★★★ 修正点 2: 新しいAppコンポーネントをレンダリング ★★★★★
// ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
//     <React.StrictMode>
//         <App />
//     </React.StrictMode>
// );

async function initializeApp() {
  // Fluent UI のアイコン初期化も待つなら await する（initializeIconsはPromise返さないけど）
  initializeIcons();

  // MSAL の初期化待ち
  await msalInstance.initialize();

  // その後、handleRedirectPromise()もawaitしてアカウント設定
  try {
    const response = await msalInstance.handleRedirectPromise();
    if (response) {
        msalInstance.setActiveAccount(response.account);
    } else {
        const currentAccounts = msalInstance.getAllAccounts();
        if (currentAccounts.length === 1) {
        msalInstance.setActiveAccount(currentAccounts[0]);
        }
    }
  } catch (error) {
    if (error instanceof Error) {
        console.error(error.message);
    } else {
        console.error(error);
    }
  }

  // イベントコールバックはinitialize()の前でも後でも大丈夫
  msalInstance.addEventCallback((event: EventMessage) => {
    if (event.eventType === EventType.LOGIN_SUCCESS && event.payload) {
      const payload = event.payload as AuthenticationResult;
      if (payload.account) {
        msalInstance.setActiveAccount(payload.account);
      }
    }
  });

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

initializeApp().catch(console.error);