/**
 * HTML renderer for React Native using react-native-render-html
 * Handles formatting: bold, italic, bullets, nested lists, paragraphs, line breaks
 */
import { useWindowDimensions } from 'react-native';
import RenderHtml from 'react-native-render-html';
import React from 'react';

interface HtmlRendererProps {
  html: string;
  style?: any;
  strikethrough?: boolean;
}

/**
 * Render HTML content using react-native-render-html
 */
export function HtmlRenderer({ html, style, strikethrough }: HtmlRendererProps) {
  const { width } = useWindowDimensions();

  // Base styles for rendering
  const baseStyle = {
    body: {
      fontSize: 15,
      lineHeight: 22,
      color: '#111827',
      ...(strikethrough && {
        textDecorationLine: 'line-through' as const,
        opacity: 0.6,
      }),
    },
    p: {
      marginTop: 0,
      marginBottom: 8,
    },
    ul: {
      marginTop: 0,
      marginBottom: 8,
      paddingLeft: 16,
    },
    ol: {
      marginTop: 0,
      marginBottom: 8,
      paddingLeft: 16,
    },
    li: {
      marginBottom: 4,
    },
    strong: {
      fontWeight: '600',
    },
    b: {
      fontWeight: '600',
    },
    em: {
      fontStyle: 'italic',
    },
    i: {
      fontStyle: 'italic',
    },
  };

  return (
    <RenderHtml
      contentWidth={width - 32} // Account for padding
      source={{ html }}
      tagsStyles={baseStyle}
    />
  );
}
