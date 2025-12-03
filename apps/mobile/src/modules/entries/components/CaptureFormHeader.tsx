/**
 * CaptureFormHeader - Header bar with Cancel/Date/Save buttons
 * Extracted from CaptureForm for maintainability
 */

import { View, Text, TextInput, TouchableOpacity, Keyboard } from "react-native";
import Svg, { Path, Circle, Line } from "react-native-svg";
import { NavigationMenu } from "../../../components/navigation/NavigationMenu";
import { styles } from "./CaptureForm.styles";

interface MenuItem {
  label?: string;
  onPress?: () => void;
  destructive?: boolean;
  isDivider?: boolean;
}

interface CaptureFormHeaderProps {
  // Mode flags
  isEditMode: boolean;
  isFullScreen: boolean;
  isSubmitting: boolean;
  isEditing: boolean;
  // Form data
  title: string;
  entryDate: string;
  includeTime: boolean;
  // Callbacks
  onTitleChange: (text: string) => void;
  onCancel: () => void;
  onBack: () => void;
  onSave: () => void;
  onDatePress: () => void;
  onTimePress: () => void;
  onAddTime: () => void;
  onMenuToggle: () => void;
  enterEditMode: () => void;
  // Menu
  showMenu: boolean;
  menuItems: MenuItem[];
  userEmail: string | null;
  onProfilePress: () => void;
  onMenuClose: () => void;
  // Refs
  editorRef: React.RefObject<any>;
}

export function CaptureFormHeader({
  isEditMode,
  isFullScreen,
  isSubmitting,
  isEditing,
  title,
  entryDate,
  includeTime,
  onTitleChange,
  onCancel,
  onBack,
  onSave,
  onDatePress,
  onTimePress,
  onAddTime,
  onMenuToggle,
  enterEditMode,
  showMenu,
  menuItems,
  userEmail,
  onProfilePress,
  onMenuClose,
  editorRef,
}: CaptureFormHeaderProps) {
  return (
    <View style={[styles.titleBar, isFullScreen && styles.titleBarFullScreen]}>
      {/* Left side: Cancel button in edit mode, Back button in view mode */}
      <View style={styles.headerLeftContainer}>
        {isEditMode ? (
          <TouchableOpacity
            onPress={onCancel}
            style={styles.headerCancelButton}
          >
            <Text style={styles.headerCancelText}>Cancel</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={onBack}
            style={styles.headerCancelButton}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
              <Path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
        )}
      </View>

      {/* Center: Date & Time (normal mode) or Editable Title (fullscreen mode) */}
      {isFullScreen ? (
        <View style={styles.headerTitleContainer}>
          <TextInput
            value={title}
            onChangeText={onTitleChange}
            placeholder="Untitled"
            placeholderTextColor="#9ca3af"
            style={styles.headerTitleInput}
            editable={isEditMode && !isSubmitting}
            returnKeyType="done"
            blurOnSubmit={true}
          />
        </View>
      ) : (
        <View style={styles.headerDateContainer}>
          {/* Date */}
          <TouchableOpacity
            onPress={() => {
              editorRef.current?.blur();
              Keyboard.dismiss();
              setTimeout(() => {
                onDatePress();
                if (!isEditMode) enterEditMode();
              }, 100);
            }}
          >
            <Text style={styles.headerDateText}>
              {entryDate ? new Date(entryDate).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              }) : 'Set date'}
            </Text>
          </TouchableOpacity>

          {/* Time or Watch Icon */}
          {includeTime ? (
            <TouchableOpacity
              style={styles.headerTimeContainer}
              onPress={() => {
                onTimePress();
                if (!isEditMode) enterEditMode();
              }}
            >
              <Text style={styles.headerDateText}>
                {entryDate ? new Date(entryDate).toLocaleTimeString(undefined, {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true
                }) : 'Set time'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.headerWatchButton}
              onPress={() => {
                onAddTime();
                if (!isEditMode) enterEditMode();
              }}
            >
              <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth={2}>
                <Circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round" />
                <Path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Right side: Save button (in edit mode) + Hamburger Menu (hidden in fullscreen) */}
      <View style={styles.headerRightContainer}>
        {/* Save button only shows in edit mode */}
        {isEditMode && (
          <TouchableOpacity
            onPress={onSave}
            disabled={isSubmitting}
            style={[styles.headerSaveButton, isSubmitting && styles.headerSaveButtonDisabled]}
          >
            <Text style={[styles.headerSaveText, isSubmitting && styles.headerSaveTextDisabled]}>
              {isSubmitting ? "Saving..." : "Save"}
            </Text>
          </TouchableOpacity>
        )}

        {/* Hamburger Menu - hidden in fullscreen mode */}
        {!isFullScreen && (
          <TouchableOpacity
            style={styles.menuButton}
            onPress={onMenuToggle}
          >
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#1f2937" strokeWidth={2}>
              <Line x1="3" y1="6" x2="21" y2="6" strokeLinecap="round" />
              <Line x1="3" y1="12" x2="21" y2="12" strokeLinecap="round" />
              <Line x1="3" y1="18" x2="21" y2="18" strokeLinecap="round" />
            </Svg>
          </TouchableOpacity>
        )}

        <NavigationMenu
          visible={showMenu}
          onClose={onMenuClose}
          menuItems={menuItems}
          userEmail={userEmail ?? undefined}
          onProfilePress={onProfilePress}
        />
      </View>
    </View>
  );
}
