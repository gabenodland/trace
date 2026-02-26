/**
 * HtmlRenderProvider — wraps TRenderEngineProvider + RenderHTMLConfigProvider
 *
 * Mount ONE of these per screen that renders entry lists. Each list item
 * then uses <RenderHTMLSource> (lightweight) which shares the engine.
 *
 * This is the key to the split-provider pattern:
 *   1 engine per screen (expensive) vs 1 per item (old WebView approach).
 */
import React, { useMemo } from 'react';
import type { ReactNode } from 'react';
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

  // Rebuild tag styles when theme colors or font changes.
  // buildTagsStyles returns a plain object — useMemo prevents
  // TRenderEngine from rebuilding on every render.
  const tagsStyles = useMemo(
    () => buildTagsStyles(theme),
    // theme.id tracks color theme identity; fontFamily.regular tracks font switches
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [theme.id, theme.typography.fontFamily.regular],
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
