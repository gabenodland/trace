/**
 * FocusBridge - Bridges focus/blur events to React Native
 *
 * This BridgeExtension:
 * - Registers the Focus TipTap extension on the web side
 * - Sends focus state changes to RN when editor gains/loses focus
 */

import { BridgeExtension } from '@10play/tentap-editor';
import { Focus } from '../extensions/Focus';

export const FocusBridge = new BridgeExtension({
  tiptapExtension: Focus,
  name: 'Focus',
});
