/**
 * Shared configuration for react-native-render-html
 *
 * All config objects are module-scope stable references to prevent
 * TRenderEngine rebuilds. Theme-dependent styles are built once
 * per provider mount via buildTagsStyles().
 */
import {
  HTMLElementModel,
  HTMLContentModel,
  defaultSystemFonts,
} from 'react-native-render-html';
import type { MixedStyleRecord } from 'react-native-render-html';
import type { ThemeContextValue } from '../../../shared/contexts/ThemeContext';

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

/**
 * Total horizontal padding around entry content (24px each side).
 * Must match EntryListItemDefault's content area padding.
 * See: EntryListItemDefault.tsx styles.contentContainer paddingHorizontal.
 */
export const HTML_CONTENT_HORIZONTAL_PADDING = 48;

// ---------------------------------------------------------------------------
// Custom HTML element models (stable, module-scope)
// ---------------------------------------------------------------------------

/**
 * TipTap emits <input type="checkbox"> inside task lists.
 * RNRH doesn't know about <input> — register it as a void element
 * so the parser doesn't choke. We render it ourselves in the custom
 * task item renderer.
 */
export const customHTMLElementModels = {
  input: HTMLElementModel.fromCustomModel({
    tagName: 'input',
    contentModel: HTMLContentModel.none,
  }),
};

// ---------------------------------------------------------------------------
// Ignored DOM tags (stable, module-scope)
// ---------------------------------------------------------------------------

/**
 * Tags to strip from the tree before rendering:
 * - label: TipTap wraps checkbox + span in <label>; we handle it in TaskItemRenderer
 * - colgroup: TipTap table artifact, not needed for native rendering
 */
export const ignoredDomTags = ['label', 'colgroup'];

// ---------------------------------------------------------------------------
// System fonts (stable, module-scope)
// ---------------------------------------------------------------------------

/**
 * All font family names registered with expo-font useFonts().
 * Must be included so RNRH can resolve fontFamily in styles.
 * Spread defaultSystemFonts so platform defaults still work.
 */
export const systemFonts = [
  ...defaultSystemFonts,
  // Inter
  'Inter_400Regular',
  'Inter_500Medium',
  'Inter_600SemiBold',
  'Inter_700Bold',
  // Maven Pro
  'MavenPro_400Regular',
  'MavenPro_500Medium',
  'MavenPro_600SemiBold',
  'MavenPro_700Bold',
  // Lora
  'Lora_400Regular',
  'Lora_500Medium',
  'Lora_600SemiBold',
  'Lora_700Bold',
  // JetBrains Mono
  'JetBrainsMono_400Regular',
  'JetBrainsMono_500Medium',
  'JetBrainsMono_600SemiBold',
  'JetBrainsMono_700Bold',
  // Atkinson Hyperlegible
  'AtkinsonHyperlegible_400Regular',
  'AtkinsonHyperlegible_700Bold',
  // Orbitron
  'Orbitron_400Regular',
  'Orbitron_500Medium',
  'Orbitron_600SemiBold',
  'Orbitron_700Bold',
  // Newsreader
  'Newsreader_400Regular',
  'Newsreader_500Medium',
  'Newsreader_600SemiBold',
  'Newsreader_700Bold',
  // Oxanium
  'Oxanium_400Regular',
  'Oxanium_500Medium',
  'Oxanium_600SemiBold',
  'Oxanium_700Bold',
  // Play
  'Play_400Regular',
  'Play_700Bold',
  // Roboto
  'Roboto_400Regular',
  'Roboto_500Medium',
  'Roboto_700Bold',
  // Poppins
  'Poppins_400Regular',
  'Poppins_500Medium',
  'Poppins_600SemiBold',
  'Poppins_700Bold',
  // Nunito
  'Nunito_400Regular',
  'Nunito_500Medium',
  'Nunito_600SemiBold',
  'Nunito_700Bold',
  // Open Sans
  'OpenSans_400Regular',
  'OpenSans_500Medium',
  'OpenSans_600SemiBold',
  'OpenSans_700Bold',
  // Montserrat
  'Montserrat_400Regular',
  'Montserrat_500Medium',
  'Montserrat_600SemiBold',
  'Montserrat_700Bold',
  // Raleway
  'Raleway_400Regular',
  'Raleway_500Medium',
  'Raleway_600SemiBold',
  'Raleway_700Bold',
  // Exo 2
  'Exo2_400Regular',
  'Exo2_500Medium',
  'Exo2_600SemiBold',
  'Exo2_700Bold',
];

// ---------------------------------------------------------------------------
// Theme-dependent tag styles builder
// ---------------------------------------------------------------------------

/**
 * Build a MixedStyleRecord matching the WebView CSS from webViewHtmlRenderer.
 * Called once in HtmlRenderProvider when theme changes, NOT per list item.
 *
 * IMPORTANT: Every reference change to the return value causes a full
 * TRenderEngine rebuild, so this must only be called at the provider level.
 */
export function buildTagsStyles(theme: ThemeContextValue): MixedStyleRecord {
  const textColor = theme.colors.text.primary;
  const accentColor = theme.colors.functional.accent;
  const fontFamily = theme.typography.fontFamily.regular;
  const boldFamily = theme.typography.fontFamily.bold;
  const semiboldFamily = theme.typography.fontFamily.semibold;

  const subheadingStyle = {
    fontFamily: semiboldFamily,
    fontSize: 15,
    fontWeight: '600' as const,
    marginTop: 4,
    marginBottom: 2,
    opacity: 0.85,
  };

  return {
    body: {
      fontFamily,
      fontSize: 15,
      lineHeight: 22.5, // 15 * 1.5
      color: textColor,
      margin: 0,
      padding: 0,
    },
    p: {
      // Editor CSS: p { margin: 0 }, p + p { margin-top: 4px }
      // RNRH has no sibling selectors, so use marginBottom: 2 as a compromise.
      // This keeps list items and task items tight while providing some spacing
      // between standalone paragraphs.
      marginTop: 0,
      marginBottom: 2,
      padding: 0,
    },

    // Headings — sized below entry title (19px) so they stay subordinate.
    // Use bold weight + top spacing to distinguish from body text.
    h1: {
      fontFamily: boldFamily,
      fontSize: 18,
      fontWeight: '700',
      marginTop: 16,
      marginBottom: 4,
    },
    h2: {
      fontFamily: boldFamily,
      fontSize: 17,
      fontWeight: '700',
      marginTop: 12,
      marginBottom: 4,
    },
    // h3-h6 share the same subheading style — same size as body text,
    // distinguished by semibold weight and slight opacity reduction.
    h3: subheadingStyle,
    h4: subheadingStyle,
    h5: subheadingStyle,
    h6: subheadingStyle,

    // Lists
    ul: {
      marginTop: 4,
      marginBottom: 4,
      paddingLeft: 20,
    },
    ol: {
      marginTop: 4,
      marginBottom: 4,
      paddingLeft: 20,
    },
    li: {
      marginBottom: 2,
    },

    // Text formatting
    strong: {
      fontFamily: semiboldFamily,
      fontWeight: '600',
    },
    b: {
      fontFamily: semiboldFamily,
      fontWeight: '600',
    },
    em: {
      fontStyle: 'italic',
    },
    i: {
      fontStyle: 'italic',
    },

    // Images
    img: {
      borderRadius: 8,
      marginTop: 8,
      marginBottom: 8,
    },

    // Links
    a: {
      color: accentColor,
      textDecorationLine: 'underline',
    },

    // Tables — fully handled by the custom TableRenderer in htmlRenderers.tsx.
    // Only text-inheritable styles go here (they flow to cell content via
    // tnode style inheritance). View-level styles (borders, padding, bg)
    // are applied directly by the renderer.
    th: {
      fontWeight: '600',
    },
  };
}
