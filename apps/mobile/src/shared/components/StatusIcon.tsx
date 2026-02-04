/**
 * StatusIcon - Shared status icon component
 * Renders the appropriate icon for each entry status
 * Uses theme-aware colors based on status category
 */

import React from "react";
import { getStatusCategory, type EntryStatus, type StatusCategory } from "@trace/core";
import { useTheme } from "../contexts/ThemeContext";
import { Icon } from "./Icon";

interface StatusIconProps {
  status: EntryStatus;
  size?: number;
  /** Override the theme color */
  color?: string;
}

/**
 * Get color from theme based on status category
 */
function getThemeStatusColor(
  category: StatusCategory,
  statusColors: { open: string; working: string; blocked: string; complete: string; cancelled: string },
  textDisabled: string
): string {
  switch (category) {
    case 'open': return statusColors.open;
    case 'working': return statusColors.working;
    case 'blocked': return statusColors.blocked;
    case 'complete': return statusColors.complete;
    case 'cancelled': return statusColors.cancelled;
    case 'none':
    default: return textDisabled;
  }
}

/**
 * Icon map for status to icon name mapping
 */
const statusIconMap: Record<EntryStatus, string> = {
  none: "Ban",
  new: "PlusCircle",
  todo: "Circle",
  in_progress: "Clock",
  in_review: "Eye",
  waiting: "CirclePause",
  on_hold: "CircleStop",
  done: "CheckCircle",
  closed: "Info",
  cancelled: "XCircle",
};

/**
 * Renders the appropriate icon for a given entry status
 * Uses theme-aware colors based on status category
 */
export function StatusIcon({ status, size = 20, color }: StatusIconProps): React.ReactElement {
  const theme = useTheme();
  const category = getStatusCategory(status);
  const iconColor = color ?? getThemeStatusColor(category, theme.colors.status, theme.colors.text.disabled);
  const iconName = statusIconMap[status] || "Circle";

  return <Icon name={iconName as any} size={size} color={iconColor} />;
}
