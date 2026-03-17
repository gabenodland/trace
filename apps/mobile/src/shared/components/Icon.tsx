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
import Svg, { Path, Circle, Line, G, Defs, ClipPath, Rect } from 'react-native-svg';
import { createScopedLogger } from '../utils/logger';

const log = createScopedLogger('Icon', '🎨');

// Forget-me-not petal path (from Affinity Designer export — single petal, reused with transforms)
const PETAL_D = "M1012.5,1863.23C1043.85,1861.27 1129.27,1695.8 1129.27,1649.63C1129.27,1603.45 1049.37,1543.61 1012.5,1543.61C975.629,1543.61 891.792,1603.45 891.792,1649.63C891.792,1695.8 975.621,1865.52 1012.5,1863.23Z";
// Per-petal transform matrices (rotation + scale + translate in 1024x1024 space)
const PETAL_TRANSFORMS = [
  "matrix(0.739528,0,0,0.70735,-236.748,-810.221)",
  "matrix(0.228527,0.67273,-0.703333,0.218583,1599.46,-574.874)",
  "matrix(-0.598291,0.41577,-0.434684,-0.572258,1932.87,1168.2)",
  "matrix(-0.598291,-0.41577,0.434684,-0.572258,302.719,2010.14)",
  "matrix(0.228527,-0.67273,0.703333,0.218583,-1038.18,787.404)",
];
// White starburst rays between petals and center
const STARBURST_D = "M1012.5,1784.25C1012.5,1784.25 1008.15,1838.59 999.358,1841.48C990.561,1844.36 959.72,1801.56 959.72,1801.56C959.72,1801.56 990.356,1843.71 984.639,1851.29C978.922,1858.88 925.419,1847.08 925.419,1847.08C925.419,1847.08 975.352,1867.75 975.571,1877.79C975.791,1887.84 926.738,1907.35 926.738,1907.35C926.738,1907.35 976.603,1889.55 981.962,1896.47C987.322,1903.38 958.896,1948.83 958.896,1948.83C958.896,1948.83 992.622,1907.49 1002.41,1910.41C1012.19,1913.34 1017.6,1966.38 1017.6,1966.38C1017.6,1966.38 1014.81,1913.13 1022.84,1910.1C1030.87,1907.06 1065.76,1948.17 1065.76,1948.17C1065.76,1948.17 1037.95,1902.37 1043.69,1894.04C1049.44,1885.71 1100.22,1898.2 1100.22,1898.2C1100.22,1898.2 1049.7,1883.92 1049.43,1875.31C1049.15,1866.71 1098.58,1846.58 1098.58,1846.58C1098.58,1846.58 1044.18,1857.82 1038.08,1849.74C1031.97,1841.66 1061.96,1798.1 1061.96,1798.1C1056.2,1801.86 1031.56,1843.3 1023.32,1840.99C1015.08,1838.68 1015.22,1789.46 1012.5,1784.25Z";
// Gold star shape at center
const GOLD_STAR_D = "M639.475,2000.78C644.246,2000.16 651.743,2005.18 654.984,2002.85C658.226,2000.52 657.384,1991.41 658.924,1986.78C660.504,1982.03 665.636,1975.86 664.118,1972.28C662.6,1968.71 654.129,1968.43 649.815,1965.36C645.335,1962.17 641.049,1953.22 637.24,1953.13C633.43,1953.05 630.858,1961.41 626.958,1964.84C622.799,1968.5 613.443,1971.13 612.288,1975.08C611.133,1979.02 617.843,1983.83 620.027,1988.51C622.315,1993.41 622.772,2002.46 626.013,2004.5C629.255,2006.55 634.859,2001.38 639.475,2000.78Z";
// Black center dot shape
const CENTER_DOT_D = "M638.797,1962.94C643.25,1962.94 646.028,1964.43 649.136,1967.16C652.831,1970.4 655.936,1973.76 655.936,1979.05C655.936,1984.9 653.553,1988.08 649.173,1991.3C646.248,1993.44 642.699,1994.71 638.797,1994.71C633.448,1994.71 630.761,1994.02 627.521,1990.26C624.857,1987.17 621.848,1982.73 621.848,1978.33C621.848,1973.64 624.538,1971.03 627.521,1967.87C630.742,1964.45 633.736,1962.94 638.797,1962.94Z";

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
  // Filled teardrop with white circle inside — named/favorite location marker
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

  // Filled teardrop without circle — unnamed/dropped pin marker
  MapPinFilled: (props: any) => (
    <Svg viewBox="0 0 24 24" {...props}>
      <Path
        d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"
        fill={props.fill || props.color}
        stroke="none"
      />
    </Svg>
  ),

  // Solid filled map pin with white star cutout — "My Place" (saved favorite) icon
  MapPinFavorite: (props: any) => (
    <Svg viewBox="0 0 24 24" {...props}>
      <Path
        d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"
        fill={props.fill || props.color}
        stroke="none"
      />
      <Path
        d="M12 4.2 L13.3 7.8 L17.2 7.9 L14 10.3 L15.1 13.9 L12 11.8 L8.9 13.9 L10 10.3 L6.8 7.9 L10.7 7.8 Z"
        fill="#ffffff"
        stroke="none"
      />
    </Svg>
  ),

  // Outline map pin with filled star inside — "My Place" icon for lists/UI (non-map)
  MapPinFavoriteLine: (props: any) => (
    <Svg viewBox="0 0 24 24" fill="none" {...props}>
      <Path
        d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"
        stroke={props.stroke || props.color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 3.6 L13.5 7.7 L17.8 7.8 L14.3 10.5 L15.5 14.5 L12 12.1 L8.5 14.5 L9.7 10.5 L6.2 7.8 L10.5 7.7 Z"
        fill={props.fill || props.color}
        stroke="none"
      />
    </Svg>
  ),

  // Map pin outline only — "Unnamed Place" icon (no inner shape)
  MapPinEmpty: (props: any) => (
    <Svg viewBox="0 0 24 24" fill="none" {...props}>
      <Path
        d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"
        stroke={props.stroke || props.color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  ),

  // Trace app logo — Lucide-style outline (stroke petals, center circle + dot)
  // Petals are clipped so they don't enter the center circle
  TraceLogoLine: (props: any) => {
    const stroke = props.stroke || props.color;
    const clipR = 74; // clip radius = circle outer edge (r + strokeWidth/2)
    return (
      <Svg viewBox="250 240 524 524" {...props}>
        <Defs>
          <ClipPath id="traceLineClip">
            <Rect x="250" y="240" width="524" height="524" />
            <Circle cx="512" cy="502" r={clipR} />
          </ClipPath>
        </Defs>
        <G clipPath="url(#traceLineClip)" clipRule="evenodd">
          {PETAL_TRANSFORMS.map((t, i) => (
            <G key={i} transform={t}>
              <Path d={PETAL_D} fill="none" stroke={stroke} strokeWidth={48} strokeLinejoin="round" />
            </G>
          ))}
        </G>
        <Circle cx="512" cy="502" r="55" fill="none" stroke={stroke} strokeWidth={48} />
        <Circle cx="512" cy="502" r="8" fill={stroke} stroke="none" />
      </Svg>
    );
  },

  // Trace app logo — filled petals, hollow center circle + dot
  TraceLogoFilled: (props: any) => {
    const fill = props.fill || props.color;
    const clipR = 74;
    return (
      <Svg viewBox="250 240 524 524" {...props}>
        <Defs>
          <ClipPath id="traceFilledClip">
            <Rect x="250" y="240" width="524" height="524" />
            <Circle cx="512" cy="502" r={clipR} />
          </ClipPath>
        </Defs>
        <G clipPath="url(#traceFilledClip)" clipRule="evenodd">
          {PETAL_TRANSFORMS.map((t, i) => (
            <G key={i} transform={t}>
              <Path d={PETAL_D} fill={fill} stroke="none" />
            </G>
          ))}
        </G>
        <Circle cx="512" cy="502" r="55" fill="none" stroke={fill} strokeWidth={48} />
        <Circle cx="512" cy="502" r="8" fill={fill} stroke="none" />
      </Svg>
    );
  },

  // Trace app logo — monochrome forget-me-not flower (takes color prop)
  // Uses actual petal paths from Affinity Designer export, viewBox 1024x1024
  TraceLogo: (props: any) => {
    const fill = props.fill || props.color;
    return (
      <Svg viewBox="250 240 524 524" {...props}>
        {PETAL_TRANSFORMS.map((t, i) => (
          <G key={i} transform={t}><Path d={PETAL_D} fill={fill} stroke="none" /></G>
        ))}
        <Circle cx="512" cy="502" r="70" fill="#FFFFFF" stroke="none" />
      </Svg>
    );
  },

  // Trace app logo — full color forget-me-not flower
  // Faithful reproduction of the Affinity Designer export
  TraceLogoColor: (props: any) => (
    <Svg viewBox="250 240 524 524" {...props}>
      {PETAL_TRANSFORMS.map((t, i) => (
        <G key={i} transform={t}><Path d={PETAL_D} fill="#ACC8FD" stroke="none" /></G>
      ))}
      <G transform={PETAL_TRANSFORMS[0]}>
        <Path d={STARBURST_D} fill="#F6FEFF" stroke="none" />
      </G>
      <G transform="matrix(0.277283,0,0,0.265218,231.275,19.7369)">
        <Circle cx="1012.5" cy="1872.22" r="51.87" fill="#EED002" stroke="none" />
      </G>
      <G transform="matrix(0.994803,0,0,0.951518,-123.822,-1368.43)">
        <Path d={GOLD_STAR_D} fill="#EED002" stroke="none" />
      </G>
      <G transform="matrix(0.739528,0,0,0.70735,39.8533,-883.091)">
        <Path d={CENTER_DOT_D} fill="#1A1A2E" stroke="none" />
      </G>
    </Svg>
  ),

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
