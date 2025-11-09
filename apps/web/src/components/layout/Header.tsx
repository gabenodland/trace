import { useState, useEffect } from "react";
import { useAuthState } from "@trace/core";
import { useLocation, useNavigate } from "react-router-dom";
import { InboxCategoryDropdown } from "./InboxCategoryDropdown";

export function Header() {
  const { user, authMutations } = useAuthState();
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showInboxDropdown, setShowInboxDropdown] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Parse category from URL
  const searchParams = new URLSearchParams(location.search);
  const categoryParam = searchParams.get("category");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null | "all">(
    categoryParam === "all" ? "all" : categoryParam || null
  );
  const [selectedCategoryName, setSelectedCategoryName] = useState<string>(
    categoryParam === "all" ? "All" : categoryParam ? "Loading..." : "Inbox"
  );

  // Show inbox selector only on inbox page
  const isInboxPage = location.pathname === "/inbox";

  const handleSignOut = async () => {
    await authMutations.signOut();
  };

  const getInitials = (email: string) => {
    return email.charAt(0).toUpperCase();
  };

  const handleCategorySelect = (categoryId: string | null | "all", categoryName: string) => {
    setSelectedCategoryId(categoryId);
    setSelectedCategoryName(categoryName);

    // Update URL with selected category
    const params = new URLSearchParams();
    if (categoryId === "all") {
      params.set("category", "all");
    } else if (categoryId !== null) {
      params.set("category", categoryId);
    }
    // If categoryId is null (Inbox), don't add category param

    navigate(`/inbox?${params.toString()}`, { replace: true });
  };

  // Update selected category name when URL changes
  useEffect(() => {
    if (categoryParam === "all") {
      setSelectedCategoryId("all");
      setSelectedCategoryName("All");
    } else if (categoryParam) {
      setSelectedCategoryId(categoryParam);
      // Name will be set when dropdown loads the categories
    } else {
      setSelectedCategoryId(null);
      setSelectedCategoryName("Inbox");
    }
  }, [categoryParam]);

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 min-h-[72px]">
      <div className="flex items-center justify-between h-full">
        <div className="flex-1 flex items-center">
          {/* Inbox Category Selector - only show on inbox page */}
          {isInboxPage ? (
            <div className="relative inline-block">
              <button
                onClick={() => setShowInboxDropdown(!showInboxDropdown)}
                className="flex items-center gap-2 hover:bg-gray-50 rounded-lg px-2 py-1 transition-colors"
              >
                <h1 className="text-2xl font-bold text-gray-900">
                  {selectedCategoryName || "Inbox"}
                </h1>
                <svg
                  className="w-5 h-5 text-gray-500 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              <InboxCategoryDropdown
                visible={showInboxDropdown}
                onClose={() => setShowInboxDropdown(false)}
                onSelect={handleCategorySelect}
                selectedCategoryId={selectedCategoryId}
              />
            </div>
          ) : (
            <div className="h-8"></div>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            className="flex items-center gap-3 hover:bg-gray-50 rounded-lg px-3 py-2 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white font-semibold">
              {user?.email ? getInitials(user.email) : "?"}
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-sm font-medium text-gray-900">
                {user?.email?.split("@")[0]}
              </div>
              <div className="text-xs text-gray-500">
                {user?.email}
              </div>
            </div>
            <svg
              className={`w-4 h-4 text-gray-500 transition-transform ${showUserDropdown ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showUserDropdown && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowUserDropdown(false)}
              />
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                <div className="px-4 py-3 border-b border-gray-100">
                  <div className="text-sm font-medium text-gray-900">
                    {user?.email?.split("@")[0]}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {user?.email}
                  </div>
                </div>

                <button
                  onClick={handleSignOut}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
