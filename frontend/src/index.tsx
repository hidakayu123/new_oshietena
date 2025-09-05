// React and related libraries
import React from 'react';
import ReactDOM from "react-dom/client";
import { createHashRouter, RouterProvider } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { I18nextProvider } from "react-i18next";

// Third-party libraries (MSAL, Fluent UI)
import { MsalProvider, MsalAuthenticationTemplate } from "@azure/msal-react";
import { EventType, InteractionType, EventMessage, AuthenticationResult } from "@azure/msal-browser";
import { initializeIcons } from "@fluentui/react";

// Local application components and pages
import LayoutWrapper from "./layoutWrapper";
import Chat from "./pages/chat/Chat";
import ChatWrapper from "./ChatWrapper";

// Local application configuration and providers
import { AuthProvider } from './AuthContext';
import { AuthHandler } from "./AuthHandler";
import { msalInstance, loginRequest } from './authConfig';
import i18next from "./i18n/config";

// Styles
import "./index.css";
// ルーターの定義
const router = createHashRouter([
  {
    path: "/",
    element: (
      <MsalAuthenticationTemplate
        interactionType={InteractionType.Redirect}
        authenticationRequest={loginRequest}
      >
        <LayoutWrapper />
      </MsalAuthenticationTemplate>
    ),
    children: [
      {
        index: true,
        element: (
          <AuthHandler>
            <Chat />
          </AuthHandler>
        ),
      },
      {
        path: "chat/:id",
        element: (
          <AuthHandler>
            <ChatWrapper />
          </AuthHandler>
        ),
      },
    ],
  },
]);

// アプリケーションを起動するための非同期関数を定義します
async function main() {
    // 1. MSALインスタンスの初期化を待ちます (これが抜けていました)
    await msalInstance.initialize();

    // イベントコールバックの設定
    msalInstance.addEventCallback((event: EventMessage) => {
        if (event.eventType === EventType.LOGIN_SUCCESS && event.payload) {
            const payload = event.payload as AuthenticationResult;
            if (payload.account) {
                msalInstance.setActiveAccount(payload.account);
            }
        }
    });

    // 2. リダイレクト処理を待ちます
    await msalInstance.handleRedirectPromise();

    // 3. 全てのMSAL処理が終わった後に、Reactアプリをレンダリングします
    initializeIcons();
    ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
        <React.StrictMode>
            <MsalProvider instance={msalInstance}>
                <AuthProvider>
                    <I18nextProvider i18n={i18next}>
                        <HelmetProvider>
                            <RouterProvider router={router} />
                        </HelmetProvider>
                    </I18nextProvider>
                </AuthProvider>
            </MsalProvider>
        </React.StrictMode>
    );
}

// 非同期関数を実行してアプリを起動
main().catch(error => {
    console.error("アプリケーションの初期化中にエラーが発生しました:", error);
});