declare module 'react-native-pell-rich-editor/src/RichEditor' {
  import { Component, Ref } from 'react';
  import { StyleProp, ViewStyle } from 'react-native';

  export interface EditorStyle {
    backgroundColor?: string;
    color?: string;
    placeholderColor?: string;
    contentCSSText?: string;
    cssText?: string;
  }

  export interface RichEditorProps {
    style?: StyleProp<ViewStyle>;
    initialContentHTML?: string;
    placeholder?: string;
    initialHeight?: number;
    editorInitializedCallback?: () => void;
    onChange?: (html: string) => void;
    onHeightChange?: (height: number) => void;
    onCursorPosition?: (scrollY: number) => void;
    onMessage?: (event: { type: string; data: any }) => void;
    onFocus?: () => void;
    onBlur?: () => void;
    disabled?: boolean;
    useContainer?: boolean;
    initialFocus?: boolean;
    editorStyle?: EditorStyle;
  }

  class RichEditor extends Component<RichEditorProps> {
    sendAction(action: string, type: string, data?: any): void;
    setContentHTML(html: string): void;
    blurContentEditor(): void;
    focusContentEditor(): void;
    getContentHtml(): Promise<string>;
  }

  export default RichEditor;
}

declare module 'react-native-pell-rich-editor/src/const' {
  export const actions: {
    content: string;
    updateHeight: string;
    setBold: string;
    setItalic: string;
    setUnderline: string;
    heading1: string;
    heading2: string;
    heading3: string;
    heading4: string;
    heading5: string;
    heading6: string;
    insertLine: string;
    setParagraph: string;
    removeFormat: string;
    alignLeft: string;
    alignCenter: string;
    alignRight: string;
    alignFull: string;
    insertBulletsList: string;
    insertOrderedList: string;
    checkboxList: string;
    insertLink: string;
    insertText: string;
    insertHTML: string;
    insertImage: string;
    insertVideo: string;
    fontSize: string;
    fontName: string;
    setSubscript: string;
    setSuperscript: string;
    setStrikethrough: string;
    setHR: string;
    indent: string;
    outdent: string;
    undo: string;
    redo: string;
    code: string;
    table: string;
    line: string;
    foreColor: string;
    hiliteColor: string;
    blockquote: string;
    keyboard: string;
    setTitlePlaceholder: string;
    setContentPlaceholder: string;
    setTitleFocusHandler: string;
    setContentFocusHandler: string;
    prepareInsert: string;
    restoreSelection: string;
    setCustomCSS: string;
    setTextColor: string;
    setBackgroundColor: string;
    init: string;
    setEditorHeight: string;
    setFooterHeight: string;
    setPlatform: string;
  };

  export const messages: {
    CONTENT_HTML_RESPONSE: string;
    LOG: string;
    CONTENT_FOCUSED: string;
    CONTENT_BLUR: string;
    SELECTION_CHANGE: string;
    CONTENT_CHANGE: string;
    CONTENT_PASTED: string;
    CONTENT_KEYUP: string;
    CONTENT_KEYDOWN: string;
    SELECTED_TEXT_RESPONSE: string;
    LINK_TOUCHED: string;
    SELECTED_TEXT_CHANGED: string;
    OFFSET_HEIGHT: string;
    OFFSET_Y: string;
    ON_INPUT: string;
  };
}
