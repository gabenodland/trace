/**
 * CaptureFormHeader - Header bar with Cancel/Date/Save buttons
 * Extracted from CaptureForm for maintainability
 */

import { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, Keyboard } from "react-native";
import Svg, { Path, Circle, Line, Polyline } from "react-native-svg";
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
  isSaving: boolean; // For save indicator (includes autosave, unlike isSubmitting which is manual only)
  isEditing: boolean;
  isDirty: boolean;
  // Form data
  title: string;
  entryDate: string;
  includeTime: boolean;
  // Callbacks
  onTitleChange: (text: string) => void;
  onBack: () => void;
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
  isSaving,
  isEditing,
  isDirty,
  title,
  entryDate,
  includeTime,
  onTitleChange,
  onBack,
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
  // Track "just saved" state to show green checkmark briefly
  const [showSavedCheck, setShowSavedCheck] = useState(false);
  const wasSavingRef = useRef(false);

  // Detect save completion: isSaving goes from true to false (includes autosave)
  useEffect(() => {
    if (wasSavingRef.current && !isSaving) {
      // Just finished saving - show checkmark for 300ms
      setShowSavedCheck(true);
      const timer = setTimeout(() => setShowSavedCheck(false), 300);
      return () => clearTimeout(timer);
    }
    wasSavingRef.current = isSaving;
  }, [isSaving]);

  return (
    <View style={[styles.titleBar, isFullScreen && styles.titleBarFullScreen]}>
      {/* Left side: Back button (always shown, auto-saves if dirty) */}
      <View style={styles.headerLeftContainer}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.headerCancelButton}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
            <Path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
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

      {/* Right side: Status indicator (in edit mode) + Hamburger Menu (hidden in fullscreen) */}
      <View style={styles.headerRightContainer}>
        {/* Status indicator - orange when dirty, red when saving, green checkmark briefly after save */}
        {isEditMode && (
          <View style={styles.headerSaveButton}>
            {isSaving ? (
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' }} />
            ) : showSavedCheck ? (
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth={3}>
                <Polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            ) : isDirty ? (
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#f97316' }} />
            ) : null}
          </View>
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
