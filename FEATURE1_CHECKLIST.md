# Feature 1: Rich Text Capture with WYSIWYG Editor - Technical Checklist

## Status: Planning
**Goal:** Enable users to capture thoughts, ideas, and tasks with rich text formatting in under 5 seconds

**Tech Stack:**
- Web: TipTap WYSIWYG editor
- Mobile: @10play/tentap-editor (TipTap for React Native)
- Storage: HTML format in database

---

## Phase 1: Database Schema & Migration

- [ ] Create Supabase migration for `entries` table
  - [ ] `id` (uuid, primary key, auto-generated)
  - [ ] `user_id` (uuid, foreign key to auth.users, not null)
  - [ ] `title` (text, nullable - optional plain text title)
  - [ ] `content` (text, not null - HTML format from editor)
  - [ ] `tags` (text[], nullable - array of extracted #tags)
  - [ ] `mentions` (text[], nullable - array of extracted @mentions)
  - [ ] `category_id` (uuid, nullable - null = Inbox)
  - [ ] `latitude` (numeric, nullable - GPS coordinate)
  - [ ] `longitude` (numeric, nullable - GPS coordinate)
  - [ ] `created_at` (timestamptz, default now())
  - [ ] `updated_at` (timestamptz, default now(), auto-update trigger)
  - [ ] Add indexes: user_id, created_at, category_id
  - [ ] Add GIN index for tags and mentions arrays
  - [ ] Add RLS policies (users can only access their own entries)

- [ ] Create Supabase migration for `categories` table
  - [ ] `id` (uuid, primary key, auto-generated)
  - [ ] `user_id` (uuid, foreign key to auth.users, not null)
  - [ ] `name` (text, not null - just leaf name like "filter", normalized lowercase)
  - [ ] `parent_id` (uuid, nullable, self-referencing foreign key to categories.id)
  - [ ] `created_at` (timestamptz, default now())
  - [ ] Add index on user_id
  - [ ] Add index on parent_id
  - [ ] Add unique constraint on (user_id, name, parent_id) - prevents duplicate siblings
  - [ ] Add RLS policies (users can only access their own categories)
  - [ ] Add recursive query function to build full paths for display

- [ ] Apply migration to Supabase project
- [ ] Generate TypeScript types from database schema

---

## Phase 2: Category System (@trace/core)

### 2.1 Types (`packages/core/src/modules/categories/CategoryTypes.ts`)

- [ ] Create `Category` interface (matches database schema)
  ```typescript
  {
    id: string;
    user_id: string;
    name: string; // lowercase, just leaf name
    parent_id: string | null;
    created_at: string;
  }
  ```
- [ ] Create `CategoryWithPath` interface (for display with full path)
  ```typescript
  {
    ...Category;
    full_path: string; // "house/furnace/filter"
    display_path: string; // "House/Furnace/Filter" (capitalized)
  }
  ```
- [ ] Create `CategoryTree` interface (for tree view)
  ```typescript
  {
    category: CategoryWithPath;
    children: CategoryTree[];
    entry_count: number;
  }
  ```
- [ ] Create `CreateCategoryInput` type
- [ ] Create `UpdateCategoryInput` type
- [ ] Export all types from module index

### 2.2 API Layer (`packages/core/src/modules/categories/categoryApi.ts`)

- [ ] `getCategories(): Promise<CategoryWithPath[]>`
  - [ ] Get current user
  - [ ] Query all categories for user
  - [ ] Build full paths via recursive query or client-side recursion
  - [ ] Return categories with full_path and display_path

- [ ] `getCategoryTree(): Promise<CategoryTree[]>`
  - [ ] Get all categories
  - [ ] Build tree structure recursively
  - [ ] Include entry count per category (join with entries table)
  - [ ] Return top-level categories with nested children

- [ ] `findOrCreateCategoryByPath(path: string): Promise<string>`
  - [ ] Split path by "/" (e.g., "house/furnace/filter")
  - [ ] Normalize each segment to lowercase
  - [ ] For each segment (starting from root):
    - [ ] Check if category exists (name, parent_id)
    - [ ] If not exists, create it
    - [ ] Move to next level
  - [ ] Return final leaf category ID

- [ ] `createCategory(name: string, parentId: string | null): Promise<Category>`
  - [ ] Get current user
  - [ ] Normalize name to lowercase
  - [ ] Check for duplicate (user_id, name, parent_id)
  - [ ] Insert category
  - [ ] Return created category

- [ ] `updateCategory(id: string, data: UpdateCategoryInput): Promise<Category>`
  - [ ] Get current user
  - [ ] Update category name (normalized to lowercase)
  - [ ] Return updated category

- [ ] `deleteCategory(id: string, reassignToId?: string): Promise<void>`
  - [ ] Get current user
  - [ ] Check if category has children → prevent or cascade
  - [ ] Check if category has entries
  - [ ] If reassignToId: reassign entries to new category
  - [ ] Else: set entries to null (move to Inbox)
  - [ ] Delete category

### 2.3 Helpers Layer (`packages/core/src/modules/categories/categoryHelpers.ts`)

- [ ] `buildFullPath(category: Category, allCategories: Category[]): string`
  - [ ] Recursively build path from leaf to root
  - [ ] Return lowercase path "house/furnace/filter"

- [ ] `buildDisplayPath(fullPath: string): string`
  - [ ] Capitalize first letter of each segment
  - [ ] Return "House/Furnace/Filter"

- [ ] `normalizeCategoryName(name: string): string`
  - [ ] Convert to lowercase
  - [ ] Trim whitespace
  - [ ] Replace multiple slashes with single slash
  - [ ] Return normalized name

- [ ] `filterCategoriesByQuery(categories: CategoryWithPath[], query: string): CategoryWithPath[]`
  - [ ] Case-insensitive search
  - [ ] Match any part of full_path
  - [ ] Return filtered categories sorted by relevance

- [ ] `buildCategoryTree(categories: CategoryWithPath[], entryCounts: Map<string, number>): CategoryTree[]`
  - [ ] Build hierarchical tree structure
  - [ ] Attach entry counts
  - [ ] Sort alphabetically
  - [ ] Return root-level nodes

### 2.4 Hooks Layer (`packages/core/src/modules/categories/categoryHooks.ts`)

- [ ] Internal: `useCategoriesQuery()`
  - [ ] React Query useQuery hook
  - [ ] queryKey: ['categories']
  - [ ] queryFn: () => getCategories()
  - [ ] Return query result

- [ ] Internal: `useCategoryTreeQuery()`
  - [ ] React Query useQuery hook
  - [ ] queryKey: ['categoryTree']
  - [ ] queryFn: () => getCategoryTree()
  - [ ] Return query result

- [ ] Internal: `useCreateCategoryMutation()`
  - [ ] React Query useMutation hook
  - [ ] mutationFn: createCategory
  - [ ] onSuccess: invalidate 'categories' and 'categoryTree' queries
  - [ ] Return mutation

- [ ] Internal: `useUpdateCategoryMutation()`
  - [ ] Similar to create
  - [ ] Return mutation

- [ ] Internal: `useDeleteCategoryMutation()`
  - [ ] Similar to create
  - [ ] Return mutation

- [ ] **Exported: `useCategories()`** (SINGLE SOURCE OF TRUTH)
  - [ ] Call useCategoriesQuery()
  - [ ] Call useCategoryTreeQuery()
  - [ ] Call all mutation hooks
  - [ ] Return unified object:
    ```typescript
    {
      categories: CategoryWithPath[],
      categoryTree: CategoryTree[],
      isLoading: boolean,
      error: Error | null,
      categoryMutations: {
        createCategory: (name, parentId) => Promise<Category>,
        findOrCreateByPath: (path) => Promise<string>,
        updateCategory: (id, data) => Promise<Category>,
        deleteCategory: (id, reassignToId?) => Promise<void>
      },
      categoryHelpers
    }
    ```

### 2.5 Module Index (`packages/core/src/modules/categories/index.ts`)

- [ ] Export `useCategories` hook
- [ ] Export all types from CategoryTypes
- [ ] Export all helpers from categoryHelpers
- [ ] DO NOT export API functions (internal only)

---

## Phase 3: Entry System (@trace/core)

### 3.1 Types (`packages/core/src/modules/entries/EntryTypes.ts`)

- [ ] Create `Entry` interface (matches database schema)
- [ ] Create `CreateEntryInput` type (excludes id, created_at, updated_at)
- [ ] Create `UpdateEntryInput` type (partial Entry with required id)
- [ ] Create `EntryFilter` type (for querying - category_id, tags, date range)
- [ ] Export all types from module index

### 3.2 API Layer (`packages/core/src/modules/entries/entryApi.ts`)

- [ ] `createEntry(data: CreateEntryInput): Promise<Entry>`
  - [ ] Get current user from Supabase auth
  - [ ] Exclude client-side fields (id, created_at, updated_at)
  - [ ] Insert entry to database
  - [ ] Handle errors (throw)
  - [ ] Return created entry

- [ ] `getEntries(filter?: EntryFilter): Promise<Entry[]>`
  - [ ] Get current user
  - [ ] Query entries with filters (category_id, tags, date range)
  - [ ] Order by created_at desc
  - [ ] Return entries array

- [ ] `getEntry(id: string): Promise<Entry>`
  - [ ] Get current user
  - [ ] Query single entry by id
  - [ ] Verify ownership
  - [ ] Return entry

- [ ] `updateEntry(id: string, data: Partial<Entry>): Promise<Entry>`
  - [ ] Get current user
  - [ ] Exclude read-only fields (id, user_id, created_at)
  - [ ] Update entry in database
  - [ ] Return updated entry

- [ ] `deleteEntry(id: string): Promise<void>`
  - [ ] Get current user
  - [ ] Delete entry from database (hard delete for MVP)
  - [ ] Handle errors

### 3.3 Helpers Layer (`packages/core/src/modules/entries/entryHelpers.ts`)

- [ ] `parseHashtags(content: string): string[]`
  - [ ] Regex to extract all #tag patterns
  - [ ] Remove duplicates
  - [ ] Return array of tag strings (without #)

- [ ] `parseMentions(content: string): string[]`
  - [ ] Regex to extract all @mention patterns
  - [ ] Remove duplicates
  - [ ] Return array of mention strings (without @)

- [ ] `extractTagsAndMentions(content: string): { tags: string[], mentions: string[] }`
  - [ ] Call parseHashtags and parseMentions
  - [ ] Return both arrays

- [ ] `stripHtml(htmlContent: string): string`
  - [ ] Convert HTML to plain text (for preview/search)
  - [ ] Return plain text

- [ ] `getWordCount(content: string): number`
  - [ ] Count words in content (strip HTML first)
  - [ ] Return count

- [ ] `getCharacterCount(content: string): number`
  - [ ] Count characters in content (strip HTML first)
  - [ ] Return count

### 3.4 Hooks Layer (`packages/core/src/modules/entries/entryHooks.ts`)

- [ ] Internal: `useEntriesQuery(filter?: EntryFilter)`
  - [ ] React Query useQuery hook
  - [ ] queryKey: ['entries', filter]
  - [ ] queryFn: () => getEntries(filter)
  - [ ] Return query result

- [ ] Internal: `useCreateEntryMutation()`
  - [ ] React Query useMutation hook
  - [ ] mutationFn: createEntry
  - [ ] onSuccess: invalidate 'entries' query
  - [ ] Return mutation

- [ ] Internal: `useUpdateEntryMutation()`
  - [ ] React Query useMutation hook
  - [ ] mutationFn: updateEntry
  - [ ] onSuccess: invalidate 'entries' query
  - [ ] Return mutation

- [ ] Internal: `useDeleteEntryMutation()`
  - [ ] React Query useMutation hook
  - [ ] mutationFn: deleteEntry
  - [ ] onSuccess: invalidate 'entries' query
  - [ ] Return mutation

- [ ] **Exported: `useEntries(filter?: EntryFilter)`** (SINGLE SOURCE OF TRUTH)
  - [ ] Call useEntriesQuery(filter)
  - [ ] Call useCreateEntryMutation()
  - [ ] Call useUpdateEntryMutation()
  - [ ] Call useDeleteEntryMutation()
  - [ ] Return unified object:
    ```typescript
    {
      entries: Entry[],
      isLoading: boolean,
      error: Error | null,
      entryMutations: {
        createEntry: (data) => Promise<Entry>,
        updateEntry: (id, data) => Promise<Entry>,
        deleteEntry: (id) => Promise<void>
      },
      entryHelpers: { parseHashtags, parseMentions, ... }
    }
    ```

### 3.5 Module Index (`packages/core/src/modules/entries/index.ts`)

- [ ] Export `useEntries` hook
- [ ] Export all types from EntryTypes
- [ ] Export all helpers from entryHelpers
- [ ] DO NOT export API functions (internal only)

### 3.6 Core Package Index (`packages/core/src/index.ts`)

- [ ] Add `export * from "./modules/entries";`
- [ ] Add `export * from "./modules/categories";`

---

## Phase 4: Web App - TipTap Editor

### 5.1 Install Dependencies

- [ ] Install TipTap packages:
  ```bash
  npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-placeholder
  ```

### 4.2 Create RichTextEditor Component (`apps/web/src/components/editor/RichTextEditor.tsx`)

- [ ] Create controlled component with props:
  - [ ] `value: string` (HTML content)
  - [ ] `onChange: (html: string) => void`
  - [ ] `placeholder?: string`
  - [ ] `autoFocus?: boolean`

- [ ] Initialize TipTap editor with extensions:
  - [ ] StarterKit (includes Bold, Italic, Lists, etc.)
  - [ ] Placeholder extension
  - [ ] Configure nested list depth limit (3 levels)
  - [ ] Configure list keyboard shortcuts (Tab/Shift+Tab)
  - [ ] Configure Enter behavior (auto-continue lists, Enter twice to exit)

- [ ] Create formatting toolbar:
  - [ ] Bold button (Ctrl/Cmd+B)
  - [ ] Italic button (Ctrl/Cmd+I)
  - [ ] Bullet list button
  - [ ] Numbered list button
  - [ ] Indent button (for nested lists)
  - [ ] Outdent button (for nested lists)
  - [ ] Show active states (button highlighted when format active)

- [ ] Style editor container with Tailwind CSS
- [ ] Handle cleanup on unmount

### 4.3 Create CategoryAutocomplete Component (`apps/web/src/components/categories/CategoryAutocomplete.tsx`)

- [ ] Create controlled autocomplete textbox component with props:
  - [ ] `value: string` (current category path text)
  - [ ] `onChange: (path: string, categoryId: string | null) => void`
  - [ ] `placeholder?: string`

- [ ] Use `useCategories()` hook from @trace/core

- [ ] Implement autocomplete behavior:
  - [ ] Textbox for typing category path (e.g., "house/fur")
  - [ ] Filter categories in real-time as user types
  - [ ] Match anywhere in full_path (case-insensitive)
  - [ ] Show dropdown with filtered results (display_path)
  - [ ] Click to select → set value and call onChange with categoryId
  - [ ] If no match, show "Create new: [typed path]" option
  - [ ] Keyboard navigation (↓↑ to navigate, Enter to select)

- [ ] Handle create new category:
  - [ ] When user selects "Create new" option
  - [ ] Call categoryMutations.findOrCreateByPath(path)
  - [ ] Returns category ID
  - [ ] Call onChange with new categoryId

- [ ] Style with Tailwind CSS (dropdown, results list, highlight matched text)

### 4.4 Create CaptureForm Component (`apps/web/src/modules/entries/components/CaptureForm.tsx`)

- [ ] Create form with state:
  - [ ] `title` (optional string)
  - [ ] `content` (HTML string from editor)
  - [ ] `categoryPath` (string for display)
  - [ ] `categoryId` (string | null for database)
  - [ ] `isSubmitting` (boolean)

- [ ] Use `useEntries()` hook from @trace/core

- [ ] Render form:
  - [ ] Title input (plain text, optional)
  - [ ] CategoryAutocomplete component (pass categoryPath and onChange handler)
  - [ ] RichTextEditor component
  - [ ] Character/word count indicator (using entryHelpers)
  - [ ] Submit button (or Ctrl+Enter handler)
  - [ ] Loading state during submission

- [ ] Handle submit:
  - [ ] Extract tags and mentions from content using entryHelpers
  - [ ] Get GPS coordinates (if granted) - use browser Geolocation API
  - [ ] Call entryMutations.createEntry with:
    ```typescript
    {
      title: title || null,
      content: content,
      tags: extractedTags,
      mentions: extractedMentions,
      latitude: coords?.latitude || null,
      longitude: coords?.longitude || null,
      category_id: categoryId // null = Inbox, or selected category
    }
    ```
  - [ ] On success: clear form, show success message
  - [ ] On error: show error message

- [ ] Add keyboard shortcut (Ctrl/Cmd+Enter to submit)

### 4.5 Update CapturePage (`apps/web/src/pages/CapturePage.tsx`)

- [ ] Replace placeholder content with CaptureForm component
- [ ] Add page heading and instructions
- [ ] Style with Tailwind CSS

---

## Phase 5: Mobile App - TipTap Editor

### 5.1 Install Dependencies

- [ ] Install @10play/tentap-editor:
  ```bash
  cd apps/mobile
  npm install @10play/tentap-editor
  ```

### 5.2 Create RichTextEditor Component (`apps/mobile/src/components/editor/RichTextEditor.tsx`)

- [ ] Create controlled component with props:
  - [ ] `value: string` (HTML content)
  - [ ] `onChange: (html: string) => void`
  - [ ] `placeholder?: string`

- [ ] Initialize tentap editor with extensions:
  - [ ] StarterKit
  - [ ] Configure nested list depth limit (3 levels)

- [ ] Create formatting toolbar (above keyboard):
  - [ ] Bold button
  - [ ] Italic button
  - [ ] Bullet list button
  - [ ] Numbered list button
  - [ ] Indent button (replaces Tab key)
  - [ ] Outdent button (replaces Shift+Tab)
  - [ ] Show active states

- [ ] Style with React Native StyleSheet
- [ ] Handle keyboard avoiding behavior

### 4.3 Create CaptureForm Component (`apps/mobile/src/modules/entries/components/CaptureForm.tsx`)

- [ ] Create form with state (same as web):
  - [ ] `title` (optional string)
  - [ ] `content` (HTML string)
  - [ ] `isSubmitting` (boolean)

- [ ] Use `useEntries()` hook from @trace/core

- [ ] Render form:
  - [ ] Title TextInput (optional)
  - [ ] RichTextEditor component
  - [ ] Character/word count indicator
  - [ ] Submit button (no keyboard shortcuts on mobile)
  - [ ] Loading indicator during submission

- [ ] Handle submit:
  - [ ] Extract tags and mentions
  - [ ] Get GPS coordinates - use expo-location
  - [ ] Call entryMutations.createEntry
  - [ ] On success: clear form, show success (Toast or Alert)
  - [ ] On error: show error message

### 4.4 Request Location Permissions (`apps/mobile/app.json`)

- [ ] Add location permissions to app.json:
  ```json
  "ios": {
    "infoPlist": {
      "NSLocationWhenInUseUsageDescription": "Trace uses your location to add context to your entries."
    }
  },
  "android": {
    "permissions": ["ACCESS_FINE_LOCATION"]
  }
  ```

- [ ] Install expo-location:
  ```bash
  npx expo install expo-location
  ```

### 4.5 Update CaptureScreen (`apps/mobile/src/screens/CaptureScreen.tsx`)

- [ ] Replace placeholder content with CaptureForm component
- [ ] Remove placeholder cards
- [ ] Style with React Native StyleSheet

---

## Phase 6: Testing & Refinement

### 5.1 Database Testing

- [ ] Test entries table creation
- [ ] Test RLS policies (users can't access other users' entries)
- [ ] Test indexes are working
- [ ] Test created_at/updated_at auto-timestamps

### 5.2 Core Package Testing

- [ ] Test parseHashtags helper with various inputs
- [ ] Test parseMentions helper with various inputs
- [ ] Test createEntry API function
- [ ] Test getEntries API function
- [ ] Test updateEntry API function
- [ ] Test deleteEntry API function
- [ ] Test useEntries hook returns correct structure

### 5.3 Web App Testing

- [ ] Test TipTap editor renders correctly
- [ ] Test bold formatting (Ctrl+B)
- [ ] Test italic formatting (Ctrl+I)
- [ ] Test bullet lists
- [ ] Test numbered lists
- [ ] Test nested lists (Tab/Shift+Tab up to 3 levels)
- [ ] Test auto-continue lists (Enter creates new item)
- [ ] Test exit list mode (Enter twice)
- [ ] Test #tag extraction from content
- [ ] Test @mention extraction from content
- [ ] Test form submission (Ctrl+Enter)
- [ ] Test GPS permission request
- [ ] Test GPS coordinate capture
- [ ] Test entry saved to Inbox (category_id = null)
- [ ] Test form clears after successful submission
- [ ] Test error handling
- [ ] Test character/word count indicator

### 5.4 Mobile App Testing

- [ ] Test tentap editor renders correctly
- [ ] Test formatting toolbar buttons
- [ ] Test bold formatting
- [ ] Test italic formatting
- [ ] Test bullet lists
- [ ] Test numbered lists
- [ ] Test nested lists (indent/outdent buttons up to 3 levels)
- [ ] Test auto-continue lists (Enter creates new item)
- [ ] Test exit list mode (Enter twice)
- [ ] Test #tag extraction
- [ ] Test @mention extraction
- [ ] Test form submission
- [ ] Test location permission request (iOS & Android)
- [ ] Test GPS coordinate capture
- [ ] Test entry saved to Inbox
- [ ] Test form clears after successful submission
- [ ] Test error handling
- [ ] Test character/word count indicator
- [ ] Test keyboard avoiding behavior

### 5.5 Cross-Platform Testing

- [ ] Create entry on web, verify it displays correctly on mobile
- [ ] Create entry on mobile, verify it displays correctly on web
- [ ] Verify HTML content renders consistently across platforms
- [ ] Verify nested lists display correctly across platforms
- [ ] Verify tags and mentions extracted correctly on both platforms

---

## Phase 7: Documentation & Cleanup

- [ ] Update CLAUDE.md with entry module patterns
- [ ] Add code comments to complex functions
- [ ] Build shared package: `npm run build:shared`
- [ ] Run type checking: `npm run type-check`
- [ ] Test both apps are running without errors
- [ ] Create git commit for Feature 1
- [ ] Push to GitHub

---

## Visual UX Flow Summary

```
┌─────────────────────────────────────────────────────────────┐
│ CAPTURE SCREEN (Full Screen Editor)                        │
│                                                             │
│  [Title Input (optional)]                                  │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ Rich Text Editor (TipTap)                             │ │
│  │ - Formatting toolbar: B I • 1 → ←                    │ │
│  │ - Content area with nested lists support             │ │
│  │ - Auto-extract #tags and @mentions                   │ │
│  └───────────────────────────────────────────────────────┘ │
│  [Word count: 42 | Characters: 287]                        │
│  [Save Button] [Cancel Button]                             │
│                                                             │
│  After save → Entry goes to Inbox (category_id = null)     │
└─────────────────────────────────────────────────────────────┘

                              ↓ User navigates to Inbox

┌─────────────────────────────────────────────────────────────┐
│ INBOX SCREEN (List View)                                   │
│                                                             │
│  Inbox (23) ← badge shows count                            │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 📝 Meeting notes from standup                       │   │
│  │ Discussed the new feature roadmap and...           │   │
│  │ 2 hours ago • #work @john                          │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ☑ Buy groceries                                     │   │
│  │ Milk, eggs, bread, coffee beans                    │   │
│  │ 5 hours ago • #tasks                               │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Idea for weekend project                           │   │
│  │ Build a small CLI tool to automate...             │   │
│  │ Yesterday • #ideas @self                           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Sorted by: created_at DESC (newest first)                 │
└─────────────────────────────────────────────────────────────┘

                    ↓ User clicks/taps entry

┌─────────────────────────────────────────────────────────────┐
│ ENTRY EDIT SCREEN (Full Screen Edit)                       │
│                                                             │
│  [← Back]                                                   │
│                                                             │
│  [Title Input: "Meeting notes from standup"]               │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ Rich Text Editor (pre-filled with entry content)     │ │
│  │ - Discussed the new feature roadmap                  │ │
│  │ - Need to prioritize authentication                  │ │
│  │ - @john will handle backend setup                    │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  Created: 2 hours ago at Coffee Shop (GPS icon)            │
│  Tags: #work @john                                          │
│                                                             │
│  [Save Button] [Delete Button]                             │
│                                                             │
│  After save → Navigate back to Inbox list                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 8: Entry List Views & Navigation

### 7.1 Entry List Component (Shared Pattern)

- [ ] Create EntryListItem component (web: `apps/web/src/modules/entries/components/EntryListItem.tsx`)
  - [ ] Display title (if present) or first line of content
  - [ ] Preview of content (strip HTML, truncate to ~100 chars)
  - [ ] Metadata: formatted date, category badge, tag pills
  - [ ] Status icon (if task)
  - [ ] Click handler to navigate to edit page
  - [ ] Style with Tailwind CSS

- [ ] Create EntryList component (web: `apps/web/src/modules/entries/components/EntryList.tsx`)
  - [ ] Accept `entries: Entry[]` prop
  - [ ] Map over entries and render EntryListItem
  - [ ] Empty state (no entries)
  - [ ] Loading state
  - [ ] Sort entries by created_at DESC (newest first)

- [ ] Create EntryListItem component (mobile: `apps/mobile/src/modules/entries/components/EntryListItem.tsx`)
  - [ ] Same features as web version
  - [ ] Style with React Native StyleSheet
  - [ ] TouchableOpacity for press handling

- [ ] Create EntryList component (mobile: `apps/mobile/src/modules/entries/components/EntryList.tsx`)
  - [ ] Use FlatList for performance
  - [ ] Same features as web version
  - [ ] Pull-to-refresh support

### 7.2 Update Inbox Screen (Web)

- [ ] Update InboxPage (`apps/web/src/pages/InboxPage.tsx`)
  - [ ] Use `useEntries({ categoryId: null })` hook
  - [ ] Render EntryList component
  - [ ] Show inbox entry count in header
  - [ ] Replace placeholder content

### 7.3 Update Inbox Screen (Mobile)

- [ ] Update InboxScreen (`apps/mobile/src/screens/InboxScreen.tsx`)
  - [ ] Use `useEntries({ categoryId: null })` hook
  - [ ] Render EntryList component
  - [ ] Update ScreenHeader badge with inbox count
  - [ ] Replace placeholder content

### 7.4 Entry Detail/Edit Page (Web)

- [ ] Create route in router: `/entry/:id`

- [ ] Create EntryEditPage (`apps/web/src/pages/EntryEditPage.tsx`)
  - [ ] Get entry ID from URL params
  - [ ] Use `useEntries()` hook, find entry by ID
  - [ ] Show loading state while fetching
  - [ ] Render form with pre-populated data:
    - [ ] Title input (pre-filled)
    - [ ] RichTextEditor (pre-filled with HTML content)
    - [ ] Show metadata (created date, location)
    - [ ] Save button
    - [ ] Cancel button (navigate back)
    - [ ] Delete button (with confirmation)
  - [ ] Handle update:
    - [ ] Call entryMutations.updateEntry
    - [ ] Extract tags/mentions from updated content
    - [ ] On success: navigate back to previous page
  - [ ] Handle delete:
    - [ ] Show confirmation dialog
    - [ ] Call entryMutations.deleteEntry
    - [ ] Navigate back to list

### 7.5 Entry Detail/Edit Screen (Mobile)

- [ ] Create EntryEditScreen (`apps/mobile/src/screens/EntryEditScreen.tsx`)
  - [ ] Same features as web version
  - [ ] Receive entry ID via navigation params
  - [ ] Use React Native navigation to go back
  - [ ] Alert confirmation for delete

- [ ] Update navigation to support entry edit screen
  - [ ] Add navigation from list item tap
  - [ ] Pass entry ID as param

### 7.6 Navigation Updates

- [ ] Web: Update router to include `/entry/:id` route
- [ ] Mobile: Add navigation support for EntryEditScreen
- [ ] Both: Ensure back navigation returns to previous list view

---

## Notes & Decisions

**UX Flow:**
- Capture screen = full screen editor only (no list)
- Inbox/Categories/Calendar/Tasks = list views only
- Click entry → navigate to full screen edit → save → back to list

**Sorting:** created_at DESC (newest entries first)
**Edit Mode:** Full screen (Option A) on both platforms
**Auto-save vs Manual Save:** Manual save (explicit Save button)
**GPS Permission Strategy:** Request on first capture attempt, remember choice
**Character Limit:** None for MVP, can add later if needed
**List Depth Limit:** 3 levels (prevents infinite nesting)
**Content Format:** HTML (TipTap's native format)
**Tag Format:** `#tag` (single word, letters/numbers/underscores)
**Mention Format:** `@mention` (single word, letters/numbers/underscores)

**Category System:**
- **Data Model:** Relational (id, name, parent_id) - NOT string paths
- **Storage:** Leaf names only, normalized lowercase (e.g., "filter", not "House/Furnace/Filter")
- **Display:** Build full path on read, capitalize for display ("House/Furnace/Filter")
- **Capture UX:** Autocomplete textbox - type to filter, select existing or create new
- **Management UX:** Tree view on Categories screen - expand/collapse, see entry counts
- **Duplicate Prevention:** Unique constraint on (user_id, name, parent_id)
- **Rename:** Update name in ONE place, all entries auto-update via foreign key
- **Delete:** Prevent if has children, reassign or move entries to Inbox
- **Future:** Drag-and-drop reordering, moving categories between parents (skip for MVP)

---

## Dependencies Summary

**Web:**
- @tiptap/react
- @tiptap/starter-kit
- @tiptap/extension-placeholder

**Mobile:**
- @10play/tentap-editor
- expo-location

**Shared:**
- No new dependencies (uses existing @tanstack/react-query)
