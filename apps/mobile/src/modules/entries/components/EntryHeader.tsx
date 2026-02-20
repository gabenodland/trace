/**
 * EntryHeader - Header bar with Cancel/Date/Save buttons
 * Extracted from EntryScreen for maintainability
 */

import { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, Keyboard } from "react-native";
import { useTheme } from "../../../shared/contexts/ThemeContext";
import { Icon } from "../../../shared/components";
import { styles } from "./EntryScreen.styles";

interface EntryHeaderProps {
  // Mode flags
  isEditMode: boolean;
  isFullScreen: boolean;
  isSaving: boolean; // For save indicator (includes autosave, unlike isSubmitting which is manual only)
  isDirty: boolean;
  // Entry status
  isPinned?: boolean;
  isArchived?: boolean;
  // Form data
  entryDate: string;
  includeTime: boolean;
  // Layout
  topInset?: number;
  // Callbacks
  onBack: () => void;
  onDatePress: () => void;
  onTimePress: () => void;
  onAddTime: () => void;
  onToggleFullScreen: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  // Refs
  editorRef: React.RefObject<any>;
}

export function EntryHeader({
  isEditMode,
  isFullScreen,
  isSaving,
  isDirty,
  isPinned = false,
  isArchived = false,
  entryDate,
  includeTime,
  topInset = 0,
  onBack,
  onDatePress,
  onTimePress,
  onAddTime,
  onToggleFullScreen,
  onUndo,
  onRedo,
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
    <View style={[styles.titleBar, { backgroundColor: theme.colors.background.secondary, paddingTop: topInset + 10 }, isFullScreen && styles.titleBarFullScreen]}>
      {/* Left side: Back button (always shown, auto-saves if dirty) */}
      <View style={styles.headerLeftContainer}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.headerCancelButton}
        >
          <Icon name="ArrowLeft" size={20} color={theme.colors.text.secondary} />
        </TouchableOpacity>
      </View>

      {/* Center: Date & Time (or Undo/Redo in full screen) */}
      {isFullScreen ? (
        <View style={styles.headerTitleContainer}>
          <TouchableOpacity
            onPress={onUndo}
            style={{ padding: 8, marginRight: 16 }}
            disabled={!onUndo}
          >
            <Icon name="Undo2" size={20} color={onUndo ? theme.colors.text.secondary : theme.colors.text.tertiary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onRedo}
            style={{ padding: 8 }}
            disabled={!onRedo}
          >
            <Icon name="Redo2" size={20} color={onRedo ? theme.colors.text.secondary : theme.colors.text.tertiary} />
          </TouchableOpacity>
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
              }}
            >
              <Icon name="Clock" size={12} color={theme.colors.text.tertiary} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Right side: Pinned/Archived icons + Status indicator (in edit mode) + Attributes menu */}
      <View style={styles.headerRightContainer}>
        {/* Pinned indicator */}
        {isPinned && (
          <View style={{ marginRight: 6 }}>
            <Icon name="Pin" size={14} color={theme.colors.text.tertiary} />
          </View>
        )}

        {/* Archived indicator */}
        {isArchived && (
          <View style={{ marginRight: 6 }}>
            <Icon name="Archive" size={14} color={theme.colors.text.tertiary} />
          </View>
        )}

        {/* Status indicator - always reserve space, show content only in edit mode */}
        <View style={styles.headerSaveButton}>
          {isEditMode && (
            isSaving ? (
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' }} />
            ) : showSavedCheck ? (
              <Icon name="Check" size={14} color="#22c55e" />
            ) : isDirty ? (
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#f97316' }} />
            ) : null
          )}
        </View>

        {/* Fullscreen toggle button */}
        <TouchableOpacity
          style={styles.menuButton}
          onPress={onToggleFullScreen}
        >
          <Icon name={isFullScreen ? "Minimize2" : "Maximize2"} size={20} color={theme.colors.text.secondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
