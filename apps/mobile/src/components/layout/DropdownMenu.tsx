import { View, Text, TouchableOpacity, StyleSheet, Modal, TouchableWithoutFeedback, Dimensions } from "react-native";
import { theme } from "../../shared/theme/theme";

export interface DropdownMenuItem {
  label: string;
  onPress: () => void;
  isDanger?: boolean;
}

interface DropdownMenuProps {
  visible: boolean;
  onClose: () => void;
  items: DropdownMenuItem[];
  anchorPosition?: { x: number; y: number }; // Position where menu was opened
}

const MENU_ITEM_HEIGHT = 44; // paddingVertical: 12 * 2 + fontSize: 14 + some spacing
const MENU_WIDTH = 140;
const BUTTON_WIDTH = 32; // Approximate width of the ... button (20px icon + 6px padding each side)
const BUTTON_PADDING = 6; // Padding around the button

export function DropdownMenu({ visible, onClose, items, anchorPosition }: DropdownMenuProps) {
  if (!visible) return null;

  const screenHeight = Dimensions.get('window').height;
  const screenWidth = Dimensions.get('window').width;
  const menuHeight = items.length * MENU_ITEM_HEIGHT;

  // Calculate position
  let menuRight = 48; // Default: 48px from right edge
  let menuTop = 100;

  if (anchorPosition) {
    // Since button is on the right, calculate distance from right edge
    const distanceFromRight = screenWidth - anchorPosition.x;

    // Position menu to the left of the button with 8px gap
    // Button is approximately 32px wide, so: button width + gap
    menuRight = distanceFromRight + BUTTON_WIDTH + 8;

    // Align top of menu with top of button
    // pageY can be affected by scrolling/layout, so we need to adjust
    // Subtract button height + some extra to align properly
    menuTop = anchorPosition.y - BUTTON_WIDTH - 12; // Extra 12px for row padding

    // If menu would go off bottom of screen, adjust upward
    if (menuTop + menuHeight > screenHeight - 20) {
      menuTop = screenHeight - menuHeight - 20; // 20px padding from bottom
    }

    // Don't go above the top of screen
    if (menuTop < 20) {
      menuTop = 20;
    }
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[
              styles.menuDropdown,
              {
                position: 'absolute',
                right: menuRight,
                top: menuTop,
              }
            ]}>
              {items.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.menuItem,
                    item.isDanger && styles.menuItemDanger,
                    index === items.length - 1 && styles.menuItemLast
                  ]}
                  onPress={() => {
                    item.onPress();
                    onClose();
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.menuItemText,
                    item.isDanger && styles.menuItemDangerText
                  ]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  menuDropdown: {
    backgroundColor: theme.colors.background.primary,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border.dark,
    minWidth: 140,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.light,
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuItemText: {
    fontSize: 14,
    color: theme.colors.text.primary,
    fontWeight: "500",
  },
  menuItemDanger: {
    borderBottomWidth: 0,
  },
  menuItemDangerText: {
    color: "#ef4444",
  },
});
