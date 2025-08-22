// Refactored from https://github.com/Azure-Samples/ms-identity-javascript-react-tutorial/blob/main/1-Authentication/1-sign-in/SPA/src/authConfig.js

import { Configuration, PublicClientApplication, IPublicClientApplication } from "@azure/msal-browser";
const BACKEND_URI = import.meta.env.VITE_BACKEND_URI || "";
const TENANTID = import.meta.env.VITE_TENANTID;
const CLIENTID = import.meta.env.VITE_CLIENTID;
// const appServicesAuthTokenUrl = "/api/.auth/me";
const appServicesAuthTokenRefreshUrl = ".auth/refresh";
const appServicesAuthLogoutUrl = ".auth/logout?post_logout_redirect_uri=/";

interface AppServicesToken {
    id_token: string;
    access_token: string;
    user_claims: Record<string, any>;
    expires_on: string;
}

interface AuthSetup {
    useLogin: boolean;
    requireAccessControl: boolean;
    enableUnauthenticatedAccess: boolean;
    msalConfig: {
        auth: {
            clientId: string; // Client app id used for login
            authority: string; // Directory to use for login https://learn.microsoft.com/entra/identity-platform/msal-client-application-configuration#authority
            redirectUri: string; // Points to window.location.origin. You must register this URI on Azure Portal/App Registration.
            postLogoutRedirectUri: string; // Indicates the page to navigate after logout.
            navigateToLoginRequestUrl: boolean; // If "true", will navigate back to the original request location before processing the auth code response.
        };
        cache: {
            cacheLocation: string; // Configures cache location. "sessionStorage" is more secure, but "localStorage" gives you SSO between tabs.
            storeAuthStateInCookie: boolean; // Set this to "true" if you are having issues on IE11 or Edge
        };
    };
    // loginRequest: {
    //     scopes: Array<string>;
    //};
    tokenRequest: {
        scopes: Array<string>;
    };
}

async function fetchAuthSetup(): Promise<AuthSetup> {
    const response = await fetch(`/api/auth_setup`);
    if (!response.ok) {
        throw new Error(`auth setup response was not ok: ${response.status}`);
    }
    return await response.json();
}

const authSetup = await fetchAuthSetup();

export const useLogin = authSetup.useLogin;
export const requireAccessControl = authSetup.requireAccessControl;
export const enableUnauthenticatedAccess = authSetup.enableUnauthenticatedAccess;
export const requireLogin = requireAccessControl && !enableUnauthenticatedAccess;
export const loginRequest = {
    scopes: [import.meta.env.VITE_API_SCOPE_URI] // 既存のスコープに、必要なAPIスコープを追加
};


const tokenRequest = authSetup.tokenRequest;

export const getRedirectUri = () => {
    return authSetup.msalConfig.auth.redirectUri;
};

declare global {
    var cachedAppServicesToken: AppServicesToken | null;
}
globalThis.cachedAppServicesToken = null;

/**
 * Retrieves an access token if the user is logged in using app services authentication.
 * Checks if the current token is expired and fetches a new token if necessary.
 * Returns null if the app doesn't support app services authentication.
 *
 * @returns {Promise<AppServicesToken | null>} A promise that resolves to an AppServicesToken if the user is authenticated, or null if authentication is not supported or fails.
 */
const getAppServicesToken = (): Promise<AppServicesToken | null> => {
    const checkNotExpired = (appServicesToken: AppServicesToken) => {
        const currentDate = new Date();
        const expiresOnDate = new Date(appServicesToken.expires_on);
        return expiresOnDate > currentDate;
    };

    if (globalThis.cachedAppServicesToken && checkNotExpired(globalThis.cachedAppServicesToken)) {
        return Promise.resolve(globalThis.cachedAppServicesToken);
    }
};

export const isUsingAppServicesLogin = (await getAppServicesToken()) != null;

export const appServicesLogout = () => {
    window.location.href = appServicesAuthLogoutUrl;
};

/**
 * Determines if the user is logged in either via the MSAL public client application or the app services login.
 * @param {IPublicClientApplication | undefined} client - The MSAL public client application instance, or undefined if not available.
 * @returns {Promise<boolean>} A promise that resolves to true if the user is logged in, false otherwise.
 */
export const checkLoggedIn = async (client: IPublicClientApplication | undefined): Promise<boolean> => {
    if (client) {
        const activeAccount = client.getActiveAccount();
        if (activeAccount) {
            return true;
        }
    }

    const appServicesToken = await getAppServicesToken();
    if (appServicesToken) {
        return true;
    }

    return false;
};

export const msalConfig: Configuration = {
    auth: {
        clientId: CLIENTID,
        authority: `https://login.microsoftonline.com/${TENANTID}`, 
        redirectUri: "http://localhost:5173",
        navigateToLoginRequestUrl: false
    },
    cache: {
        cacheLocation: "sessionStorage", // ブラウザのどこに認証情報を保存するか
        storeAuthStateInCookie: false,
    }
};
export const msalInstance = new PublicClientApplication(msalConfig);

// Get an access token for use with the API server.
// ID token received when logging in may not be used for this purpose because it has the incorrect audience
// Use the access token from app services login if available
export const getToken = async (client: IPublicClientApplication): Promise<string | undefined> => {
    const appServicesToken = await getAppServicesToken();
    if (appServicesToken) {
        return Promise.resolve(appServicesToken.access_token);
    }
    return client
        .acquireTokenSilent({
            ...tokenRequest,
            redirectUri: getRedirectUri()
        })
        .then(r => r.accessToken)
        .catch(error => {
            console.log(error);
            return undefined;
        });
};

/**
 * Retrieves the username of the active account.
 * If no active account is found, attempts to retrieve the username from the app services login token if available.
 * @param {IPublicClientApplication} client - The MSAL public client application instance.
 * @returns {Promise<string | null>} The username of the active account, or null if no username is found.
 */
export const getUsername = async (client: IPublicClientApplication): Promise<string | null> => {
    const activeAccount = client.getActiveAccount();
    if (activeAccount) {
        return activeAccount.username;
    }

    const appServicesToken = await getAppServicesToken();
    if (appServicesToken?.user_claims) {
        return appServicesToken.user_claims.preferred_username;
    }

    return null;
};

/**
 * Retrieves the token claims of the active account.
 * If no active account is found, attempts to retrieve the token claims from the app services login token if available.
 * @param {IPublicClientApplication} client - The MSAL public client application instance.
 * @returns {Promise<Record<string, unknown> | undefined>} A promise that resolves to the token claims of the active account, the user claims from the app services login token, or undefined if no claims are found.
 */
export const getTokenClaims = async (client: IPublicClientApplication): Promise<Record<string, unknown> | undefined> => {
    const activeAccount = client.getActiveAccount();
    if (activeAccount) {
        return activeAccount.idTokenClaims;
    }

    const appServicesToken = await getAppServicesToken();
    if (appServicesToken) {
        return appServicesToken.user_claims;
    }

    return undefined;
};


