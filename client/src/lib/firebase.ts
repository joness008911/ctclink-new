import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  browserLocalPersistence,
  setPersistence,
} from "firebase/auth";
import firebaseConfig from "../../../firebase-applet-config.json";

// Initialize Firebase App
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
setPersistence(firebaseAuth, browserLocalPersistence).catch(() => {});

export const googleAuthProvider = new GoogleAuthProvider();
googleAuthProvider.setCustomParameters({ prompt: "select_account" });
googleAuthProvider.addScope("email");
googleAuthProvider.addScope("profile");

declare global {
  interface Window {
    google?: any;
  }
}

export interface GoogleAuthResult {
  email: string;
  name: string;
  googleId: string;
  idToken?: string;
  photoURL?: string | null;
}

// Ensures Google Identity Services (GSI) script is loaded
export function ensureGoogleScript(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && window.google?.accounts?.oauth2) {
      resolve();
      return;
    }

    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      let checks = 0;
      const interval = setInterval(() => {
        checks++;
        if (window.google?.accounts?.oauth2 || checks > 40) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });
}

// Decode standard Google JWT credential from Google Identity Services
export function decodeGoogleCredential(token: string): GoogleAuthResult | null {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    const parsed = JSON.parse(jsonPayload);
    return {
      email: parsed.email || "",
      name: parsed.name || parsed.given_name || "",
      googleId: parsed.sub || parsed.id || `google_${Date.now()}`,
      idToken: token,
      photoURL: parsed.picture || null,
    };
  } catch (e) {
    console.warn("Could not decode Google JWT:", e);
    return null;
  }
}

// Full genuine Google OAuth Sign-In via Google Identity Services and Firebase Auth
export async function loginWithGooglePopup(): Promise<GoogleAuthResult> {
  await ensureGoogleScript();
  const clientId = firebaseConfig.oAuthClientId;

  // 1. First attempt: Standard Google Identity Services OAuth2 Token Client
  if (typeof window !== "undefined" && window.google?.accounts?.oauth2 && clientId) {
    try {
      const result = await new Promise<GoogleAuthResult>((resolve, reject) => {
        let settled = false;
        try {
          const client = window.google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: "email profile openid",
            callback: async (tokenResponse: any) => {
              settled = true;
              if (tokenResponse.error) {
                if (
                  tokenResponse.error === "popup_closed" ||
                  tokenResponse.error === "access_denied" ||
                  tokenResponse.error === "user_cancelled"
                ) {
                  const err: any = new Error("Google Sign-In was closed.");
                  err.code = "user-cancelled";
                  reject(err);
                  return;
                }
                const err = new Error(tokenResponse.error_description || tokenResponse.error);
                (err as any).code = tokenResponse.error;
                reject(err);
                return;
              }
              try {
                const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
                  headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
                });
                if (!res.ok) throw new Error("Failed to fetch Google profile info");
                const data = await res.json();
                resolve({
                  email: data.email || "",
                  name: data.name || "",
                  googleId: data.sub || data.id,
                  idToken: tokenResponse.access_token,
                  photoURL: data.picture || null,
                });
              } catch (fetchErr) {
                reject(fetchErr);
              }
            },
          });
          client.requestAccessToken({ prompt: "select_account" });
        } catch (initErr) {
          if (!settled) reject(initErr);
        }
      });
      return result;
    } catch (gsiErr: any) {
      if (gsiErr.code === "user-cancelled" || gsiErr.code === "popup_closed" || gsiErr.code === "access_denied") {
        const userCancelErr: any = new Error("Google Sign-In was closed.");
        userCancelErr.code = "user-cancelled";
        throw userCancelErr;
      }
      console.warn("GSI token client error:", gsiErr);
    }
  }

  // 2. Second attempt: Firebase Auth signInWithPopup
  try {
    const result = await signInWithPopup(firebaseAuth, googleAuthProvider);
    const user = result.user;
    const idToken = await user.getIdToken();
    return {
      email: user.email || "",
      name: user.displayName || "",
      googleId: user.uid,
      idToken,
      photoURL: user.photoURL || null,
    };
  } catch (error: any) {
    const errorCode = error.code || "";
    if (
      errorCode === "auth/popup-closed-by-user" ||
      errorCode === "auth/cancelled-popup-request" ||
      errorCode === "auth/user-cancelled"
    ) {
      const userCancelled: any = new Error("Sign-in was cancelled");
      userCancelled.code = "user-cancelled";
      throw userCancelled;
    }

    // Provide clear, actionable message if Firebase provider is disabled or domain not whitelisted
    if (errorCode === "auth/internal-error" || errorCode === "auth/unauthorized-domain") {
      const helpfulErr = new Error(
        "Google Sign-In is initializing. Please use the official Google button below or sign in with your email."
      );
      (helpfulErr as any).code = errorCode;
      throw helpfulErr;
    }

    throw error;
  }
}
