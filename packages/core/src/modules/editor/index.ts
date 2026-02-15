// Editor extensions and helpers for title-first rich text editing

export { Title } from './TitleExtension';
export type { TitleOptions } from './TitleExtension';

export { TitleDocument } from './TitleDocument';

export {
  splitTitleAndBody,
  combineTitleAndBody,
  extractTitle,
  extractBody,
  stripEntryTitleFromContent,
  hasTitleStructure,
  getTitleCSS,
} from './editorHelpers';
