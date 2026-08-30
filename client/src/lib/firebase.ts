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

export interface GoogleAuthErrorInfo {
  isDomainError: boolean;
  domain: string;
  originalMessage: string;
  instructions: string[];
}

export async function loginWithGooglePopup(): Promise<{
  email: string;
  name: string;
  googleId: string;
  idToken?: string;
  photoURL?: string | null;
}> {
  const currentHost = window.location.host;
  const currentOrigin = window.location.origin;

  // Strategy 1: Google Identity Services (GSI)
  const clientId = firebaseConfig.oAuthClientId;

  if (window.google?.accounts?.oauth2 && clientId) {
    try {
      const gsiResult = await new Promise<{
        email: string;
        name: string;
        googleId: string;
        idToken?: string;
        photoURL?: string | null;
      }>((resolve, reject) => {
        try {
          const client = window.google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: "email profile openid",
            callback: async (tokenResponse: any) => {
              if (tokenResponse.error) {
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
              } catch (e) {
                reject(e);
              }
            },
          });
          client.requestAccessToken();
        } catch (err) {
          reject(err);
        }
      });
      return gsiResult;
    } catch (gsiError: any) {
      console.warn("GSI auth attempt encountered error, trying Firebase popup fallback:", gsiError);
      // If user closed popup intentionally, rethrow
      if (gsiError.code === "popup_closed" || gsiError.code === "access_denied") {
        const isDomain = String(gsiError.message || "").toLowerCase().includes("origin") || gsiError.code === "origin_mismatch";
        if (!isDomain) throw gsiError;
      }
    }
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
      photoURL: user.photoURL || null,
    };
  } catch (error: any) {
    console.error("Google Auth error:", error);

    const isDomainOrConfigError =
      error.code === "auth/internal-error" ||
      error.code === "auth/unauthorized-domain" ||
      error.code === "auth/operation-not-allowed" ||
      error.code === "auth/configuration-not-found" ||
      error.code === "origin_mismatch" ||
      String(error.message || "").includes("origin_mismatch") ||
      String(error.message || "").includes("authorized domain");

    if (isDomainOrConfigError) {
      const helpfulError: any = new Error(
        `Google Sign-In on "${currentHost}" requires domain authorization in Firebase Console or Google Cloud.`
      );
      helpfulError.isDomainError = true;
      helpfulError.host = currentHost;
      helpfulError.origin = currentOrigin;
      helpfulError.code = error.code || "auth/unauthorized-domain";
      throw helpfulError;
    }

    throw error;
  }
}
