/**
 * Unified Icon Component
 *
 * Supports both Lucide library icons and custom SVG icons.
 * Use this component for ALL icons in the app.
 *
 * Usage:
 *   <Icon name="Camera" size={20} color={theme.colors.text.primary} />
 *   <Icon name="CustomCamera" size={24} color="#000" />
 */

import React, { createElement } from 'react';
import * as LucideIcons from 'lucide-react-native';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { createScopedLogger } from '../utils/logger';

const log = createScopedLogger('Icon', '🎨');

// Custom SVG icons that we prefer over Lucide versions
const CustomIcons = {
  // Camera icon from PhotoGallery.tsx (lines 279-293)
  CustomCamera: (props: any) => (
    <Svg viewBox="0 0 24 24" fill="none" {...props}>
      <Path
        d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
        stroke={props.stroke || props.color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 17a4 4 0 100-8 4 4 0 000 8z"
        stroke={props.stroke || props.color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  ),

  // Gallery icon from PhotoGallery.tsx (lines 305-323)
  CustomGallery: (props: any) => (
    <Svg viewBox="0 0 24 24" fill="none" {...props}>
      <Path
        d="M4 16l4.586-4.586a2 2 0 0 1 2.828 0L16 16m-2-2l1.586-1.586a2 2 0 0 1 2.828 0L20 14.5"
        stroke={props.stroke || props.color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6z"
        stroke={props.stroke || props.color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"
        fill={props.fill || props.color}
      />
    </Svg>
  ),

  // Filled star icon for rating pickers
  StarFilled: (props: any) => (
    <Svg viewBox="0 0 24 24" {...props}>
      <Path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        fill={props.fill || props.color}
        stroke="none"
      />
    </Svg>
  ),

  // Solid filled map pin with white circle cutout (original pre-Lucide marker icon)
  MapPinSolid: (props: any) => (
    <Svg viewBox="0 0 24 24" {...props}>
      <Path
        d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"
        fill={props.fill || props.color}
        stroke="none"
      />
      <Circle cx="12" cy="10" r="3" fill="#ffffff" />
    </Svg>
  ),

  // Add more custom icons here as needed
};

// Type for custom icon names
type CustomIconName = keyof typeof CustomIcons;

// Type for Lucide icon names
type LucideIconName = keyof typeof LucideIcons;

// Combined icon names
export type IconName = CustomIconName | LucideIconName;

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  style?: any;
}

export function Icon({ name, size = 24, color, style }: IconProps) {
  // Check custom icons first
  if (name in CustomIcons) {
    const CustomIconComponent = CustomIcons[name as CustomIconName];
    return createElement(CustomIconComponent, {
      width: size,
      height: size,
      color: color,
      stroke: color,
      style,
    });
  }

  // Fall back to Lucide
  const LucideIcon = (LucideIcons as any)[name as LucideIconName];
  if (LucideIcon) {
    return createElement(LucideIcon, {
      size,
      color,
      style,
    });
  }

  // Icon not found
  log.warn(`Icon "${name}" not found in custom or Lucide icons`);
  return null;
}
