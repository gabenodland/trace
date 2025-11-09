import { useState } from "react";
import { useAuthState } from "@trace/core";

export function LoginPage() {
  const { authMutations, isLoading } = useAuthState();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      if (isSignUp) {
        await authMutations.signUpWithEmail(email, password);
        alert("Check your email to confirm your account!");
      } else {
        await authMutations.signInWithEmail(email, password);
      }
    } catch (err: any) {
      setError(err.message || "Failed to sign in. Please try again.");
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    try {
      await authMutations.signInWithGoogle(window.location.origin);
    } catch (err: any) {
      setError(err.message || "Failed to sign in with Google.");
    }
  };

  if (isLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Trace</h1>
        <p style={styles.subtitle}>Track your habits, achieve your goals</p>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleEmailSignIn} style={styles.form}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
            required
          />
          <button type="submit" style={styles.primaryButton}>
            {isSignUp ? "Sign Up" : "Sign In"}
          </button>
        </form>

        <div style={styles.divider}>
          <span style={styles.dividerLine}></span>
          <span style={styles.dividerText}>OR</span>
          <span style={styles.dividerLine}></span>
        </div>

        <button onClick={handleGoogleSignIn} style={styles.googleButton}>
          <svg style={styles.googleIcon} viewBox="0 0 24 24">
            <path
              fill="#4285f4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34a853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#fbbc05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#ea4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continue with Google
        </button>

        <p style={styles.toggleText}>
          {isSignUp ? "Already have an account? " : "Don't have an account? "}
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            style={styles.toggleButton}
          >
            {isSignUp ? "Sign In" : "Sign Up"}
          </button>
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f5f5f5",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  card: {
    backgroundColor: "white",
    borderRadius: "12px",
    padding: "48px 40px",
    boxShadow: "0 2px 10px rgba(0, 0, 0, 0.1)",
    textAlign: "center",
    maxWidth: "420px",
    width: "100%",
    margin: "20px",
  },
  title: {
    fontSize: "42px",
    fontWeight: "700",
    color: "#1a1a1a",
    margin: "0 0 8px 0",
  },
  subtitle: {
    fontSize: "16px",
    color: "#666",
    margin: "0 0 32px 0",
  },
  error: {
    backgroundColor: "#fee",
    color: "#c33",
    padding: "12px",
    borderRadius: "6px",
    fontSize: "14px",
    marginBottom: "20px",
    border: "1px solid #fcc",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  input: {
    width: "100%",
    padding: "14px 16px",
    fontSize: "16px",
    border: "1px solid #ddd",
    borderRadius: "6px",
    outline: "none",
    transition: "border-color 0.2s",
    boxSizing: "border-box",
  },
  primaryButton: {
    width: "100%",
    padding: "14px 24px",
    backgroundColor: "#1a1a1a",
    color: "white",
    border: "none",
    borderRadius: "6px",
    fontSize: "16px",
    fontWeight: "500",
    cursor: "pointer",
    transition: "background-color 0.2s",
  },
  divider: {
    display: "flex",
    alignItems: "center",
    margin: "24px 0",
    gap: "12px",
  },
  dividerLine: {
    flex: 1,
    height: "1px",
    backgroundColor: "#ddd",
  },
  dividerText: {
    fontSize: "14px",
    color: "#999",
    fontWeight: "500",
  },
  googleButton: {
    width: "100%",
    padding: "14px 24px",
    backgroundColor: "white",
    color: "#666",
    border: "1px solid #ddd",
    borderRadius: "6px",
    fontSize: "16px",
    fontWeight: "500",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    transition: "all 0.2s",
  },
  googleIcon: {
    width: "20px",
    height: "20px",
  },
  loading: {
    padding: "20px",
    color: "#666",
    fontSize: "16px",
  },
  toggleText: {
    marginTop: "24px",
    fontSize: "14px",
    color: "#666",
  },
  toggleButton: {
    background: "none",
    border: "none",
    color: "#4285f4",
    fontWeight: "500",
    cursor: "pointer",
    fontSize: "14px",
    textDecoration: "underline",
    padding: 0,
  },
};
