import { useAuthState } from "@trace/core";
import { LoginPage } from "./modules/auth/pages/LoginPage";
import { HomePage } from "./modules/auth/pages/HomePage";

function App() {
  const { isAuthenticated, isLoading } = useAuthState();

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner}></div>
        <p style={styles.loadingText}>Loading...</p>
      </div>
    );
  }

  // Show LoginPage if not authenticated, HomePage if authenticated
  return isAuthenticated ? <HomePage /> : <LoginPage />;
}

const styles: Record<string, React.CSSProperties> = {
  loading: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f5f5f5",
  },
  spinner: {
    width: "40px",
    height: "40px",
    border: "4px solid #f3f3f3",
    borderTop: "4px solid #4285f4",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  loadingText: {
    marginTop: "16px",
    color: "#666",
    fontSize: "16px",
  },
};

export default App;
