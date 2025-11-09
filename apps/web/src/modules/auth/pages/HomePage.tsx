import { useAuthState } from "@trace/core";

export function HomePage() {
  const { user, authMutations } = useAuthState();

  const handleSignOut = async () => {
    try {
      await authMutations.signOut();
    } catch (error) {
      console.error("Sign out error:", error);
      alert("Failed to sign out. Please try again.");
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Trace</h1>
        <button onClick={handleSignOut} style={styles.signOutButton}>
          Sign Out
        </button>
      </div>

      <div style={styles.content}>
        <div style={styles.welcomeCard}>
          <h2 style={styles.welcomeTitle}>Welcome! 👋</h2>
          {user && (
            <div style={styles.userInfo}>
              {user.user_metadata?.avatar_url && (
                <img
                  src={user.user_metadata.avatar_url}
                  alt="Profile"
                  style={styles.avatar}
                />
              )}
              <div style={styles.userDetails}>
                <p style={styles.userName}>
                  {user.user_metadata?.full_name || user.email}
                </p>
                <p style={styles.userEmail}>{user.email}</p>
                <p style={styles.userId}>User ID: {user.id}</p>
              </div>
            </div>
          )}
          <div style={styles.infoBox}>
            <p style={styles.infoText}>
              ✅ You're successfully authenticated!
            </p>
            <p style={styles.infoText}>
              🔐 Your session is managed by Supabase Auth
            </p>
            <p style={styles.infoText}>
              📱 This is where your app content will go
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#f5f5f5",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  header: {
    backgroundColor: "white",
    padding: "20px 40px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
  },
  title: {
    fontSize: "28px",
    fontWeight: "700",
    color: "#1a1a1a",
    margin: 0,
  },
  signOutButton: {
    padding: "10px 20px",
    backgroundColor: "#f44336",
    color: "white",
    border: "none",
    borderRadius: "6px",
    fontSize: "14px",
    fontWeight: "500",
    cursor: "pointer",
    transition: "background-color 0.2s",
  },
  content: {
    padding: "40px 20px",
    maxWidth: "800px",
    margin: "0 auto",
  },
  welcomeCard: {
    backgroundColor: "white",
    borderRadius: "12px",
    padding: "40px",
    boxShadow: "0 2px 10px rgba(0, 0, 0, 0.1)",
  },
  welcomeTitle: {
    fontSize: "32px",
    fontWeight: "600",
    color: "#1a1a1a",
    marginTop: 0,
    marginBottom: "24px",
  },
  userInfo: {
    display: "flex",
    gap: "20px",
    alignItems: "center",
    marginBottom: "32px",
    padding: "20px",
    backgroundColor: "#f9f9f9",
    borderRadius: "8px",
  },
  avatar: {
    width: "80px",
    height: "80px",
    borderRadius: "50%",
    objectFit: "cover",
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: "20px",
    fontWeight: "600",
    color: "#1a1a1a",
    margin: "0 0 4px 0",
  },
  userEmail: {
    fontSize: "16px",
    color: "#666",
    margin: "0 0 8px 0",
  },
  userId: {
    fontSize: "12px",
    color: "#999",
    fontFamily: "monospace",
    margin: 0,
  },
  infoBox: {
    borderLeft: "4px solid #4285f4",
    paddingLeft: "20px",
    marginTop: "24px",
  },
  infoText: {
    fontSize: "16px",
    color: "#666",
    margin: "8px 0",
  },
};
