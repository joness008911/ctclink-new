import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import firebaseConfig from "../../../firebase-applet-config.json";

const app = !getApps().length
  ? initializeApp({
      apiKey: firebaseConfig.apiKey,
      authDomain: firebaseConfig.authDomain,
      projectId: firebaseConfig.projectId,
      appId: firebaseConfig.appId,
      storageBucket: firebaseConfig.storageBucket,
      messagingSenderId: firebaseConfig.messagingSenderId,
    })
  : getApp();

export const firebaseAuth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();
googleAuthProvider.setCustomParameters({ prompt: "select_account" });
googleAuthProvider.addScope("email");
googleAuthProvider.addScope("profile");

declare global {
  interface Window {
    google?: any;
  }
}

// Helper to decode JWT token from Google Identity Services
function decodeJwt(token: string) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

// Google OAuth via standard Google Identity Services or Firebase Popup
export async function loginWithGooglePopup() {
  // Strategy 1: If Google Identity Services (GSI) or OAuth token client is available
  const clientId = firebaseConfig.oAuthClientId;

  if (window.google?.accounts?.oauth2 && clientId) {
    return new Promise<{ email: string; name: string; googleId: string; idToken?: string }>(
      (resolve, reject) => {
        try {
          const client = window.google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: "email profile openid",
            callback: async (tokenResponse: any) => {
              if (tokenResponse.error) {
                reject(new Error(tokenResponse.error_description || tokenResponse.error));
                return;
              }
              try {
                // Fetch user info from Google's standard userinfo endpoint
                const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
                  headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
                });
                if (!res.ok) throw new Error("Failed to fetch Google profile");
                const data = await res.json();
                resolve({
                  email: data.email || "",
                  name: data.name || "",
                  googleId: data.sub || data.id,
                  idToken: tokenResponse.access_token,
                  photoURL: data.picture,
                } as any);
              } catch (e) {
                reject(e);
              }
            },
          });
          client.requestAccessToken();
        } catch (err) {
          reject(err);
        }
      }
    );
  }

  // Strategy 2: Firebase Auth signInWithPopup
  try {
    const result = await signInWithPopup(firebaseAuth, googleAuthProvider);
    const user = result.user;
    const idToken = await user.getIdToken();
    return {
      email: user.email || "",
      name: user.displayName || "",
      googleId: user.uid,
      idToken,
      photoURL: user.photoURL,
    };
  } catch (error: any) {
    // If running in restricted iframe or provider is not configured
    if (
      error.code === "auth/internal-error" ||
      error.code === "auth/unauthorized-domain" ||
      error.code === "auth/operation-not-allowed" ||
      error.code === "auth/popup-blocked"
    ) {
      const helpfulError = new Error(
        "Google Sign-In is restricted inside the preview iframe. Please sign up or sign in below with your work email & password, or open this app in a new tab."
      );
      (helpfulError as any).code = error.code;
      throw helpfulError;
    }
    throw error;
  }
}

