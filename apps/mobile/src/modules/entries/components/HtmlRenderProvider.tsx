/**
 * HtmlRenderProvider — wraps TRenderEngineProvider + RenderHTMLConfigProvider
 *
 * Mount ONE of these per screen that renders entry lists. Each list item
 * then uses <RenderHTMLSource> (lightweight) which shares the engine.
 *
 * This is the key to the split-provider pattern:
 *   1 engine per screen (expensive) vs 1 per item (old WebView approach).
 */
import React, { useMemo, useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { InteractionManager } from 'react-native';
import { TRenderEngineProvider, RenderHTMLConfigProvider } from 'react-native-render-html';
import { useTheme } from '../../../shared/contexts/ThemeContext';
import {
  customHTMLElementModels,
  ignoredDomTags,
  systemFonts,
  buildTagsStyles,
} from '../helpers/htmlRenderConfig';
import { customRenderers } from '../helpers/htmlRenderers';

interface HtmlRenderProviderProps {
  children: ReactNode;
}

export function HtmlRenderProvider({ children }: HtmlRenderProviderProps) {
  const theme = useTheme();

  // Defer TRenderEngine rebuilds: theme colors paint immediately via context,
  // but the expensive engine rebuild waits until after interactions settle.
  // This prevents 6 synchronous engine rebuilds from blocking the JS thread
  // during theme switches.
  const [appliedThemeKey, setAppliedThemeKey] = useState(
    () => `${theme.id}:${theme.typography.fontFamily.regular}`,
  );
  const appliedThemeKeyRef = useRef(appliedThemeKey);
  appliedThemeKeyRef.current = appliedThemeKey;

  useEffect(() => {
    const newKey = `${theme.id}:${theme.typography.fontFamily.regular}`;
    if (newKey === appliedThemeKeyRef.current) return;

    const handle = InteractionManager.runAfterInteractions(() => {
      setAppliedThemeKey(newKey);
    });
    return () => handle.cancel();
  }, [theme.id, theme.typography.fontFamily.regular]);

  // Rebuild tag styles only after the deferred key updates.
  const tagsStyles = useMemo(
    () => buildTagsStyles(theme),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appliedThemeKey],
  );

  return (
    <TRenderEngineProvider
      tagsStyles={tagsStyles}
      customHTMLElementModels={customHTMLElementModels}
      ignoredDomTags={ignoredDomTags}
      systemFonts={systemFonts}
      enableCSSInlineProcessing
    >
      <RenderHTMLConfigProvider
        renderers={customRenderers}
        enableExperimentalMarginCollapsing
      >
        {children}
      </RenderHTMLConfigProvider>
    </TRenderEngineProvider>
  );
}
