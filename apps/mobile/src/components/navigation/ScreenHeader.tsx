import { View, Text, StyleSheet, TouchableOpacity, Modal, TouchableWithoutFeedback } from "react-native";
import { useAuth } from "../../shared/contexts/AuthContext";
import { useState } from "react";
import Svg, { Path } from "react-native-svg";

interface ScreenHeaderProps {
  title: string;
  badge?: number;
  showProfile?: boolean;
  onTitlePress?: () => void;
  showDropdownArrow?: boolean;
}

export function ScreenHeader({ title, badge, showProfile = false, onTitlePress, showDropdownArrow = false }: ScreenHeaderProps) {
  const { user, signOut } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);

  console.log("ScreenHeader - title:", title, "showDropdownArrow:", showDropdownArrow, "onTitlePress:", !!onTitlePress);

  const getInitials = (email: string) => {
    return email.charAt(0).toUpperCase();
  };

  const handleProfilePress = () => {
    setShowDropdown(!showDropdown);
  };

  const handleSignOut = async () => {
    setShowDropdown(false);
    await signOut();
  };

  const TitleContent = (
    <View style={styles.titleContainer}>
      <Text style={styles.title}>{title}</Text>
      {showDropdownArrow && (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth={2} style={styles.arrow}>
          <Path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      )}
      {badge !== undefined && badge > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 99 ? "99+" : badge}</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.header}>
      {onTitlePress ? (
        <TouchableOpacity onPress={onTitlePress} style={styles.titleTouchable}>
          {TitleContent}
        </TouchableOpacity>
      ) : (
        TitleContent
      )}

      {showProfile && user?.email && (
        <>
          <TouchableOpacity onPress={handleProfilePress} style={styles.profileButton}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(user.email)}</Text>
            </View>
          </TouchableOpacity>

          <Modal
            visible={showDropdown}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowDropdown(false)}
          >
            <TouchableWithoutFeedback onPress={() => setShowDropdown(false)}>
              <View style={styles.modalOverlay}>
                <TouchableWithoutFeedback>
                  <View style={styles.dropdown}>
                    <View style={styles.dropdownHeader}>
                      <Text style={styles.dropdownUsername}>
                        {user.email?.split("@")[0]}
                      </Text>
                      <Text style={styles.dropdownEmail} numberOfLines={1}>
                        {user.email}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.signOutButton}
                      onPress={handleSignOut}
                    >
                      <Text style={styles.signOutText}>Sign Out</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableWithoutFeedback>
              </View>
            </TouchableWithoutFeedback>
          </Modal>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    minHeight: 120,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleTouchable: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  arrow: {
    marginLeft: 8,
    marginTop: 4,
  },
  badge: {
    backgroundColor: "#ef4444",
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 12,
    paddingHorizontal: 8,
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  profileButton: {
    marginLeft: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#3b82f6",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingTop: 110,
    paddingRight: 20,
  },
  dropdown: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    minWidth: 200,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  dropdownHeader: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  dropdownUsername: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  dropdownEmail: {
    fontSize: 13,
    color: "#6b7280",
  },
  signOutButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  signOutText: {
    fontSize: 15,
    color: "#ef4444",
    fontWeight: "500",
  },
});
