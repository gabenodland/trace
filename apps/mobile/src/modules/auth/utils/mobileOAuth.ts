import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { signInWithGoogle, setSession, OAUTH_CONSTANTS, ERROR_MESSAGES } from "@trace/core";

export interface OAuthResult {
  error: { message: string; code: string } | null;
}

/**
 * Handle Google OAuth specifically for mobile platforms using Expo
 */
export async function handleMobileGoogleOAuth(): Promise<OAuthResult> {
  try {
    // In development with Expo Go, use the dynamic URL (tunnel/LAN/localhost)
    // In production, this would use the custom scheme from app.json
    const redirectTo = Linking.createURL(OAUTH_CONSTANTS.CALLBACK_PATH);
    console.log("[OAuth] Redirect URL:", redirectTo);

    let data;
    try {
      data = await signInWithGoogle(redirectTo);
      console.log("[OAuth] Sign in response:", data);
    } catch (error: unknown) {
      console.log("[OAuth] Sign in error:", error);
      return {
        error: {
          message: error instanceof Error ? error.message : "Unknown error",
          code:
            error && typeof error === "object" && "code" in error
              ? (error as { code: string }).code
              : "UNKNOWN_ERROR",
        },
      };
    }

    if (data?.url) {
      // Open the OAuth URL in a web browser
      console.log("[OAuth] Opening auth URL:", data.url);
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      console.log("[OAuth] Browser result:", result);

      if (result.type === "success" && result.url) {
        // Parse the callback URL - it might have fragments or query params
        const url = result.url;
        console.log("[OAuth] Callback URL received:", url);
        let access_token = null;
        let refresh_token = null;

        // Check for fragment-based tokens (common with OAuth)
        if (url.includes("#")) {
          const fragment = url.split("#")[1];
          const params = new URLSearchParams(fragment);
          access_token = params.get("access_token");
          refresh_token = params.get("refresh_token");
        }

        // If not in fragment, check query params
        if (!access_token && url.includes("?")) {
          const urlObj = new URL(url);
          access_token = urlObj.searchParams.get("access_token");
          refresh_token = urlObj.searchParams.get("refresh_token");
        }

        if (access_token) {
          console.log("[OAuth] Access token found, setting session");
          try {
            await setSession(access_token, refresh_token);
            console.log("[OAuth] Session set successfully");
          } catch (sessionError: unknown) {
            console.log("[OAuth] Session error:", sessionError);
            return {
              error: {
                message: sessionError instanceof Error ? sessionError.message : "Unknown error",
                code:
                  sessionError && typeof sessionError === "object" && "code" in sessionError
                    ? (sessionError as { code: string }).code
                    : "UNKNOWN_ERROR",
              },
            };
          }
          return { error: null };
        } else {
          console.log("[OAuth] No access token found in callback URL");
          return {
            error: {
              message: ERROR_MESSAGES.NO_ACCESS_TOKEN,
              code: "NO_ACCESS_TOKEN",
            },
          };
        }
      } else if (result.type === "cancel") {
        return {
          error: {
            message: ERROR_MESSAGES.OAUTH_CANCELLED,
            code: "OAUTH_CANCELLED",
          },
        };
      } else {
        return {
          error: {
            message: ERROR_MESSAGES.OAUTH_FAILED,
            code: "OAUTH_FAILED",
          },
        };
      }
    }

    return {
      error: {
        message: ERROR_MESSAGES.NO_OAUTH_URL,
        code: "NO_OAUTH_URL",
      },
    };
  } catch {
    return {
      error: {
        message: ERROR_MESSAGES.GOOGLE_SIGNIN_ERROR,
        code: "GOOGLE_SIGNIN_ERROR",
      },
    };
  }
}
