/**
 * EntryHeader - Header bar with Cancel/Date/Save buttons
 * Extracted from EntryScreen for maintainability
 */

import { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, Keyboard } from "react-native";
import Svg, { Path, Circle, Polyline } from "react-native-svg";
import { useTheme } from "../../../shared/contexts/ThemeContext";
import { styles } from "./EntryScreen.styles";

interface EntryHeaderProps {
  // Mode flags
  isEditMode: boolean;
  isFullScreen: boolean;
  isSaving: boolean; // For save indicator (includes autosave, unlike isSubmitting which is manual only)
  isDirty: boolean;
  // Form data
  entryDate: string;
  includeTime: boolean;
  // Callbacks
  onBack: () => void;
  onDatePress: () => void;
  onTimePress: () => void;
  onAddTime: () => void;
  onToggleFullScreen: () => void;
  enterEditMode: () => void;
  // Refs
  editorRef: React.RefObject<any>;
}

export function EntryHeader({
  isEditMode,
  isFullScreen,
  isSaving,
  isDirty,
  entryDate,
  includeTime,
  onBack,
  onDatePress,
  onTimePress,
  onAddTime,
  onToggleFullScreen,
  enterEditMode,
  editorRef,
}: EntryHeaderProps) {
  const theme = useTheme();

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
    <View style={[styles.titleBar, { backgroundColor: theme.colors.background.secondary }, isFullScreen && styles.titleBarFullScreen]}>
      {/* Left side: Back button (always shown, auto-saves if dirty) */}
      <View style={styles.headerLeftContainer}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.headerCancelButton}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.secondary} strokeWidth={2}>
            <Path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
      </View>

      {/* Center: Date & Time */}
      {isFullScreen ? (
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerDateText, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.medium }]}>
            Full Screen
          </Text>
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
            <Text style={[styles.headerDateText, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.medium }]}>
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
              <Text style={[styles.headerDateText, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.medium }]}>
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
              <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.tertiary} strokeWidth={2}>
                <Circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round" />
                <Path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Right side: Status indicator (in edit mode) + Attributes menu */}
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

        {/* Fullscreen toggle button - chevron down (V) when normal, chevron up (^) when fullscreen */}
        <TouchableOpacity
          style={styles.menuButton}
          onPress={onToggleFullScreen}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.secondary} strokeWidth={2.5}>
            {isFullScreen ? (
              // Chevron up (^) - exit fullscreen
              <Path d="M18 15l-6-6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            ) : (
              // Chevron down (V) - enter fullscreen
              <Path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            )}
          </Svg>
        </TouchableOpacity>
      </View>
    </View>
  );
}
