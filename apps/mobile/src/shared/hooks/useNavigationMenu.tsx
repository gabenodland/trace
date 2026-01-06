import Svg, { Path, Circle } from "react-native-svg";
import { useAuth } from "../contexts/AuthContext";
import { useNavigation } from "../contexts/NavigationContext";
import { useProfile } from "@trace/core";

export function useNavigationMenu() {
  const { user, signOut } = useAuth();
  const { navigate } = useNavigation();
  const { profile } = useProfile(user?.id);

  const menuItems = [
    {
      label: "Entries",
      onPress: () => navigate("inbox"),
      icon: (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
          <Path d="M22 12h-6l-2 3h-4l-2-3H2" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      ),
    },
    {
      label: "Locations",
      onPress: () => navigate("locations"),
      icon: (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
          <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx="12" cy="10" r="3" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      ),
    },
    {
      label: "Map",
      onPress: () => navigate("map"),
      icon: (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
          <Path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M8 2v16M16 6v16" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      ),
    },
    {
      label: "Calendar",
      onPress: () => navigate("calendar"),
      icon: (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
          <Path d="M3 9h18M7 3v2m10-2v2" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      ),
    },
    { isDivider: true },
    {
      label: "Streams",
      onPress: () => navigate("streams"),
      icon: (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
          <Path d="M12 2L2 7l10 5 10-5-10-5z" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M2 17l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      ),
    },
    {
      label: "Settings",
      onPress: () => navigate("settings"),
      icon: (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
          <Circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      ),
    },
    {
      label: "Database Info",
      onPress: () => navigate("debug"),
      icon: (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
          <Path d="M21 5c0 1.66-4.03 3-9 3S3 6.66 3 5m18 0c0-1.66-4.03-3-9-3S3 3.34 3 5m18 0v14c0 1.66-4.03 3-9 3s-9-1.34-9-3V5m18 7c0 1.66-4.03 3-9 3s-9-1.34-9-3" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      ),
    },
  ];

  const handleProfilePress = () => navigate("profile");

  // Display name priority: name > username > email
  const displayName = profile?.name || (profile?.username ? `@${profile.username}` : null) || user?.email || null;

  return {
    menuItems,
    userEmail: user?.email,
    displayName,
    avatarUrl: profile?.avatar_url || null,
    onProfilePress: handleProfilePress,
  };
}
