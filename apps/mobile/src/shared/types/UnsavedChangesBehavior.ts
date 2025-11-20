/**
 * Unsaved changes behavior options for entry editing
 */
export type UnsavedChangesBehavior = 'save' | 'discard' | 'ask';

export interface UnsavedChangesBehaviorOption {
  value: UnsavedChangesBehavior;
  label: string;
  description: string;
}

export const UNSAVED_CHANGES_BEHAVIORS: UnsavedChangesBehaviorOption[] = [
  {
    value: 'save',
    label: 'Save Changes',
    description: 'Automatically save changes when leaving',
  },
  {
    value: 'discard',
    label: 'Discard Changes',
    description: 'Automatically discard changes when leaving',
  },
  {
    value: 'ask',
    label: 'Ask',
    description: 'Ask what to do when leaving with unsaved changes',
  },
];

export const DEFAULT_UNSAVED_CHANGES_BEHAVIOR: UnsavedChangesBehavior = 'ask';
