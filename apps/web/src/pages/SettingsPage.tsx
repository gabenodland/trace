import { useAuthState } from "@trace/core";

export function SettingsPage() {
  const { user, authMutations } = useAuthState();

  const handleSignOut = async () => {
    await authMutations.signOut();
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Settings</h1>
      <p className="text-gray-600 mb-8">
        Manage your account and preferences
      </p>

      {/* Account Section */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Account</h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <p className="text-gray-900">{user?.email}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              User ID
            </label>
            <p className="text-gray-500 text-sm font-mono">{user?.id}</p>
          </div>
          <div className="pt-4">
            <button
              onClick={handleSignOut}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Preferences Section */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Preferences</h2>
        </div>
        <div className="p-6">
          <p className="text-gray-500 text-center py-8">
            Preferences coming soon...
          </p>
        </div>
      </div>
    </div>
  );
}
