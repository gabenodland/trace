/**
 * StatusIcon - Shared status icon component
 * Renders the appropriate icon for each entry status
 */

import React from "react";
import Svg, { Path, Circle, Line, Rect } from "react-native-svg";
import { getStatusColor, type EntryStatus } from "@trace/core";

interface StatusIconProps {
  status: EntryStatus;
  size?: number;
  /** Override the default color from status */
  color?: string;
}

/**
 * Renders the appropriate icon for a given entry status
 * Uses consistent icons across the app
 */
export function StatusIcon({ status, size = 20, color }: StatusIconProps): React.ReactElement {
  const iconColor = color ?? getStatusColor(status);
  const strokeWidth = 2;

  switch (status) {
    case "none":
      // Circle with slash (no/optional status)
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth={strokeWidth}>
          <Circle cx={12} cy={12} r={10} />
          <Line x1={4.93} y1={4.93} x2={19.07} y2={19.07} strokeLinecap="round" />
        </Svg>
      );
    case "new":
      // Sparkle/star icon
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth={strokeWidth}>
          <Path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7-6.3-4.6L5.7 21l2.3-7-6-4.6h7.6z" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case "todo":
      // Empty circle
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth={strokeWidth}>
          <Circle cx={12} cy={12} r={10} />
        </Svg>
      );
    case "in_progress":
      // Clock icon
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth={strokeWidth}>
          <Circle cx={12} cy={12} r={10} />
          <Path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case "in_review":
      // Eye icon
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth={strokeWidth}>
          <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <Circle cx={12} cy={12} r={3} />
        </Svg>
      );
    case "waiting":
      // Pause icon
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth={strokeWidth}>
          <Circle cx={12} cy={12} r={10} />
          <Line x1={10} y1={8} x2={10} y2={16} strokeLinecap="round" />
          <Line x1={14} y1={8} x2={14} y2={16} strokeLinecap="round" />
        </Svg>
      );
    case "on_hold":
      // Stop/square icon
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth={strokeWidth}>
          <Circle cx={12} cy={12} r={10} />
          <Rect x={8} y={8} width={8} height={8} rx={1} />
        </Svg>
      );
    case "done":
      // Checkmark
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth={strokeWidth}>
          <Circle cx={12} cy={12} r={10} />
          <Path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case "closed":
      // Info/lock icon
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth={strokeWidth}>
          <Circle cx={12} cy={12} r={10} />
          <Path d="M12 8v4m0 4h.01" strokeLinecap="round" />
        </Svg>
      );
    case "cancelled":
      // X icon
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth={strokeWidth}>
          <Circle cx={12} cy={12} r={10} />
          <Line x1={15} y1={9} x2={9} y2={15} strokeLinecap="round" />
          <Line x1={9} y1={9} x2={15} y2={15} strokeLinecap="round" />
        </Svg>
      );
    default:
      // Default circle
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth={strokeWidth}>
          <Circle cx={12} cy={12} r={10} />
        </Svg>
      );
  }
}
