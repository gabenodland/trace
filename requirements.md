# [Project Name] - Product Requirements Document

---

## Document Information

* **Product Name:** Trace
* **Version:** 1.0
* **Status:** Draft
* **Author:** Gabe Nodland
* **Date Created:** 11/7/25


## 1. Project Summary

Trace is a tool designed to be the ultimate capture device for ideas, notes, tasks, and memories. It's built on the principle that context (when, where, who) is key to retrieval. The project is planned in two main phases:

### Phase 1: The MVP (Core Functionality)
The initial version will focus on providing a robust, private, and fast capture experience.
*   **Capture:** A lightweight text editor for ideas, notes, tasks, and micro-journal entries.
*   **Context:** Each entry automatically tracks date, time, and optional GPS location.
*   **Organization:** Entries can be organized with hierarchical categories, freeform #tags, and @mentions.
*   **Retrieval:** Find entries using full-text search, category browsing, and a calendar view.
*   **Privacy & Sync:** The app is built with a local-first, privacy-centric architecture using Supabase for secure, optional cross-device syncing.

### Phase 2: Rich Media and Advanced Views
Following the MVP, Trace will be enhanced with more advanced capture and retrieval methods.
*   **Rich Capture:** Add support for capturing **images** and **voice notes**.
*   **Advanced Views:** Introduce a **map view** to find entries by location.
*   **Smart Features:** Implement smart data parsing (e.g., for workout tracking) and entry linking.


---

## 2. Problem and Context

### 2.1 Strategic Alignment
This app is complex enough to prove that I am able to create apps on iOS Android and web, and will be a challenging first app.

### 2.2 Problem Statements

**The Core Problem:**
People have important thoughts, ideas, tasks, and moments throughout their day that they want to remember and reference later. However, capturing these quickly while preserving enough context to actually find them later is nearly impossible with current tools.

**Who is affected:**
* **Everyone:** Anyone who has ideas, takes notes, wants to remember moments, or tracks tasks throughout their day
* **Privacy-conscious users:** People who want to capture personal thoughts and private information without trusting cloud services with their data
* **Mobile-first users:** People who need to capture things on the go with context like location and time automatically attached

**Core Problems:**
* **Lost thoughts:** Great ideas, important tasks, and meaningful moments are forgotten because capture isn't fast enough or convenient enough
* **Missing context:** Notes are captured without the "when," "where," or "who" that would help find them later, making retrieval nearly impossible
* **Fragmented tools:** Ideas go in one app, tasks in another, photos in another, journal entries somewhere else - nothing is connected
* **Poor retrieval:** Existing tools offer only basic search or chronological lists, making it hard to find things by context like "where was I?" or "when did this happen?" or "what did I tag this with?"
* **Privacy concerns:** Most capture tools require uploading personal thoughts and private information to cloud services without adequate privacy guarantees
* **No automatic organization:** Users must manually organize, tag, and categorize everything, which slows down capture and often doesn't happen

**Impact:**
* Important ideas and insights are lost forever
* Time wasted trying to remember or re-find things that were captured without context
* Reduced productivity from using multiple disconnected tools
* Anxiety about forgetting important information
* Reluctance to capture sensitive/personal thoughts due to privacy concerns
* Cognitive load from having to manually organize everything instead of automatic context-based organization

---

## 3. Personas

### Persona 1: Sarah - The Busy Entrepreneur
* **Role:** Startup founder and product manager
* **Description:** 34-year-old entrepreneur running a small tech startup. Constantly moving between meetings, coffee shops, and her home office. Has dozens of ideas, tasks, and thoughts throughout the day that she needs to capture quickly - product ideas, tasks, workout progress, book recommendations, meeting notes. Lives on her phone but wants everything available on her laptop too. Works out 3-4x per week and tracks her strength training progress.
* **Goals:**
    * Capture ideas instantly without breaking flow (in meetings, walking, driving)
    * Never lose a good product idea or important task
    * Track workout progress and see improvement over time
    * Find things later by remembering "I thought of this at that coffee shop last Tuesday"
    * Keep work, personal, and fitness captures in one place but organized
    * remember commitments or when someone asked me to complete something.
* **Frustrations:**
    * "I have notes scattered across Apple Notes, Notion, voice memos, Strong app for workouts, and random paper - I can never find anything"
    * "By the time I open an app and create a new note, I've forgotten half the idea"
    * "I remember WHERE I was when I had an idea, but I can't search my notes by location"
    * "I waste 20 minutes looking for that one thing I wrote down last week"
    * "I use a separate workout app, but I want everything in one place"
    * "I want to see all my 'exercise' entries, or just 'strength training', or just 'deadlift' - but my workout app and notes don't talk to each other"
* **System Needs:**
    * Lightning-fast capture (under 3 seconds from thought to saved)
    * Automatic context capture (time, location, current project)
    * **Nested/hierarchical tags** (e.g., #exercise/strength/deadlift, #work/product/features)
    * Filter at any tag level (see all #exercise or drill down to #exercise/strength/deadlift)
    * Search and filter by tags, date, location
    * Seamless sync between phone and laptop
    * Quick entry types: text, voice note, photo, task

### Persona 2: Marcus - The Privacy-Conscious Creative
* **Role:** Freelance writer and researcher
* **Description:** 29-year-old novelist and journalist. Captures research notes, story ideas, character sketches, and personal journal entries. Very protective of his creative work and personal thoughts. Doesn't trust cloud services with unencrypted data. Often works in cafes and libraries, capturing observations and ideas.
* **Goals:**
    * Capture creative inspiration the moment it strikes
    * Keep detailed research notes with sources and context
    * Maintain a private journal without Big Tech reading it
    * Link related ideas together (characters, themes, research topics)
    * Look back at when and where creative breakthroughs happened
* **Frustrations:**
    * "I don't want Google or Apple reading my novel drafts and personal journals"
    * "Most note apps force me to use their cloud sync - I want control of my data"
    * "I capture a great character idea but forget the context - was I people-watching? Where?"
    * "My notes are a mess - work research mixed with personal stuff with no organization"
    * "I want to see all my notes from 'writing at the library' or 'coffee shop observations'"
* **System Needs:**
    * End-to-end encryption for all data
    * Local-first storage with optional encrypted sync
    * Rich tagging system (projects, themes, people, topics)
    * Ability to link entries together
    * Calendar and map views to revisit context
    * Support for longer-form entries (mini journal entries)

### Persona 3: Jennifer - The Juggling Parent
* **Role:** Working mom and household manager
* **Description:** 38-year-old marketing manager with two kids (ages 6 and 9). Manages work tasks, family schedule, kids' activities, household needs, and tries to capture meaningful family moments. Always on the go between school dropoffs, work, errands, and activities. Wants to remember the little moments with her kids but is too busy for elaborate journaling.
* **Goals:**
    * Capture quick family moments (funny things kids said, milestones)
    * Track household tasks and shopping lists on the go
    * Remember when things happened ("When did Emma lose her first tooth?")
    * Tag entries by family member so she can look back at each kid's moments
    * Quick voice or photo capture while driving or multitasking
* **Frustrations:**
    * "I use Reminders for tasks, Photos for memories, Notes for lists - it's chaos"
    * "My kids say hilarious things but I forget to write them down, then can't remember later"
    * "I want to capture a moment but I'm driving or my hands are full"
    * "I can never remember WHEN things happened - was that last month or last year?"
    * "I want to see all the memories tagged with 'Emma' but they're scattered everywhere"
* **System Needs:**
    * Voice-to-text capture for hands-free entry
    * Quick photo + caption capture
    * Tag entries by person (@Emma, @David)
    * Calendar view to see "what happened this week/month"
    * Mixed entry types (photo + text, voice note, quick task)
    * Easy to use while multitasking or mobile

---

## 4. Critical User Journeys (CUJs)

### CUJ 1: Lightning-Fast Capture on the Go (No Tags Required)
* **Actor:** Sarah (Busy Entrepreneur)
* **Trigger:** Has a breakthrough product idea while walking between meetings
* **Goal:** Capture the complete idea before it's forgotten, with zero friction
* **Steps:**
    1. Pulls phone from pocket while walking
    2. Opens Trace app (or uses widget/quick action from lock screen)
    3. Types: "Auto-save feature for forms - users lose data on crashes"
    4. Hits send - entry goes to "Inbox" (unsorted), saved with automatic timestamp, GPS location
    5. Continues walking - total time: under 5 seconds
* **Problems Addressed:**
    - No more lost ideas due to slow capture
    - Tags are optional - capture first, organize later
    - Context (when, where) automatically preserved
    - "Inbox" provides a review queue for untagged entries

### CUJ 1b: Processing Inbox - Organizing Captured Entries
* **Actor:** Sarah (Busy Entrepreneur)
* **Trigger:** Evening routine - reviewing the day's captures
* **Goal:** Organize all untagged entries from Inbox into proper categories
* **Steps:**
    1. Opens Trace app, navigates to "Inbox" view
    2. Sees 8 entries captured throughout the day (all untagged)
    3. Reviews first entry: "Auto-save feature for forms - users lose data on crashes"
    4. Adds tag: #work/product/features
    5. Entry moves out of Inbox into #work/product/features category
    6. Continues through remaining 7 entries, adding tags to each
    7. Inbox is now empty, all entries organized
* **Problems Addressed:**
    - Separates fast capture from organization (GTD methodology)
    - Batch processing is more efficient than organizing during capture
    - Inbox provides clear "unprocessed items" counter (motivates daily review)

### CUJ 2: Tracking Workout Progress Over Time
* **Actor:** Sarah (Busy Entrepreneur)
* **Trigger:** At the gym, about to start deadlifts
* **Goal:** See last workout's numbers to know what weight to use today, then log today's session
* **Steps:**
    1. Opens Trace at the gym
    2. Filters by tag: #exercise/strength/deadlift
    3. Sees entries in chronological order:
       - "295x5 felt strong" (5 days ago)
       - "290x5" (12 days ago)
       - "285x6" (19 days ago)
    4. Decides to try 300 lbs today
    5. After set, quickly adds: "300x5 PR! #exercise/strength/deadlift"
    6. Entry automatically tagged with date, time, location (gym GPS)
* **Problems Addressed:**
    - All workout history in one place, no separate fitness app
    - Nested tags allow viewing all strength training or just specific exercises
    - Context (date/location) makes it easy to track progress patterns

### CUJ 3: Finding Something by Context (When/Where)
* **Actor:** Sarah (Busy Entrepreneur)
* **Trigger:** Remembers she had a great conversation with a mentor last week at a coffee shop but can't remember the advice
* **Goal:** Find the notes from that specific time and place
* **Steps:**
    1. Opens Trace app
    2. Switches to Calendar view, navigates to last week
    3. Sees all entries from that week grouped by day
    4. Clicks on Tuesday (when she met her mentor)
    5. Sees entry: "Meeting with @Janet - focus on retention before new features #work/advice"
    6. OR uses Map view to see all entries captured at that coffee shop location
* **Problems Addressed:**
    - Can find things by remembering "when" or "where" instead of just keywords
    - @mentions link entries to people
    - Multiple retrieval paths: tags, calendar, map, search

### CUJ 4: Capturing Family Moments Hands-Free
* **Actor:** Jennifer (Juggling Parent)
* **Trigger:** Driving home from school, daughter says something hilarious in the back seat
* **Goal:** Capture the moment without taking eyes off the road
* **Steps:**
    1. Activates Trace voice capture (via Siri shortcut or voice command)
    2. Says: "Emma just said she wants to be a 'professional cookie tester' when she grows up, tag Emma and funny"
    3. Trace creates entry with voice-to-text transcription
    4. Auto-tags with @Emma, #funny, timestamp, and location
    5. Later, Jennifer can filter by @Emma to see all Emma-related moments
    6. Or use Calendar view to create a "memory book" of moments by month
* **Problems Addressed:**
    - Hands-free capture for busy parents
    - @person tags make it easy to find all moments for each family member
    - No more forgotten moments - captured in the moment

### CUJ 5: Private Creative Work with Local-First Storage
* **Actor:** Marcus (Privacy-Conscious Creative)
* **Trigger:** First-time setup - wants to use Trace for novel notes and personal journal
* **Goal:** Ensure his creative work stays private and under his control
* **Steps:**
    1. Downloads Trace app
    2. During setup, chooses "Local-first storage" (data stays on device)
    3. Optionally enables encrypted sync to his own devices only
    4. Creates first entry: "Character idea - conflicted detective #novel/characters/detective"
    5. Adds personal journal: "Feeling stuck on chapter 3 #journal/writing"
    6. Data is stored locally, encrypted, never uploaded to Trace servers without his permission
* **Problems Addressed:**
    - Privacy-first architecture for sensitive content
    - User controls their data
    - End-to-end encryption for sync between devices

### CUJ 6: Reviewing All Entries for a Project/Theme
* **Actor:** Marcus (Privacy-Conscious Creative)
* **Trigger:** Working on novel, needs to review all character notes and research for chapter he's writing
* **Goal:** See all related entries across different tags and dates
* **Steps:**
    1. Opens Trace, filters by #novel
    2. Sees all entries under #novel hierarchy:
       - #novel/characters/detective (3 entries)
       - #novel/characters/witness (2 entries)
       - #novel/research/police-procedure (5 entries)
       - #novel/plot/chapter3 (4 entries)
    3. Drills down to #novel/plot/chapter3 to see those specific notes
    4. Can also switch to Calendar view to see when creative breakthroughs happened
    5. Map view shows which coffee shops were most productive
* **Problems Addressed:**
    - Hierarchical tags organize complex creative projects
    - Can view at any level (all novel work, or specific character, or specific chapter)
    - Multiple views (tags, calendar, map) provide different perspectives on the same data

### CUJ 7: Capturing and Managing Tasks with Due Dates
* **Actor:** Sarah (Busy Entrepreneur)
* **Trigger:** During standup meeting, team member asks for a custom order report
* **Goal:** Capture the commitment as a task, set a deadline, and track to completion
* **Steps:**
    1. **During meeting:** Quickly captures "Get custom order report for @Tina"
    2. Entry goes to Inbox as a note (status=none, due_date=null)
    3. **Later during inbox review:** Opens the entry
    4. Sets status = "incomplete" (now it's a task with checkbox)
    5. Sets due_date = end of week (Friday)
    6. Adds tag #work/reports
    7. Entry now appears in:
       - Tasks view (filtered to show all status=incomplete)
       - Calendar view on Friday (due date)
       - #work/reports tag filter
    8. **On Friday:** Completes the report, checks off the task
    9. Status changes to "complete", completed_at timestamp is set
    10. Task moves to "Completed" section, no longer shows in active tasks
* **Problems Addressed:**
    - Quick capture during meeting doesn't slow down conversation
    - Can add structure (task status, due date) during review phase
    - Tasks appear in multiple views (tasks list, calendar, tags) for flexibility
    - Clear distinction between active tasks and completed tasks
    - @mention links task to the person who requested it

### CUJ 8: Viewing Tasks and Upcoming Deadlines
* **Actor:** Sarah (Busy Entrepreneur)
* **Trigger:** Monday morning planning - wants to see all tasks and what's due this week
* **Goal:** Get clear picture of all active tasks and upcoming deadlines
* **Steps:**
    1. Opens Trace app
    2. Switches to "Tasks" view (shows all entries where status=incomplete)
    3. Sees tasks grouped by:
       - Overdue (due_date < today, highlighted in red)
       - Today (due_date = today)
       - This Week (due_date within 7 days)
       - No Due Date (status=incomplete but due_date=null)
    4. Sees "Get custom order report for @Tina" under "This Week - Friday"
    5. Can check off quick tasks directly from this view
    6. Can also switch to Calendar view to see tasks on specific days alongside events
* **Problems Addressed:**
    - Consolidated task management (no separate todo app needed)
    - Visual organization by due date helps prioritize
    - Overdue tasks are prominently highlighted
    - Tasks without deadlines still tracked (don't fall through cracks)
    - Calendar view shows tasks in context with other time-based entries

### CUJ 9: Creating and Organizing Category Hierarchy
* **Actor:** Sarah (Busy Entrepreneur) or Marcus (Privacy-Conscious Creative)
* **Trigger:** First-time user wants to organize their captures, or existing user wants to add a new category for a new project/area
* **Goal:** Create a well-organized category hierarchy that makes sense for their life/work
* **Steps:**
    1. **First capture:** Creates entry "Deadlift 295x5" (goes to Inbox, no category)
    2. **During inbox review:** Realizes they need an Exercise category
    3. Opens category dropdown selector
    4. Sees empty category list (or existing categories if not first time)
    5. Starts typing: "Exercise/Strength/Deadlift"
    6. System prompts: "Create new category path: Exercise/Strength/Deadlift?"
    7. Confirms - system creates:
       - Root category: "Exercise" (depth=0)
       - Child category: "Strength" (depth=1, parent=Exercise)
       - Leaf category: "Deadlift" (depth=2, parent=Strength)
    8. Entry is assigned to Exercise/Strength/Deadlift category
    9. Entry moves out of Inbox
    10. **Later:** Creates another entry "Squat 185x5"
    11. Opens category dropdown, sees existing hierarchy with autocomplete
    12. Selects "Exercise/Strength/" and types "Squat"
    13. Creates "Exercise/Strength/Squat" (reuses Exercise and Strength levels)
* **Problems Addressed:**
    - User-defined categories match their mental model (not pre-defined categories)
    - Category creation is seamless during workflow (no separate setup step)
    - Hierarchy grows organically as needed
    - Autocomplete prevents duplicates and speeds up category assignment

### CUJ 10: Managing and Reorganizing Categories
* **Actor:** Marcus (Privacy-Conscious Creative)
* **Trigger:** After using Trace for a while, wants to reorganize categories or clean up unused ones
* **Goal:** Rename, move, or delete categories without losing entries
* **Steps:**
    1. Opens Category Management screen
    2. Sees full category tree with entry counts:
       - Novel (0 entries)
         - Characters (5 entries)
           - Detective (3 entries)
           - Witness (2 entries)
         - Plot (0 entries)
           - Chapter3 (4 entries)
       - Research (12 entries)
    3. Notices "Novel" has 0 direct entries (only in subcategories)
    4. Wants to rename "Chapter3" to "Chapter 3 - Investigation"
    5. Clicks "Chapter3" → Edit → Renames to "Chapter 3 - Investigation"
    6. System updates full_path for all 4 entries in that category
    7. Wants to delete empty "Plot" category
    8. Clicks "Plot" → Delete
    9. System asks: "Move 4 entries from 'Chapter 3 - Investigation' to parent (Novel) or reassign?"
    10. Chooses "Move to Novel"
    11. Plot category deleted, entries moved to Novel
* **Problems Addressed:**
    - Categories can evolve as projects/needs change
    - Deleting categories doesn't lose entries
    - Entry counts show which categories are actually used
    - Renaming updates all entries automatically

---

## 5. Features

### Feature 0: Project Architecture & Foundation
* **Purpose:** Establish the technical foundation - monorepo structure, database schema, authentication, core architecture patterns, and UI shell/navigation that all other features depend on.
* **Supports:** All CUJs (foundation for entire app)
* **Priority:** MVP (Must be first)
* **Key Capabilities:**

    **Technical Foundation:**
    * Monorepo setup with npm workspaces (apps/mobile, apps/web, packages/core)
    * TypeScript configuration across all packages
    * Supabase project setup (database, auth, storage, realtime)
    * Database schema for unified Entry model (see Appendix A)
    * Core package (@trace/core) with module structure
    * Four-layer architecture pattern (API, Hooks, Helpers, Components)
    * React Query setup for data fetching/caching
    * Mobile app initialization (Expo/React Native)
    * Web app initialization (Vite/React)
    * Development environment (hot reload, debugging)
    * Build and deployment pipeline basics

    **Authentication:**
    * User registration (email/password via Supabase Auth)
    * User login (email/password)
    * User logout
    * Password reset flow
    * Session management
    * Protected routes (redirect to login if not authenticated)

    **UI Shell & Navigation (Mobile):**
    * Bottom tab navigation with main views:
      - Capture (quick entry)
      - Inbox
      - Categories
      - Calendar
      - Tasks
    * Tab icons and labels
    * Active tab highlighting
    * Tab navigation between views
    * Top navigation bar with app title/logo
    * Settings/profile menu (hamburger or profile icon)

    **UI Shell & Navigation (Web):**
    * Left sidebar navigation with main views:
      - Capture (always visible at top)
      - Inbox
      - Categories
      - Calendar
      - Tasks
      - Search
    * Sidebar can collapse/expand
    * Active view highlighting
    * Routing between views
    * Top navigation bar with app title/logo
    * User profile dropdown (settings, logout)

    **Routing & View Structure:**
    * Define all main routes/screens:
      - /capture (or always visible)
      - /inbox
      - /categories
      - /calendar
      - /tasks
      - /search
      - /settings
      - /entry/:id (view/edit entry)
    * URL-based routing (web)
    * Screen navigation (mobile)
    * Back navigation support
    * Deep linking support (open specific entry from notification/link)

### Feature 1: Rich Text Capture with WYSIWYG Editor
* **Purpose:** Enable users to capture thoughts, ideas, and tasks with simple formatting in under 5 seconds with zero friction.
* **Supports:** CUJ 1, CUJ 7
* **Priority:** MVP (Core Feature)
* **Key Capabilities:**

    **Core Capture:**
    * Optional title field (plain text, displays prominently)
    * WYSIWYG content editor (rich text with formatting)
    * Auto-capture timestamp (created_at)
    * Auto-capture GPS coordinates (if permission granted)
    * Save to Inbox if no category assigned
    * Mobile: Quick capture screen (one tap to open)
    * Web: Always-visible capture input

    **WYSIWYG Formatting:**
    * Formatting toolbar with buttons:
      - **Bold** button (Ctrl/Cmd+B)
      - *Italic* button (Ctrl/Cmd+I)
      - Bullet list button
      - Numbered list button
    * Nested/indented bullets (up to 3 levels):
      - Tab to indent (create sub-bullet)
      - Shift+Tab to outdent (move bullet up a level)
    * Auto-continue lists:
      - Pressing Enter in a list creates next list item automatically
      - Press Enter twice to exit list mode
    * No markdown syntax required (WYSIWYG toolbar only)
    * Mobile: Formatting toolbar above keyboard
    * Web: Formatting toolbar in editor

    **Quick Entry Features:**
    * Inline #tag parsing (extract tags from content)
    * Inline @mention parsing (extract mentions from content)
    * Tags and mentions preserved in content text
    * Submit: Ctrl/Cmd+Enter (web) or Send button (mobile)
    * Character/word count indicator (optional)

    **Implementation Notes:**
    * Mobile: React Native rich text editor library
    * Web: TipTap or Lexical (lightweight WYSIWYG)
    * Storage: HTML format in database
    * Display: Rendered HTML with styling

### Feature 2: Entry Management (CRUD Operations)
* **Purpose:** Allow users to view, edit, and delete their entries - essential for correcting mistakes and updating content.
* **Supports:** All CUJs (foundation)
* **Priority:** MVP (Core Feature)
* **Key Capabilities:**
    * View entry details (full content, metadata)
    * Edit entry content (text)
    * Edit entry tags (add/remove)
    * Edit entry @mentions
    * Edit entry status (none/incomplete/complete)
    * Edit entry due_date
    * Delete entry (with confirmation)
    * Soft delete (recoverable, or hard delete?)
    * Entry edit history/audit log (optional)
    * Timestamp for last updated (updated_at)
    * Cancel/Discard changes
    * Auto-save vs. manual save

### Feature 3: Categories & Tags System
* **Purpose:** Provide dual organization: (1) Categories for structured hierarchy, and (2) Tags for freeform discovery. Categories determine where entries live (like folders), tags help find them (like keywords).
* **Supports:** CUJ 1b, CUJ 2, CUJ 6
* **Priority:** MVP (Core Feature)
* **Key Capabilities:**

    **Categories (Structured Hierarchy):**
    * Hierarchical category structure (e.g., Exercise/Strength/Deadlift, Recipes/Italian/Pasta)
    * One category per entry (optional - null = Inbox)
    * Category dropdown selector (browse hierarchy during entry creation/edit)
    * Create new categories on-the-fly (type new path in dropdown)
    * Category autocomplete based on existing categories
    * Parent-child category relationships
    * Maximum depth: 5 levels
    * Category entry count (show how many entries in each)
    * Category management screen (rename, delete, reorganize)
    * Category validation (unique paths per user, valid characters)
    * Optional category color/icon for visual organization

    **Tags (Freeform Discovery):**
    * Inline tag parsing (#tag syntax in entry content)
    * Extract tags from content during save
    * Store as array of strings (flat structure, no hierarchy)
    * Multiple tags per entry (unlimited)
    * Tag autocomplete based on previously used tags
    * Tag usage frequency tracking (for autocomplete sorting)
    * Display tags as pills/badges below entry content
    * Click tag to filter all entries with that tag
    * Tags are optional (entries don't need tags)

    **@Mentions:**
    * Inline @mention parsing (@person syntax)
    * Extract mentions from content during save
    * Store as array of strings
    * Multiple @mentions per entry
    * @mention autocomplete based on previously used mentions
    * Display @mentions as clickable badges
    * Click @mention to filter all entries mentioning that person

### Feature 4: Inbox & Review Workflow
* **Purpose:** Separate fast capture from organization using GTD methodology - capture instantly, organize in batch.
* **Supports:** CUJ 1, CUJ 1b, CUJ 7
* **Priority:** MVP (Core Feature)
* **Key Capabilities:**
    * Inbox view showing all entries without category (category_id = null)
    * Inbox counter/badge (unprocessed count)
    * List view of inbox entries
    * Quick assign category (dropdown selector without full edit)
    * Quick add inline tags (#tag in content)
    * Quick set status (none → incomplete)
    * Quick set due_date
    * Auto-remove from inbox when category assigned
    * Mark multiple entries at once (batch operations)
    * Mobile: Swipe to process
    * Web: Keyboard shortcuts for processing

### Feature 5: Task Management
* **Purpose:** Unified task management - any entry can become a task with optional due date, eliminating need for separate todo app.
* **Supports:** CUJ 7, CUJ 8
* **Priority:** MVP (Core Feature)
* **Key Capabilities:**
    * Entry status field (none/incomplete/complete)
    * Due date field (optional timestamp)
    * Task completion checkbox UI
    * Mark task complete (status → complete, set completed_at)
    * Mark task incomplete (re-open completed tasks)
    * Tasks view (filter: status=incomplete)
    * Group tasks by:
        - Overdue (due_date < today, red highlight)
        - Today (due_date = today)
        - This Week (due_date within 7 days)
        - No Due Date (incomplete, no deadline)
    * Completed tasks history (filter: status=complete)
    * Task count badges (total incomplete)

### Feature 6: Categories View & Browsing
* **Purpose:** Browse and filter entries by hierarchical categories, enabling drill-down from broad categories to specific topics.
* **Supports:** CUJ 2, CUJ 6
* **Priority:** MVP (Core Feature)
* **Key Capabilities:**
    * Hierarchical category tree/list display
    * Filter entries by category at any hierarchy level
    * Category drill-down (click category → see child categories and entries)
    * Entry count per category
    * Category breadcrumb navigation
    * "All Entries" view (no category filter)
    * Show entries in selected category (not including subcategories)
    * Show entries in selected category AND all subcategories (toggle)
    * Filter by freeform tag (separate filter: show all entries with #tag)
    * Filter by @mention (separate filter: show all entries mentioning @person)
    * Combined filters (category + tag + @mention)

### Feature 7: Calendar View
* **Purpose:** View entries organized by date, enabling temporal retrieval and review of what happened when.
* **Supports:** CUJ 3, CUJ 8
* **Priority:** MVP (Core Feature)
* **Key Capabilities:**
    * Calendar UI (day/week/month views)
    * Entries grouped by date (created_at)
    * Tasks shown on due_date
    * Click date → see all entries for that day
    * Navigate between days/weeks/months
    * Today indicator
    * Entry count per day
    * Color coding (notes vs. tasks vs. completed)

### Feature 8: Search & Filtering
* **Purpose:** Full-text search across all entry content plus advanced filtering by attributes.
* **Supports:** CUJ 3, CUJ 6
* **Priority:** MVP (Core Feature)
* **Key Capabilities:**
    * Full-text search across entry content
    * Search results highlighting
    * Filter by date range
    * Filter by status (none/incomplete/complete)
    * Filter by tags (already in Feature 6)
    * Filter by @mentions
    * Combined filters (search text + tag + date range)
    * Sort options:
        - Newest first (created_at DESC)
        - Oldest first (created_at ASC)
        - Due date (for tasks)
    * Clear all filters
    * Save searches (Phase 2)

### Feature 9: Privacy & Local Storage
* **Purpose:** Privacy-first architecture with local-first storage and user data control.
* **Supports:** CUJ 5, Persona 2 (Marcus)
* **Priority:** MVP
* **Key Capabilities:**
    * Local-first storage (Supabase with local caching)
    * User authentication (Supabase Auth)
    * Row-level security (users only see their own entries)
    * Optional sync enable/disable per user
    * Export all data (JSON/CSV download)
    * Delete account with full data removal
    * Privacy settings page
    * Clear privacy policy

### Feature 10: Cross-Platform Sync
* **Purpose:** Seamlessly sync entries across mobile and web so captures on phone appear on laptop.
* **Supports:** CUJ 1, All personas
* **Priority:** MVP
* **Key Capabilities:**
    * Real-time sync via Supabase Realtime subscriptions
    * Offline-first (app works without internet)
    * React Query cache invalidation on sync
    * Sync status indicator (syncing/synced/offline)
    * Conflict resolution (last-write-wins for MVP)
    * Retry failed sync operations
    * Manual sync trigger button

### Feature 11: Location Tracking & Context
* **Purpose:** Automatically capture GPS location to enable location-based retrieval and context.
* **Supports:** CUJ 2, CUJ 3, CUJ 6
* **Priority:** MVP (but can be simplified)
* **Key Capabilities:**
    * Auto-capture GPS coordinates on entry creation
    * Location permission handling (request/denial)
    * Store lat/lng with entry
    * Reverse geocoding (GPS → readable location) (Phase 2?)
    * Display location name with entry (Phase 2?)
    * Privacy controls (disable GPS capture)
    * Manual location override (Phase 2)

---

## Phase 2 Features (Post-MVP)

### Feature 12: Map View (Phase 2)
* **Purpose:** Visualize entries on map by location for spatial context and retrieval.
* **Key Capabilities:**
    * Map UI with entry markers
    * Click marker → see entry
    * Filter entries by proximity/location
    * Location clustering for many entries
    * "Show me everything from this coffee shop"

### Feature 13: Voice Capture (Phase 2)
* **Purpose:** Hands-free capture via voice-to-text for driving, multitasking.
* **Supports:** CUJ 4
* **Key Capabilities:**
    * Voice recording
    * Speech-to-text transcription
    * Voice note attachment (optional)
    * Voice command for tags/mentions
    * Mobile: Siri/Google Assistant integration

### Feature 14: Photo Capture (Phase 2)
* **Purpose:** Capture visual moments with optional text captions.
* **Supports:** CUJ 4, Persona 3 (Jennifer)
* **Key Capabilities:**
    * Camera integration
    * Photo capture with caption
    * Photo storage (Supabase Storage)
    * Photo thumbnails in list views
    * Multiple photos per entry

### Feature 15: Advanced Task Features (Phase 2)
* **Purpose:** Recurring tasks, subtasks, task dependencies, reminders.
* **Key Capabilities:**
    * Recurring tasks (daily, weekly, custom)
    * Subtasks/checklist items
    * Task reminders/notifications
    * Task dependencies

### Feature 16: Entry Attachments (Phase 2)
* **Purpose:** Attach files, documents, audio to entries.
* **Key Capabilities:**
    * File attachments (PDF, docs, etc.)
    * Audio attachments
    * File preview
    * File storage management

### Feature 17: Smart Data Parsing & Visualization (Phase 2)
* **Purpose:** Parse workout formats, numeric data, show progress charts.
* **Supports:** CUJ 2 (workout tracking)
* **Key Capabilities:**
    * Recognize workout patterns (295x5)
    * Extract numeric data (#health/weight, #health/steps)
    * Progress graphs/charts
    * Trend analysis
    * Export parsed data

### Feature 18: Advanced Organization (Phase 2)
* **Purpose:** Linked entries, entry templates, saved searches, bulk operations.
* **Key Capabilities:**
    * Link entries together
    * Entry templates
    * Saved searches/smart filters
    * Bulk edit/delete operations
    * Tag colors/customization
    * Tag renaming/merging

---

## 6. Requirements

### Feature 1: Rich Text Capture with WYSIWYG Editor

#### 1.1 Entry Creation Interface

1.1.1 The system shall provide a quick capture interface accessible within one tap/click from the main screen
   - [ ] Mobile: Quick capture button always visible on main screen
   - [ ] Web: Capture input field always visible at top of main screen
   - [ ] Interface opens instantly (< 200ms response time)

1.1.2 The system shall provide an optional title field for entries
   - [ ] Title field appears above content field
   - [ ] Title is plain text (no formatting)
   - [ ] Title is optional (can be left blank)
   - [ ] Title displays prominently when viewing entry (H1 style)
   - [ ] Title has a maximum length of 200 characters

1.1.3 The system shall provide a WYSIWYG content editor for rich text entry
   - [ ] Content field accepts rich text with formatting
   - [ ] Content is the main entry field, but it is optional to allow for location-only traces.
   - [ ] Content stores as HTML in database
   - [ ] Content field expands as user types (auto-grow)

1.1.4 The system shall provide a dedicated 'Pin Location' button for creating location-only traces
   - [ ] A 'Pin Location' or 'Check-in' button shall be accessible from the main screen.
   - [ ] Tapping this button will create and save a new trace containing only the current timestamp and GPS location.
   - [ ] This action should not require any further user input.

#### 1.2 WYSIWYG Formatting Toolbar

1.2.1 The system shall provide a formatting toolbar with basic formatting buttons
   - [ ] Bold button (icon: B)
   - [ ] Italic button (icon: I)
   - [ ] Bullet list button (icon: •)
   - [ ] Numbered list button (icon: 1.)
   - [ ] Mobile: Toolbar appears above on-screen keyboard
   - [ ] Web: Toolbar integrated into editor interface

1.2.2 The system shall support keyboard shortcuts for formatting
   - [ ] Ctrl/Cmd+B for bold
   - [ ] Ctrl/Cmd+I for italic
   - [ ] Keyboard shortcuts work on both mobile (external keyboard) and web

1.2.3 The system shall apply formatting to selected text
   - [ ] User selects text, clicks format button → formatting applied to selection
   - [ ] If no text selected, formatting applies to text typed next
   - [ ] Clicking format button again toggles off formatting

#### 1.3 Nested Bullet and Numbered Lists

1.3.1 The system shall support bullet lists with nested indentation
   - [ ] User can create bullet list by clicking bullet button
   - [ ] Pressing Enter in a bullet creates next bullet automatically
   - [ ] Pressing Enter twice exits bullet list mode
   - [ ] Tab key indents current bullet (creates sub-bullet)
   - [ ] Shift+Tab key outdents current bullet (moves up one level)
   - [ ] Maximum nesting depth: 3 levels
   - [ ] Visual indentation clearly shows hierarchy

1.3.2 The system shall support numbered lists with nested indentation
   - [ ] User can create numbered list by clicking numbered list button
   - [ ] Pressing Enter in a numbered list creates next item with incremented number
   - [ ] Pressing Enter twice exits numbered list mode
   - [ ] Tab key indents current item (creates sub-item with different numbering style)
   - [ ] Shift+Tab key outdents current item
   - [ ] Maximum nesting depth: 3 levels
   - [ ] Numbering restarts appropriately at each level (1, 2, 3 → a, b, c → i, ii, iii)

1.3.3 The system shall handle mixed lists (bullets within numbered or vice versa)
   - [ ] User can switch list type at any nesting level
   - [ ] Indentation preserved when switching list types

#### 1.4 Inline Tag and Mention Parsing

1.4.1 The system shall parse and extract tags from entry content
   - [ ] Tags are identified by # prefix (e.g., #favorite, #urgent)
   - [ ] Tags are extracted when entry is saved
   - [ ] Tags stored as array in entry.tags field
   - [ ] Tags remain in original content text (not removed)
   - [ ] Multiple tags per entry supported (unlimited)
   - [ ] Tags are case-insensitive for matching (#Urgent = #urgent)
   - [ ] Tag names cannot contain spaces (use underscore or camelCase)

1.4.2 The system shall parse and extract mentions from entry content
   - [ ] Mentions are identified by @ prefix (e.g., @Sarah, @Mike)
   - [ ] Mentions are extracted when entry is saved
   - [ ] Mentions stored as array in entry.mentions field
   - [ ] Mentions remain in original content text (not removed)
   - [ ] Multiple mentions per entry supported (unlimited)
   - [ ] Mention names can contain spaces if followed by punctuation or whitespace

#### 1.5 Auto-Capture Metadata

1.5.1 The system shall automatically capture timestamp when entry is created
   - [ ] created_at timestamp set to current date/time on save
   - [ ] Timestamp accurate to the second
   - [ ] Timestamp stored in UTC
   - [ ] Timestamp displayed to user in local timezone

1.5.2 The system shall automatically capture GPS location when entry is created
   - [ ] System requests location permission on first use
   - [ ] If permission granted, capture GPS coordinates (lat/lng)
   - [ ] Store coordinates in entry.location_lat and entry.location_lng fields
   - [ ] Location capture is non-blocking (entry saves even if location fails)
   - [ ] User can disable location capture in settings
   - [ ] If permission denied or location disabled, fields remain null

#### 1.6 Entry Submission

1.6.1 The system shall save entry when user submits
   - [ ] Mobile: "Save" or "Done" button submits entry
   - [ ] Web: Ctrl/Cmd+Enter keyboard shortcut submits entry
   - [ ] Web: "Save" button submits entry
   - [ ] Entry is saved to database
   - [ ] If no category assigned, entry goes to Inbox (category_id = null)
   - [ ] Tags and mentions are extracted and stored
   - [ ] Success confirmation shown to user
   - [ ] Capture interface cleared after successful save

1.6.2 The system shall validate entry before saving
   - [ ] The content field is optional. However, a trace must not be completely empty (e.g. it must contain a title, content, or location).
   - [ ] Title can be empty (optional)
   - [ ] If validation fails, show error message
   - [ ] Entry is not saved if validation fails

1.6.3 The system shall handle save failures gracefully
   - [ ] If save fails (network error, server error), show error message
   - [ ] Entry content is preserved (not lost)
   - [ ] User can retry save
   - [ ] Option to save draft locally if offline (offline mode)

#### 1.7 User Experience

1.7.1 The system shall provide visual feedback during entry creation
   - [ ] Character/word count indicator (optional, can be toggled)
   - [ ] Format buttons highlight when active (e.g., Bold button highlighted when in bold text)
   - [ ] Cursor position indicator in lists
   - [ ] Loading indicator during save

1.7.2 The system shall provide fast, responsive interface
   - [ ] Typing latency < 50ms
   - [ ] Format button response < 100ms
   - [ ] Entry save completes within 2 seconds (normal network conditions)

---

### Feature 0: Project Architecture & Foundation

#### 0.1 Monorepo Setup

0.1.1 The system shall use npm workspaces for monorepo management
   - [ ] Root package.json configured with workspaces
   - [ ] Workspaces: apps/mobile, apps/web, packages/core
   - [ ] Shared dependencies hoisted to root
   - [ ] Package-specific dependencies in respective package.json files

0.1.2 The system shall configure TypeScript across all packages
   - [ ] Root tsconfig.json with shared compiler options
   - [ ] Package-specific tsconfig.json extending root config
   - [ ] Strict mode enabled
   - [ ] Path aliases configured (@trace/core)

0.1.3 The system shall provide build scripts for all packages
   - [ ] npm run build:core - builds @trace/core package
   - [ ] npm run build:web - builds web app
   - [ ] npm run build:mobile - builds mobile app
   - [ ] npm run build:all - builds everything

0.1.4 The system shall provide development scripts
   - [ ] npm run dev:core - watch mode for core package
   - [ ] npm run dev:web - Vite dev server for web
   - [ ] npm run dev:mobile - Expo dev server for mobile
   - [ ] Hot module reload working in dev mode

#### 0.2 Database Schema

0.2.1 The system shall create Supabase project and configure connection
   - [ ] Supabase project created
   - [ ] Environment variables for Supabase URL and anon key
   - [ ] Supabase client initialized in @trace/core
   - [ ] Connection tested and verified

0.2.2 The system shall create entries table
   - [ ] Table: entries with all fields per Appendix A data model
   - [ ] Primary key: entry_id (UUID, auto-generated)
   - [ ] Foreign key: user_id references auth.users
   - [ ] Foreign key: category_id references categories (nullable)
   - [ ] Indexes: user_id, category_id, created_at, status, due_date

0.2.3 The system shall create categories table
   - [ ] Table: categories with all fields per Appendix A
   - [ ] Primary key: category_id (UUID)
   - [ ] Foreign key: user_id references auth.users
   - [ ] Foreign key: parent_category_id references categories (nullable)
   - [ ] Indexes: user_id, full_path (unique per user)

0.2.4 The system shall implement Row-Level Security (RLS)
   - [ ] RLS enabled on entries table
   - [ ] RLS enabled on categories table
   - [ ] Policy: Users can only read their own entries
   - [ ] Policy: Users can only insert entries with their user_id
   - [ ] Policy: Users can only update/delete their own entries
   - [ ] Policy: Same for categories table

#### 0.3 Authentication

0.3.1 The system shall implement user registration
   - [ ] Registration form with email and password fields
   - [ ] Email validation (valid email format)
   - [ ] Password validation (min 8 characters)
   - [ ] Supabase Auth signup integration
   - [ ] Error handling for existing user, invalid input
   - [ ] Success message and auto-login after registration

0.3.2 The system shall implement user login
   - [ ] Login form with email and password fields
   - [ ] Supabase Auth signIn integration
   - [ ] "Remember me" checkbox (extended session)
   - [ ] Error handling for invalid credentials
   - [ ] Redirect to app after successful login
   - [ ] Session persistence (refresh token)

0.3.3 The system shall implement password reset
   - [ ] "Forgot password" link on login page
   - [ ] Email input form for reset request
   - [ ] Supabase Auth resetPasswordForEmail integration
   - [ ] Email sent with reset link
   - [ ] Reset password page (from email link)
   - [ ] New password form with validation
   - [ ] Success message after password reset

0.3.4 The system shall implement user logout
   - [ ] Logout button in navigation/settings
   - [ ] Supabase Auth signOut integration
   - [ ] Clear local session/cache
   - [ ] Redirect to login page

0.3.5 The system shall implement session management
   - [ ] Check for valid session on app load
   - [ ] Redirect to login if no valid session
   - [ ] Auto-refresh session token before expiry
   - [ ] Session timeout after 30 days inactivity (configurable)

0.3.6 The system shall protect routes/screens
   - [ ] All app routes require authentication
   - [ ] Login/register routes are public
   - [ ] Redirect to login if accessing protected route while unauthenticated
   - [ ] Preserve intended destination after login

#### 0.4 Core Package Structure

0.4.1 The system shall implement four-layer architecture in @trace/core
   - [ ] Folder structure: src/modules/[module]
   - [ ] Each module has: [module]Api.ts, [module]Hooks.ts, [Module]Types.ts, [module]Helpers.ts
   - [ ] API layer: Direct database operations (not exported)
   - [ ] Hooks layer: React Query hooks wrapping API calls (exported)
   - [ ] Types layer: TypeScript interfaces (exported)
   - [ ] Helpers layer: Pure utility functions (exported)

0.4.2 The system shall configure React Query
   - [ ] QueryClient configured with sensible defaults
   - [ ] QueryClientProvider wraps app
   - [ ] Default staleTime, cacheTime configured
   - [ ] React Query DevTools enabled in dev mode
   - [ ] Error handling configured

0.4.3 The system shall export module interfaces
   - [ ] Each module has index.ts exporting public API
   - [ ] @trace/core main index.ts exports all modules
   - [ ] Type-only exports properly marked
   - [ ] Apps import from @trace/core (never relative paths to core)

#### 0.5 Mobile App Initialization

0.5.1 The system shall set up Expo/React Native project
   - [ ] Expo SDK 54+ installed
   - [ ] React Native 0.81+ configured
   - [ ] TypeScript configured
   - [ ] App.tsx entry point created
   - [ ] Metro bundler configured

0.5.2 The system shall configure mobile navigation
   - [ ] Bottom tab navigator component created
   - [ ] Tab screens: Capture, Inbox, Categories, Calendar, Tasks
   - [ ] Tab icons and labels
   - [ ] Active tab highlighting
   - [ ] Stack navigator for detail screens

0.5.3 The system shall configure mobile styling
   - [ ] React Native StyleSheet used for styling
   - [ ] Shared style constants (colors, spacing, typography)
   - [ ] Platform-specific styles (iOS vs Android) where needed

#### 0.6 Web App Initialization

0.6.1 The system shall set up Vite/React project
   - [ ] Vite 7+ configured
   - [ ] React 19+ installed
   - [ ] TypeScript configured
   - [ ] index.html and main.tsx entry point

0.6.2 The system shall configure web routing
   - [ ] React Router v7 installed
   - [ ] Routes defined for all main views
   - [ ] Sidebar navigation component
   - [ ] Protected route wrapper
   - [ ] 404 Not Found route

0.6.3 The system shall configure web styling
   - [ ] Tailwind CSS configured
   - [ ] Class Variance Authority (CVA) for component variants
   - [ ] clsx and tailwind-merge for className composition
   - [ ] Shared theme configuration (colors, spacing)

#### 0.7 UI Shell - Mobile

0.7.1 The system shall implement mobile bottom tab navigation
   - [ ] Tab bar visible at bottom of screen
   - [ ] 5 tabs: Capture, Inbox, Categories, Calendar, Tasks
   - [ ] Icons for each tab
   - [ ] Labels for each tab
   - [ ] Active tab highlighted (different color/icon)
   - [ ] Badge on Inbox tab (unprocessed count)
   - [ ] Badge on Tasks tab (incomplete count)

0.7.2 The system shall implement mobile top navigation
   - [ ] Top bar with app title/logo
   - [ ] Profile/settings icon (top right)
   - [ ] Tapping profile icon opens settings menu
   - [ ] Menu includes: Settings, Export Data, Logout

0.7.3 The system shall implement mobile screen navigation
   - [ ] Tapping tab navigates to that screen
   - [ ] Back button on detail screens
   - [ ] Swipe back gesture support
   - [ ] Deep linking support (open specific entry from URL/notification)

#### 0.8 UI Shell - Web

0.8.1 The system shall implement web sidebar navigation
   - [ ] Left sidebar with navigation links
   - [ ] Links: Capture, Inbox, Categories, Calendar, Tasks, Search, Settings
   - [ ] Active link highlighted
   - [ ] Badge on Inbox (unprocessed count)
   - [ ] Badge on Tasks (incomplete count)
   - [ ] Collapse/expand sidebar button
   - [ ] Sidebar state persists (collapsed/expanded)

0.8.2 The system shall implement web top navigation
   - [ ] Top bar with app title/logo
   - [ ] User profile dropdown (top right)
   - [ ] Dropdown includes: Settings, Export Data, Logout
   - [ ] Sync status indicator in top bar

0.8.3 The system shall implement web routing and navigation
   - [ ] URL-based routing (e.g., /inbox, /calendar, /entry/123)
   - [ ] Browser back/forward button support
   - [ ] Breadcrumb navigation where appropriate
   - [ ] Keyboard shortcuts for navigation (e.g., G+I for Inbox)

#### 0.9 Development Environment

0.9.1 The system shall provide hot reload in development
   - [ ] Web: Vite HMR working
   - [ ] Mobile: Expo hot reload working
   - [ ] Core package changes trigger rebuild

0.9.2 The system shall provide debugging tools
   - [ ] React Developer Tools support
   - [ ] React Query DevTools in dev mode
   - [ ] Console logging for API calls in dev mode
   - [ ] Source maps enabled

0.9.3 The system shall provide linting and formatting
   - [ ] ESLint configured
   - [ ] Prettier configured
   - [ ] Pre-commit hooks (optional)
   - [ ] npm run lint script
   - [ ] npm run format script

#### 0.10 Build and Deployment

0.10.1 The system shall provide production build scripts
   - [ ] npm run build:web - optimized production build for web
   - [ ] npm run build:mobile - production build for mobile
   - [ ] Minification and tree-shaking enabled
   - [ ] Environment variables properly injected

0.10.2 The system shall configure deployment (basic)
   - [ ] Web: Deployment target identified (Vercel, Netlify, etc.)
   - [ ] Mobile: Build settings for iOS and Android
   - [ ] Environment variables for production (Supabase prod keys)

---

### Feature 2: Entry Management (CRUD Operations)

#### 2.1 View Entry Details

2.1.1 The system shall display full entry details when user selects an entry
   - [ ] Title displayed prominently (H1 style) if present
   - [ ] Content displayed with rich text formatting preserved
   - [ ] Category shown with full path (e.g., "Exercise/Strength/Deadlift")
   - [ ] Tags displayed as clickable pills/badges
   - [ ] @Mentions displayed as clickable badges
   - [ ] Created date/time displayed in user's local timezone
   - [ ] Location displayed if captured (human-readable name or coordinates)
   - [ ] Status displayed if not "none" (incomplete/complete badge)
   - [ ] Due date displayed if set
   - [ ] Completed date displayed if task is complete

2.1.2 The system shall provide navigation from entry detail back to previous view
   - [ ] Back button returns to previous screen/view
   - [ ] Breadcrumb navigation (web) shows current location
   - [ ] Mobile: Back gesture support

#### 2.2 Edit Entry

2.2.1 The system shall allow user to edit existing entries
   - [ ] Edit button/icon visible on entry detail screen
   - [ ] Clicking edit opens entry in edit mode
   - [ ] Edit mode shows same WYSIWYG editor as create mode
   - [ ] Title field pre-populated with current title
   - [ ] Content field pre-populated with current content (preserves formatting)
   - [ ] Category selector pre-populated with current category
   - [ ] Tags visible in content (inline #tags)
   - [ ] @Mentions visible in content (inline @mentions)

2.2.2 The system shall save edited entry when user submits
   - [ ] Save button saves changes to database
   - [ ] updated_at timestamp set to current date/time
   - [ ] Tags and mentions re-parsed from edited content
   - [ ] Success message shown after save
   - [ ] Return to entry detail view after save
   - [ ] Mobile: Keyboard shortcuts (Cmd+Enter) to save

2.2.3 The system shall allow user to cancel edit without saving
   - [ ] Cancel button discards changes
   - [ ] Confirmation dialog if changes were made ("Discard changes?")
   - [ ] Return to entry detail view without saving

2.2.4 The system shall update entry status and due date from edit mode
   - [ ] Status dropdown (none/incomplete/complete)
   - [ ] Due date picker (optional)
   - [ ] Changes save with entry

#### 2.3 Delete Entry

2.3.1 The system shall allow user to delete entries
   - [ ] Delete button/icon visible on entry detail or edit screen
   - [ ] Confirmation dialog before delete ("Are you sure?")
   - [ ] Entry removed from database on confirm
   - [ ] Return to previous view after delete
   - [ ] Success message shown after delete

2.3.2 The system shall handle delete failures gracefully
   - [ ] Error message if delete fails
   - [ ] Entry remains visible if delete fails
   - [ ] User can retry delete

#### 2.4 Auto-save vs. Manual Save

2.4.1 The system shall use manual save (explicit save button)
   - [ ] Changes not saved until user clicks Save
   - [ ] Unsaved changes indicator (e.g., "Unsaved changes" text or asterisk)
   - [ ] Confirmation dialog if user navigates away with unsaved changes

---

### Feature 3: Categories & Tags System

#### 3.1 Category Management

3.1.1 The system shall provide a category dropdown selector
   - [ ] Dropdown shows hierarchical category tree
   - [ ] Indentation visually shows hierarchy levels
   - [ ] Categories sorted alphabetically within each level
   - [ ] "No Category" option at top (entry goes to Inbox)
   - [ ] Currently selected category highlighted
   - [ ] Entry count shown next to each category

3.1.2 The system shall support creating new categories on-the-fly
   - [ ] User can type new category path in dropdown (e.g., "Exercise/Strength/Deadlift")
   - [ ] Autocomplete suggests existing categories as user types
   - [ ] System prompts "Create new category: [path]?" if not exists
   - [ ] On confirm, system creates all parent categories if needed
   - [ ] New category immediately available for selection

3.1.3 The system shall validate category paths
   - [ ] Category names cannot be empty
   - [ ] Category paths must be unique per user
   - [ ] Maximum depth: 5 levels
   - [ ] Invalid characters rejected (e.g., /, \, special chars that break paths)
   - [ ] Error message shown for invalid category

3.1.4 The system shall store category hierarchy
   - [ ] Each category has parent_category_id (null for root)
   - [ ] Each category has full_path stored
   - [ ] Each category has depth (0-5)
   - [ ] Categories belong to user (user_id foreign key)

#### 3.2 Category Management Screen

3.2.1 The system shall provide a category management screen
   - [ ] Accessible from settings or main navigation
   - [ ] Shows full category tree with entry counts
   - [ ] Expandable/collapsible tree view
   - [ ] Categories sorted alphabetically

3.2.2 The system shall allow renaming categories
   - [ ] Edit button/icon on category
   - [ ] Rename dialog with current name pre-filled
   - [ ] On save, update category name and full_path
   - [ ] Update full_path for all child categories
   - [ ] Success message shown

3.2.3 The system shall allow deleting categories
   - [ ] Delete button/icon on category
   - [ ] Warning if category has entries
   - [ ] Options: "Move entries to parent category" or "Reassign to different category"
   - [ ] Cannot delete if reassignment target not selected
   - [ ] On confirm, move/reassign entries and delete category
   - [ ] Success message shown

3.2.4 The system shall show category usage statistics
   - [ ] Entry count per category (direct entries only)
   - [ ] Total entry count including subcategories (optional toggle)
   - [ ] Last used date for each category
   - [ ] Highlight unused/empty categories

#### 3.3 Tag Parsing and Storage

3.3.1 The system shall parse inline tags from content
   - [ ] Extract all words prefixed with # (e.g., #favorite, #urgent)
   - [ ] Tags stored in entry.tags array
   - [ ] Tags remain in original content (not removed)
   - [ ] Tags are case-insensitive (#Urgent treated same as #urgent)
   - [ ] Tag names cannot contain spaces (space ends tag)

3.3.2 The system shall provide tag autocomplete
   - [ ] As user types #, show dropdown of previously used tags
   - [ ] Sorted by usage frequency (most used first)
   - [ ] Filter suggestions as user types more characters
   - [ ] Clicking suggestion inserts tag into content

3.3.3 The system shall track tag usage
   - [ ] Count how many entries have each tag
   - [ ] Store usage count for autocomplete sorting
   - [ ] Update counts when entries created/edited/deleted

#### 3.4 @Mention Parsing and Storage

3.4.1 The system shall parse inline mentions from content
   - [ ] Extract all words prefixed with @ (e.g., @Sarah, @Mike)
   - [ ] Mentions stored in entry.mentions array
   - [ ] Mentions remain in original content (not removed)
   - [ ] Mention names can contain spaces if followed by punctuation/whitespace

3.4.2 The system shall provide mention autocomplete
   - [ ] As user types @, show dropdown of previously used mentions
   - [ ] Sorted by usage frequency (most used first)
   - [ ] Filter suggestions as user types more characters
   - [ ] Clicking suggestion inserts mention into content

---

### Feature 4: Inbox & Review Workflow

#### 4.1 Inbox View

4.1.1 The system shall display all entries without category in Inbox
   - [ ] Query entries where category_id IS NULL
   - [ ] Display as list sorted by created_at DESC (newest first)
   - [ ] Show title and content preview for each entry
   - [ ] Show created date/time
   - [ ] Show tags and mentions if present

4.1.2 The system shall show inbox count
   - [ ] Badge on Inbox navigation item showing count
   - [ ] Count updates in real-time as entries processed
   - [ ] Count displayed as "0" when inbox empty

4.1.3 The system shall show empty state when inbox is empty
   - [ ] Message: "Inbox is empty! Great job organizing."
   - [ ] Icon or illustration
   - [ ] Prompt to create new entry

#### 4.2 Quick Processing

4.2.1 The system shall allow quick category assignment from inbox
   - [ ] Category dropdown on each inbox entry
   - [ ] Selecting category immediately saves and removes from inbox
   - [ ] No need to open full edit mode
   - [ ] Success feedback (entry slides away or fades out)

4.2.2 The system shall allow quick status assignment from inbox
   - [ ] Checkbox or toggle to mark as task (set status=incomplete)
   - [ ] Immediately saves and updates entry
   - [ ] Entry remains in inbox until category assigned

4.2.3 The system shall allow quick due date assignment from inbox
   - [ ] Due date picker on each inbox entry
   - [ ] Selecting date immediately saves
   - [ ] Entry remains in inbox until category assigned

4.2.4 The system shall support swipe gestures for processing (mobile)
   - [ ] Swipe left: Show quick action buttons (assign category, mark as task, delete)
   - [ ] Swipe right: Alternative quick actions
   - [ ] Actions execute immediately

4.2.5 The system shall support keyboard shortcuts for processing (web)
   - [ ] Arrow keys to navigate between inbox entries
   - [ ] C key: Assign category (open category dropdown)
   - [ ] T key: Mark as task
   - [ ] D key: Delete entry
   - [ ] Enter key: Open full entry detail

#### 4.3 Batch Operations

4.3.1 The system shall support selecting multiple inbox entries
   - [ ] Checkbox on each entry for multi-select
   - [ ] "Select All" option
   - [ ] Visual indicator of selected count

4.3.2 The system shall support batch category assignment
   - [ ] "Assign Category" button when entries selected
   - [ ] Choose category from dropdown
   - [ ] Apply to all selected entries
   - [ ] All entries removed from inbox after assignment

4.3.3 The system shall support batch delete
   - [ ] "Delete" button when entries selected
   - [ ] Confirmation dialog showing count
   - [ ] Delete all selected entries

---

### Feature 5: Task Management

#### 5.1 Task Status

5.1.1 The system shall support task status field on entries
   - [ ] Status enum: none | incomplete | complete
   - [ ] Default: none (regular note, not a task)
   - [ ] Status stored in entry.status field

5.1.2 The system shall allow marking entry as task
   - [ ] Checkbox or toggle to set status=incomplete
   - [ ] Available during creation, editing, or quick action
   - [ ] Visual indicator that entry is a task (checkbox icon)

5.1.3 The system shall allow marking task as complete
   - [ ] Checkbox to toggle status from incomplete → complete
   - [ ] Set completed_at timestamp when marked complete
   - [ ] Visual indicator (checkmark, strikethrough, grayed out)

5.1.4 The system shall allow reopening completed tasks
   - [ ] Unchecking completed task sets status back to incomplete
   - [ ] Clears completed_at timestamp
   - [ ] Task moves back to active tasks list

#### 5.2 Due Dates

5.2.1 The system shall support optional due dates on entries
   - [ ] due_date field (timestamp, nullable)
   - [ ] Date picker UI component
   - [ ] Can be set during creation, editing, or quick action
   - [ ] Can be cleared (set to null)

5.2.2 The system shall display due date on entries
   - [ ] Show formatted date (e.g., "Due Friday", "Due Jan 15")
   - [ ] Show "Overdue" badge if due_date < today and status=incomplete
   - [ ] Show relative dates for near-term (Today, Tomorrow, This Week)

#### 5.3 Tasks View

5.3.1 The system shall provide a dedicated Tasks view
   - [ ] Filter: status = incomplete
   - [ ] Display all active tasks
   - [ ] Accessible from main navigation

5.3.2 The system shall group tasks by timeframe
   - [ ] Section: Overdue (due_date < today, highlighted red)
   - [ ] Section: Today (due_date = today)
   - [ ] Section: This Week (due_date within next 7 days)
   - [ ] Section: No Due Date (status=incomplete, due_date IS NULL)
   - [ ] Each section shows task count

5.3.3 The system shall display task details in list
   - [ ] Title (if present) or content preview
   - [ ] Category badge
   - [ ] Due date
   - [ ] Checkbox to mark complete
   - [ ] Click task to open full entry detail

5.3.4 The system shall allow quick task completion from Tasks view
   - [ ] Checkbox on each task
   - [ ] Clicking checkbox marks complete immediately
   - [ ] Task moves to Completed section with animation
   - [ ] Success feedback

#### 5.4 Completed Tasks

5.4.1 The system shall provide view of completed tasks
   - [ ] Filter: status = complete
   - [ ] Sorted by completed_at DESC (most recent first)
   - [ ] Toggle or separate screen to view completed tasks
   - [ ] Show completed date/time

5.4.2 The system shall display completed tasks differently
   - [ ] Checkmark icon
   - [ ] Strikethrough text (optional)
   - [ ] Grayed out or lower opacity
   - [ ] Show how long ago completed

#### 5.5 Task Count Badges

5.5.1 The system shall show task counts in navigation
   - [ ] Badge on Tasks nav item showing incomplete task count
   - [ ] Badge on Overdue section showing overdue count
   - [ ] Counts update in real-time

---

### Feature 6: Categories View & Browsing

#### 6.1 Category Tree Display

6.1.1 The system shall display hierarchical category tree
   - [ ] Tree/list view showing all categories
   - [ ] Indentation shows hierarchy levels
   - [ ] Expand/collapse controls for parent categories
   - [ ] Icons indicate expanded/collapsed state

6.1.2 The system shall show entry counts per category
   - [ ] Count of direct entries in each category
   - [ ] Optional: Total count including subcategories
   - [ ] Count displayed next to category name

6.1.3 The system shall support category navigation
   - [ ] Click category to filter entries by that category
   - [ ] Breadcrumb navigation shows current category path
   - [ ] "Back" or "Up" button to navigate to parent category

#### 6.2 Filtering Entries by Category

6.2.1 The system shall filter entries when category selected
   - [ ] Show entries where category_id matches selected category
   - [ ] Option: Include subcategories (toggle)
   - [ ] Entry list updates immediately

6.2.2 The system shall display filtered entries
   - [ ] List sorted by created_at DESC (newest first)
   - [ ] Show title and content preview
   - [ ] Show tags, mentions, status, due date
   - [ ] Click entry to view details

6.2.3 The system shall show "All Entries" view
   - [ ] Option to clear category filter
   - [ ] Shows all entries regardless of category
   - [ ] Includes inbox entries (no category)

#### 6.3 Combined Filtering

6.3.1 The system shall support filtering by category AND tag
   - [ ] Select category, then filter by tag
   - [ ] Shows entries that match both filters (AND logic)
   - [ ] Filter pills/badges show active filters
   - [ ] Clear individual filters or clear all

6.3.2 The system shall support filtering by category AND mention
   - [ ] Select category, then filter by @mention
   - [ ] Shows entries matching both filters
   - [ ] Active filters displayed clearly

---

### Feature 7: Calendar View

#### 7.1 Calendar UI

7.1.1 The system shall display calendar interface
   - [ ] Month view showing current month
   - [ ] Day view showing entries for selected day
   - [ ] Week view showing entries for current week (optional)
   - [ ] Navigation to previous/next month
   - [ ] "Today" button to jump to current date

7.1.2 The system shall highlight dates with entries
   - [ ] Dot or badge on dates that have entries
   - [ ] Color coding: notes vs tasks vs completed tasks
   - [ ] Entry count shown on date (optional)

7.1.3 The system shall highlight current date
   - [ ] Visual indicator for today's date (border, background)
   - [ ] Distinct from other dates

#### 7.2 Viewing Entries by Date

7.2.1 The system shall display entries when date selected
   - [ ] Click date to see all entries for that day
   - [ ] Entries sorted by created_at (chronological within day)
   - [ ] Group by: Entries created on this date
   - [ ] Group by: Tasks due on this date (if different)

7.2.2 The system shall display entry details in day view
   - [ ] Title (if present) or content preview
   - [ ] Category badge
   - [ ] Tags and mentions
   - [ ] Status (if task)
   - [ ] Time of day entry was created
   - [ ] Click to view full entry

7.2.3 The system shall show empty state for dates with no entries
   - [ ] Message: "No entries on this date"
   - [ ] Option to create new entry for that date

#### 7.3 Tasks on Calendar

7.3.1 The system shall display tasks on their due date
   - [ ] Tasks appear on calendar on due_date
   - [ ] Visual distinction from regular entries (checkbox icon)
   - [ ] Overdue tasks highlighted in red on current date

7.3.2 The system shall show task status on calendar
   - [ ] Incomplete tasks: Open checkbox
   - [ ] Complete tasks: Checkmark (grayed out or strikethrough)
   - [ ] Quick complete from calendar view (click checkbox)

---

### Feature 8: Search & Filtering

#### 8.1 Full-Text Search

8.1.1 The system shall provide search input
   - [ ] Search bar visible in main navigation or search screen
   - [ ] Placeholder text: "Search entries..."
   - [ ] Clear button to reset search

8.1.2 The system shall search entry content
   - [ ] Search title field
   - [ ] Search content field (HTML stripped for search)
   - [ ] Search tags (match #tag names)
   - [ ] Search mentions (match @person names)
   - [ ] Case-insensitive search

8.1.3 The system shall display search results
   - [ ] Results list sorted by relevance or date (configurable)
   - [ ] Highlight matching text in results
   - [ ] Show result count
   - [ ] No results message if no matches

8.1.4 The system shall update results as user types
   - [ ] Live search (results update on each keystroke)
   - [ ] Debounce/throttle to avoid excessive queries
   - [ ] Loading indicator during search

#### 8.2 Advanced Filtering

8.2.1 The system shall support filtering by date range
   - [ ] Date range picker (from date, to date)
   - [ ] Preset ranges: Today, This Week, This Month, Last 30 Days
   - [ ] Filter applies to created_at field
   - [ ] Results update immediately

8.2.2 The system shall support filtering by status
   - [ ] Filter: All | Notes (status=none) | Tasks (status=incomplete) | Completed (status=complete)
   - [ ] Dropdown or button group
   - [ ] Results update immediately

8.2.3 The system shall support combined filters
   - [ ] Search text + date range
   - [ ] Search text + category
   - [ ] Search text + tag
   - [ ] Search text + status
   - [ ] Multiple filters applied with AND logic

8.2.4 The system shall display active filters
   - [ ] Filter pills/badges showing active filters
   - [ ] Click X on pill to remove that filter
   - [ ] "Clear All Filters" button

#### 8.3 Sorting

8.3.1 The system shall support sorting search results
   - [ ] Sort by: Newest First (created_at DESC)
   - [ ] Sort by: Oldest First (created_at ASC)
   - [ ] Sort by: Due Date (for tasks)
   - [ ] Sort by: Relevance (for text search)
   - [ ] Dropdown or button group to change sort

---

### Feature 9: Privacy & Local Storage

#### 9.1 User Authentication

9.1.1 The system shall require authentication to access entries
   - [ ] Redirect to login if not authenticated
   - [ ] Protected routes/screens require valid session
   - [ ] Session timeout after inactivity (configurable, default 30 days)

9.1.2 The system shall support user registration
   - [ ] Email and password required
   - [ ] Email validation (valid format)
   - [ ] Password requirements: minimum 8 characters
   - [ ] Confirmation email (Supabase Auth)

9.1.3 The system shall support user login
   - [ ] Email and password authentication
   - [ ] "Remember me" option (longer session)
   - [ ] Error messages for invalid credentials

9.1.4 The system shall support password reset
   - [ ] "Forgot password" link on login screen
   - [ ] Email sent with reset link
   - [ ] Reset password page with new password input

#### 9.2 Row-Level Security

9.2.1 The system shall enforce row-level security in database
   - [ ] Users can only read their own entries
   - [ ] Users can only create entries with their user_id
   - [ ] Users can only update their own entries
   - [ ] Users can only delete their own entries
   - [ ] Supabase RLS policies enforce this

9.2.2 The system shall enforce category security
   - [ ] Users can only see their own categories
   - [ ] Categories tied to user via user_id foreign key

#### 9.3 Data Export

9.3.1 The system shall allow users to export their data
   - [ ] Export button in settings
   - [ ] Export format: JSON (all data structured)
   - [ ] Export format: CSV (simplified, for spreadsheets)
   - [ ] Export includes all entries, categories, tags, mentions
   - [ ] Download file to user's device

#### 9.4 Account Deletion

9.4.1 The system shall allow users to delete their account
   - [ ] Delete account option in settings
   - [ ] Confirmation dialog with warning
   - [ ] Require password re-entry for confirmation
   - [ ] Delete all user data: entries, categories
   - [ ] Delete user account from Supabase Auth
   - [ ] Redirect to goodbye/confirmation page

---

### Feature 10: Cross-Platform Sync

#### 10.1 Real-Time Sync

10.1.1 The system shall sync entries across devices in real-time
   - [ ] Supabase Realtime subscriptions for entries table
   - [ ] Changes on one device appear on other devices within seconds
   - [ ] React Query cache invalidation on sync event

10.1.2 The system shall sync categories across devices
   - [ ] Realtime sync for categories table
   - [ ] Category changes propagate to all devices

#### 10.2 Offline Support

10.2.1 The system shall work offline
   - [ ] React Query caches data locally
   - [ ] User can view cached entries when offline
   - [ ] User can create/edit entries when offline (queued)
   - [ ] "Offline" indicator shown when no network

10.2.2 The system shall sync when connection restored
   - [ ] Queued operations execute when back online
   - [ ] Optimistic updates preserved
   - [ ] Success feedback when sync completes

#### 10.3 Conflict Resolution

10.3.1 The system shall handle sync conflicts (MVP: last-write-wins)
   - [ ] If same entry edited on two devices offline, last save wins
   - [ ] User notified if conflict occurred (optional)
   - [ ] Future: Show conflict resolution UI

#### 10.4 Sync Status

10.4.1 The system shall display sync status
   - [ ] Indicator: Synced | Syncing | Offline
   - [ ] Icon or text in navigation bar
   - [ ] Manual sync trigger button (pull to refresh on mobile)

---

### Feature 11: Location Tracking & Context

#### 11.1 GPS Capture

11.1.1 The system shall request location permission
   - [ ] Permission prompt on first entry creation
   - [ ] Explain why location is requested
   - [ ] Handle permission denied gracefully

11.1.2 The system shall capture GPS coordinates on entry creation
   - [ ] Capture lat/lng when permission granted
   - [ ] Store in entry.location_lat and entry.location_lng
   - [ ] Non-blocking (entry saves even if location fails)
   - [ ] Accurate to within reasonable precision (10-100m)

11.1.3 The system shall display captured location
   - [ ] Show coordinates or human-readable location name
   - [ ] Displayed on entry detail screen
   - [ ] Link to view on map (Phase 2: Map View feature)

#### 11.2 Location Settings

11.2.1 The system shall allow users to disable location tracking
   - [ ] Setting: Enable/Disable location capture
   - [ ] Default: Enabled (ask on first use)
   - [ ] When disabled, location fields remain null

11.2.2 The system shall respect system-level location permissions
   - [ ] If OS permission denied, don't capture location
   - [ ] Prompt user to enable in system settings if they want location

---

## 6.5 Success Metrics & KPIs

### User Acquisition & Retention
* **Target Active Users:** 1,000 users within 6 months of MVP launch
* **User Retention:** 40% 30-day retention rate (users return after 30 days)
* **User Retention:** 25% 90-day retention rate
* **Daily Active Users (DAU):** 20% of total registered users
* **Weekly Active Users (WAU):** 50% of total registered users

### Usage Metrics
* **Entries Per User Per Week:** Target average of 10+ entries per active user per week
* **Capture Speed:** 90% of entries created in under 5 seconds
* **Inbox Processing Rate:** Users process 70%+ of inbox entries within 7 days
* **Category Usage:** 80%+ of entries assigned to a category (not in Inbox)
* **Tag Usage:** Average 2+ tags per entry
* **Task Completion Rate:** 60%+ of tasks marked complete within deadline

### Engagement Metrics
* **Session Duration:** Average session 3-5 minutes
* **Sessions Per Week:** Average 5+ sessions per active user
* **Feature Adoption:**
  - 90%+ users use text capture
  - 70%+ users use categories
  - 60%+ users use tasks
  - 50%+ users use calendar view
  - 40%+ users use tags
  - 30%+ users use search

### Performance Metrics
* **App Load Time:** < 2 seconds on average device/connection
* **Entry Save Time:** < 1 second for 95% of saves
* **Search Response Time:** < 500ms for 95% of searches
* **Sync Latency:** Changes appear on other devices within 5 seconds

### Quality Metrics
* **Crash Rate:** < 1% of sessions
* **Error Rate:** < 2% of API calls fail
* **User-Reported Bugs:** < 5 critical bugs per month post-launch
* **User Satisfaction:** Net Promoter Score (NPS) > 30

---

## 6.6 Non-Functional Requirements

### Performance

#### Response Time
* **Page Load:** Initial app load < 2 seconds on 4G connection
* **Route Navigation:** Screen transitions < 200ms
* **Entry List Rendering:** Display 100 entries < 500ms
* **Search Results:** Display results < 500ms
* **Save Operations:** Entry save complete < 1 second (normal conditions)

#### Throughput
* **Concurrent Users:** Support 10,000 concurrent users (future scaling)
* **API Rate Limits:** 100 requests per minute per user
* **Database Queries:** < 100ms for 95th percentile

### Scalability
* **User Growth:** Architecture supports scaling to 100,000+ users
* **Data Volume:** Support 1 million+ entries per user
* **Storage:** Efficient storage for rich text (HTML compression)
* **Database:** Supabase free tier limits respected initially, plan for scaling

### Reliability & Availability
* **Uptime:** 99.5% uptime target (allows ~3.6 hours downtime per month)
* **Data Durability:** Zero data loss (Supabase backups)
* **Backup Frequency:** Database backed up daily (Supabase managed)
* **Disaster Recovery:** Ability to restore from backup within 24 hours

### Security
* **Authentication:** Secure password storage (bcrypt via Supabase)
* **Authorization:** Row-Level Security enforced for all data access
* **Transport Security:** All API calls over HTTPS/TLS
* **Session Security:** Secure session tokens, auto-expiration
* **Data Privacy:** User data isolated (cannot access other users' data)
* **SQL Injection Prevention:** Parameterized queries, Supabase client handles this
* **XSS Prevention:** HTML sanitization for user-generated content

### Usability
* **Learnability:** New users can create first entry within 2 minutes
* **Efficiency:** Power users can capture entry in < 5 seconds
* **Error Recovery:** Clear error messages with actionable guidance
* **Accessibility:** Keyboard navigation support for all functions (web)
* **Responsive Design:** App works on screen sizes from 320px to 2560px wide

### Compatibility

#### Browser Support (Web)
* **Desktop:** Chrome 100+, Firefox 100+, Safari 15+, Edge 100+
* **Mobile:** Safari iOS 15+, Chrome Android 100+
* **Progressive Web App (PWA):** Installable on supported browsers (Phase 2)

#### Mobile Platform Support
* **iOS:** iOS 15.0 and above
* **Android:** Android 10 (API 29) and above
* **Expo Compatibility:** Compatible with Expo SDK 54+

#### Device Support
* **Screen Sizes:** 320px to 2560px width responsive design
* **Orientations:** Both portrait and landscape supported
* **Touch Targets:** Minimum 44x44px touch targets (mobile)

### Maintainability
* **Code Quality:** TypeScript strict mode, ESLint rules enforced
* **Documentation:** Code comments for complex logic, README for each module
* **Testing:** Unit test coverage goal 60%+ (Phase 2)
* **Modular Architecture:** Four-layer pattern enables independent module updates
* **Version Control:** Git with semantic versioning (semver)

### Localization (Future)
* **Language Support:** English-only for MVP
* **i18n Infrastructure:** Placeholder for future localization (Phase 2)
* **Date/Time Formatting:** User's local timezone, locale-aware formatting

---

## 6.7 Assumptions & Constraints

### Assumptions
* **User Device:** Users have modern smartphone (iOS 15+ or Android 10+) or modern web browser
* **Internet Connection:** Users have internet connectivity for sync (app works offline temporarily)
* **Location Permission:** Users will grant location permission (optional but recommended)
* **Email Access:** Users have valid email address for registration
* **Single User:** MVP assumes single user per device (no account switching)
* **English Language:** All UI and documentation in English initially
* **Desktop Usage:** Some users will use web version on laptop/desktop for longer entries
* **Mobile-First:** Primary use case is mobile quick capture

### Constraints

#### Technical Constraints
* **Supabase Free Tier Limits:**
  - 500 MB database storage
  - 2 GB file storage
  - 50,000 monthly active users
  - 2 GB bandwidth per month
  - Must upgrade to Pro plan if limits exceeded
* **Expo Limitations:** Must use Expo-compatible libraries (some native modules excluded)
* **React Native:** UI limited to what's possible with React Native components
* **Browser APIs:** Web features limited to what's available in target browsers

#### Resource Constraints
* **Development Team:** Solo developer (assume you are building this alone or with minimal help)
* **Budget:** $0 budget initially (free tier services only)
* **Timeline:** MVP target 3-6 months (depends on part-time vs full-time)
* **Infrastructure:** Free tier services only (Supabase free, Vercel/Netlify free hosting)

#### Business Constraints
* **Privacy Focus:** Cannot sell user data, cannot use data for advertising
* **No Monetization in MVP:** Free app initially, monetization strategy deferred
* **Legal:** Must comply with GDPR, CCPA for user data (export, deletion features required)
* **Terms of Service:** Need to create ToS and Privacy Policy before public launch

#### Design Constraints
* **Mobile-First Design:** UI optimized for mobile small screens first
* **Minimal External Dependencies:** Limit third-party libraries to reduce bundle size
* **Progressive Enhancement:** Core features work without JavaScript (where possible)
* **Offline-First:** App must function with limited or no connectivity

---

## 6.8 Out of Scope for MVP

### Explicitly Not Included in MVP
* **Voice-to-Text Capture:** Deferred to Phase 2 (Feature 13)
* **Photo/Image Capture:** Deferred to Phase 2 (Feature 14)
* **Map View:** Deferred to Phase 2 (Feature 12)
* **Smart Data Parsing:** Workout tracking visualizations deferred to Phase 2 (Feature 17)
* **Entry Linking:** Ability to link entries together (Phase 2, Feature 18)
* **Entry Templates:** Pre-defined entry templates (Phase 2)
* **Recurring Tasks:** Tasks that repeat daily/weekly (Phase 2, Feature 15)
* **Subtasks:** Tasks with checklist items (Phase 2)
* **Reminders/Notifications:** Push notifications for due tasks (Phase 2)
* **Collaboration/Sharing:** Sharing entries with other users (Future)
* **Public Entries:** Making entries publicly viewable (Future)
* **Social Features:** Comments, likes, follows (Future)
* **Third-Party Integrations:** Google Calendar, Todoist, etc. (Future)
* **API for External Apps:** Public API for third-party integrations (Future)
* **Desktop Native Apps:** macOS, Windows native apps (web app sufficient for MVP)
* **Apple Watch / Wear OS:** Companion apps for smartwatches (Future)
* **Browser Extensions:** Chrome/Firefox extensions for quick capture (Future)
* **Email to Entry:** Forward emails to create entries (Future)
* **Import from Other Apps:** Import data from Notion, Evernote, etc. (Future)
* **Advanced Analytics:** Usage analytics dashboard for users (Future)
* **Team/Multi-User Workspaces:** Shared workspaces for teams (Future)
* **End-to-End Encryption:** Enhanced encryption beyond RLS (Future)
* **Self-Hosted Option:** Allow users to host their own instance (Future)

---

## 6.9 Dependencies

### External Services
* **Supabase:**
  - Purpose: Database, authentication, real-time sync, storage
  - Free Tier: 500MB database, 2GB storage, 50K MAU
  - Risk: Service downtime affects entire app
  - Mitigation: Monitor Supabase status page, have fallback plan

### Core Technologies
* **React 19+:** Web frontend framework
* **React Native 0.81+:** Mobile framework
* **Expo SDK 54+:** React Native tooling and libraries
* **TypeScript:** Type safety across entire codebase
* **Vite 7+:** Web bundler and dev server
* **React Query (TanStack Query):** Data fetching and caching
* **React Router v7:** Web routing
* **Tailwind CSS:** Web styling framework
* **Supabase JS Client:** API client for Supabase

### Libraries & Tools (Mobile)
* **React Native Rich Text Editor:** WYSIWYG editing (TBD specific library)
* **React Native Date Picker:** Date selection component
* **React Native Maps:** Map display (Phase 2)
* **Expo Location:** GPS/location services

### Libraries & Tools (Web)
* **TipTap or Lexical:** WYSIWYG rich text editor
* **date-fns or Luxon:** Date formatting and manipulation
* **clsx + tailwind-merge:** className composition
* **Class Variance Authority (CVA):** Component variant management

### Development Tools
* **npm:** Package manager
* **ESLint:** Code linting
* **Prettier:** Code formatting
* **Git:** Version control
* **GitHub:** Code hosting (assumed)

### Infrastructure
* **Vercel or Netlify:** Web hosting (free tier)
* **Expo Application Services (EAS):** Mobile build and deployment
* **App Store / Google Play:** Mobile app distribution

---

## 6.10 Risks & Mitigation

### Technical Risks

**Risk: Supabase Free Tier Limits Exceeded**
* **Impact:** High - App stops working for users
* **Likelihood:** Medium - Depends on user growth
* **Mitigation:**
  - Monitor usage dashboards weekly
  - Set up alerts at 80% of limits
  - Have upgrade plan ready (budget for Pro tier)
  - Optimize queries to reduce database load

**Risk: WYSIWYG Editor Bugs on Mobile**
* **Impact:** High - Core feature broken
* **Likelihood:** Medium - Mobile rich text is complex
* **Mitigation:**
  - Thoroughly test multiple React Native rich text editors
  - Have fallback to plain text input if critical issues
  - Phased rollout: start with web WYSIWYG, add mobile later

**Risk: Sync Conflicts and Data Loss**
* **Impact:** Critical - Users lose data
* **Likelihood:** Low-Medium - Offline editing creates conflicts
* **Mitigation:**
  - Use last-write-wins strategy initially (simple)
  - Comprehensive testing of offline scenarios
  - Implement conflict detection and user notification
  - Future: Add conflict resolution UI

**Risk: Performance Degradation with Large Entry Counts**
* **Impact:** Medium - App becomes slow
* **Likelihood:** Medium - Users with 1000+ entries
* **Mitigation:**
  - Implement pagination (load 50 entries at a time)
  - Virtual scrolling for long lists
  - Database indexes on frequently queried fields
  - Performance testing with large datasets

**Risk: Cross-Browser Compatibility Issues**
* **Impact:** Medium - Features broken on some browsers
* **Likelihood:** Medium - Rich text editors vary across browsers
* **Mitigation:**
  - Test on all target browsers regularly
  - Use well-maintained libraries with good browser support
  - Graceful degradation for unsupported features

### Product Risks

**Risk: Users Don't Adopt Categories (Everything in Inbox)**
* **Impact:** Medium - Reduces organizational value
* **Likelihood:** Medium - Users are lazy about organizing
* **Mitigation:**
  - Make category assignment very quick (dropdown in inbox)
  - Add inbox badge counter to motivate processing
  - Show benefits of organization (stats, ease of finding)

**Risk: Low User Retention**
* **Impact:** High - Product fails
* **Likelihood:** Medium - Note apps have competition
* **Mitigation:**
  - Focus on unique value: context (time, location)
  - Fast capture as core differentiator
  - User onboarding with clear value proposition
  - Email reminders for inactive users (Phase 2)

**Risk: Privacy Concerns Limit Adoption**
* **Impact:** Medium - Target users won't use app
* **Likelihood:** Low-Medium - Privacy-focused users are cautious
* **Mitigation:**
  - Clear privacy policy
  - Highlight data ownership and export features
  - Row-level security explained in marketing
  - Local-first architecture as selling point

### Resource Risks

**Risk: Solo Development Takes Too Long**
* **Impact:** High - Delayed launch, lost momentum
* **Likelihood:** Medium - Building cross-platform is complex
* **Mitigation:**
  - Start with web-only MVP (defer mobile)
  - Use established libraries and patterns (don't reinvent)
  - Cut scope ruthlessly (Phase 2 features stay in Phase 2)
  - Set realistic timeline expectations

**Risk: Budget Constraints**
* **Impact:** Medium - Can't upgrade services when needed
* **Likelihood:** Low initially, High later if successful
* **Mitigation:**
  - Start on free tiers
  - Monitor costs proactively
  - Plan monetization strategy early
  - Have upgrade budget set aside

### Security Risks

**Risk: Data Breach / Unauthorized Access**
* **Impact:** Critical - User trust destroyed
* **Likelihood:** Low - Supabase handles security well
* **Mitigation:**
  - Rely on Supabase RLS and authentication
  - Regular security audits of code
  - Never log sensitive data
  - Prompt security patches for dependencies

**Risk: SQL Injection / XSS Attacks**
* **Impact:** High - Data compromise
* **Likelihood:** Low - Using Supabase client (parameterized)
* **Mitigation:**
  - Always use Supabase client (never raw SQL)
  - Sanitize HTML content from rich text editor
  - Content Security Policy headers
  - Regular dependency updates

---

## 6.11 Timeline & Milestones

### Phase 0: Foundation (Weeks 1-3)
**Goal:** Project setup and architecture
* Week 1: Monorepo setup, database schema, Supabase config
* Week 2: Authentication, UI shell (web + mobile)
* Week 3: Core package architecture, React Query setup

**Deliverable:** Empty app with navigation and auth working

### Phase 1: Core Capture & Organization (Weeks 4-8)
**Goal:** Basic capture and organization features
* Week 4: Feature 1 - Rich text capture (web)
* Week 5: Feature 2 - Entry management (view, edit, delete)
* Week 6: Feature 3 - Categories and tags system
* Week 7: Feature 4 - Inbox and review workflow
* Week 8: Testing, bug fixes, polish

**Deliverable:** Can create, organize, and manage entries on web

### Phase 2: Views & Discovery (Weeks 9-12)
**Goal:** Multiple ways to view and find entries
* Week 9: Feature 6 - Categories view and filtering
* Week 10: Feature 7 - Calendar view
* Week 11: Feature 8 - Search and filtering
* Week 12: Testing, bug fixes, performance optimization

**Deliverable:** Full web app with all views working

### Phase 3: Tasks & Mobile (Weeks 13-16)
**Goal:** Task management and mobile apps
* Week 13: Feature 5 - Task management
* Week 14: Mobile app - Port core features to React Native
* Week 15: Feature 10 - Cross-platform sync
* Week 16: Testing, bug fixes, platform-specific polish

**Deliverable:** Task management working, mobile apps functional

### Phase 4: Location & Polish (Weeks 17-20)
**Goal:** Location tracking, privacy features, final polish
* Week 17: Feature 11 - Location tracking
* Week 18: Feature 9 - Privacy features (export, account deletion)
* Week 19: End-to-end testing, user acceptance testing
* Week 20: Bug fixes, performance tuning, documentation

**Deliverable:** MVP feature-complete and polished

### Phase 5: Launch Preparation (Weeks 21-24)
**Goal:** Prepare for public launch
* Week 21: App store submissions (iOS, Android)
* Week 22: Landing page, marketing materials
* Week 23: Beta testing with small user group
* Week 24: Fix critical bugs, prepare launch

**Deliverable:** Ready for public launch

### MVP Launch Target: End of Week 24 (6 months)

### Post-Launch
* **Month 1-3:** Monitor metrics, fix bugs, small improvements
* **Month 4-6:** Plan Phase 2 features based on user feedback
* **Month 6+:** Implement Phase 2 features (voice, photos, map, analytics)

**Success Criteria for MVP Launch:**
- All 11 MVP features complete and tested
- < 5 critical bugs
- Web app and mobile apps deployed and accessible
- At least 10 beta users actively using the app
- Performance metrics met (< 2s load time, < 1s save time)
- Documentation complete (README, user guide)

---

## 7. Data Requirements

### Core Data Entities

* **User:** Stores user account information including email, authentication credentials (via Supabase Auth), and profile settings. Users own all their entries and categories.

* **Entry:** The primary data entity in Trace. Stores all captured content (notes, tasks, events, journal entries). Each entry includes:
  - Content: HTML/rich text with WYSIWYG formatting
  - Title: Optional plain text displayed prominently
  - Metadata: Created/updated timestamps, location (optional GPS coordinates)
  - Organization: One category_id (optional, null = Inbox), multiple tags (array of strings), multiple mentions (array of @person references)
  - Task attributes: status (none/incomplete/complete), due_date (optional timestamp)
  - Relationships: Belongs to one user, belongs to zero or one category

* **Category:** Hierarchical organizational structure (like folders). Stores:
  - Name and full path (e.g., "Exercise/Strength/Deadlift")
  - Parent-child relationships (parent_category_id)
  - User ownership (each user has their own category tree)
  - Entry count for display

* **Tag:** Freeform discovery keywords extracted from inline #tag syntax. Not a separate table - stored as array on Entry entity. System indexes tags for fast filtering.

* **Mention:** Person references extracted from inline @mention syntax. Not a separate table - stored as array on Entry entity. Used for filtering and future collaboration features.

### Key Data Rules

* **Entry Validation:**
  - An Entry cannot be created without a user_id (every entry has an owner)
  - At least one of title or content must be non-empty (cannot create completely blank entries)
  - If status is set to "incomplete" or "complete", the entry is considered a task
  - If due_date is set, the entry appears in calendar views
  - Tags are case-insensitive and automatically lowercased (e.g., #Workout becomes #workout)
  - Category_id must reference an existing category owned by the same user, or be null (Inbox)

* **Category Validation:**
  - Category names within the same parent must be unique for each user
  - Category paths are case-insensitive (e.g., "Exercise" and "exercise" are the same)
  - Parent categories cannot be deleted if they have child categories (must delete children first)
  - Categories with entries cannot be hard-deleted (system prompts to move entries first)
  - Maximum category nesting depth: 5 levels (prevents infinite recursion)

* **User Data Isolation:**
  - Users can only access their own entries, categories, tags, and mentions
  - Row-Level Security (RLS) policies enforce data isolation at the database level
  - All queries automatically filter by authenticated user_id
  - Sharing features are explicitly out of scope for MVP

* **Referential Integrity:**
  - If a category is deleted, all entries in that category have category_id set to null (moved to Inbox)
  - User deletion must cascade to all owned entries and categories (hard delete for MVP)
  - Orphaned entries (user_id references deleted user) should not exist

### Data Lifecycle

* **Entry Data:**
  - Entries are retained indefinitely while user account is active
  - Soft delete not implemented in MVP - entries are hard-deleted when user deletes them
  - No automatic archival or expiration
  - Completed tasks remain in system unless explicitly deleted
  - Future: May implement archive/trash with 30-day retention before permanent deletion

* **Category Data:**
  - Categories persist as long as user account is active
  - Deleting a category moves all contained entries to Inbox (category_id = null)
  - Empty categories can be immediately deleted
  - Category structure is rebuilt on app initialization from database

* **User Account Data:**
  - User authentication data managed by Supabase Auth
  - User profile data stored in users table
  - Account deletion removes all user data (entries, categories) immediately in MVP
  - Future: May implement 30-day grace period with data anonymization

* **Sync & Offline Data:**
  - Local-first architecture: Data stored on device and synced to Supabase when online
  - React Query caches data locally for offline access
  - Optimistic updates allow creating/editing entries while offline
  - On reconnection, local changes sync to server automatically
  - Conflict resolution: Last-write-wins (server timestamp determines winner)
  - Future: May implement more sophisticated conflict resolution

* **Metadata & Audit:**
  - created_at and updated_at timestamps automatically managed by database
  - No audit log in MVP (no tracking of who changed what when)
  - Future: May add audit trail for debugging and accountability

---

## 8. Security and Access Control

### Authentication Model

Trace uses **Supabase Auth** for all authentication, providing:

* **Email/Password Authentication:**
  - Users sign up with email and password
  - Passwords hashed with bcrypt and salted (handled by Supabase)
  - Password requirements: Minimum 8 characters (Supabase default)
  - Email verification required before account activation
  - Password reset via email token flow

* **Session Management:**
  - JWT tokens issued by Supabase on successful login
  - Access tokens expire after 1 hour (Supabase default)
  - Refresh tokens allow automatic re-authentication
  - Sessions persist across app restarts via secure token storage
  - Manual logout clears all tokens and cached data

* **Credential Storage:**
  - Passwords NEVER stored in plain text (Supabase handles hashing)
  - JWTs stored in secure storage: Keychain (iOS), Keystore (Android), httpOnly cookies (Web)
  - No authentication data stored in local database
  - All auth operations go through Supabase Auth APIs

### Authorization Model

Trace has **no role-based access control** - it's a personal productivity app where users manage only their own data.

* **Single User Role:**
  - All users have identical permissions
  - Users can create, read, update, and delete (CRUD) their own entries and categories
  - Users CANNOT access data belonging to other users
  - No admin role, no sharing features in MVP

* **Data Isolation via Row-Level Security (RLS):**
  - All database tables have RLS policies enabled
  - Policies automatically filter queries by authenticated user_id
  - Users can only SELECT/INSERT/UPDATE/DELETE rows where user_id = auth.uid()
  - Database enforces isolation - even if app has bugs, users cannot access others' data
  - RLS policies defined in Supabase migrations

### Database Security

* **Row-Level Security Policies:**
  ```
  -- Entries table RLS policy
  CREATE POLICY "Users can only access their own entries"
  ON entries
  FOR ALL
  USING (user_id = auth.uid());

  -- Categories table RLS policy
  CREATE POLICY "Users can only access their own categories"
  ON categories
  FOR ALL
  USING (user_id = auth.uid());
  ```

* **SQL Injection Prevention:**
  - Supabase client uses parameterized queries (prevents SQL injection)
  - No raw SQL strings constructed from user input
  - All queries use Supabase query builder or prepared statements

* **Data Validation:**
  - Database constraints enforce required fields (user_id, created_at cannot be null)
  - Foreign key constraints prevent orphaned records
  - Check constraints validate enum values (status must be 'none', 'incomplete', or 'complete')
  - Application layer validates data before sending to database

### Data Security & Privacy

* **Encryption:**
  - Data in transit: HTTPS/TLS for all API requests to Supabase
  - Data at rest: Supabase PostgreSQL database encrypted at rest (provider-level)
  - Local data: Device OS handles encryption (iOS encrypts by default, Android requires device encryption)
  - End-to-end encryption NOT implemented in MVP (all data readable by Supabase)

* **Privacy:**
  - No analytics or tracking in MVP
  - No data sharing with third parties
  - User data only stored in: Supabase database (production data), user's device (React Query cache)
  - Location data (GPS coordinates) is OPTIONAL - users can disable location capture
  - No server-side logs of entry content (only infrastructure logs for debugging)

* **Data Retention:**
  - User data retained while account is active
  - Account deletion permanently removes all user data (entries, categories)
  - No backup retention after deletion in MVP
  - No data anonymization - complete deletion on account removal

### Key Security Rules

* **Authentication Required:**
  - Users MUST be authenticated to access any part of the app (no guest mode)
  - Unauthenticated requests to Supabase API are automatically rejected
  - App redirects to login screen if session expires
  - Deep links to entries require active authentication session

* **User Isolation Enforcement:**
  - Every database operation includes user_id filter (enforced by RLS)
  - Frontend NEVER receives data from other users
  - API requests automatically scoped to authenticated user via JWT
  - No API endpoints accept user_id as parameter (always derived from JWT)

* **Input Validation & Sanitization:**
  - Rich text content sanitized to prevent XSS attacks
  - HTML tags limited to safe subset (bold, italic, lists only - no script tags)
  - Category and tag names validated for safe characters (no SQL metacharacters)
  - File uploads (future) will validate file types and scan for malware

* **Rate Limiting & Abuse Prevention:**
  - Supabase provides built-in rate limiting on API requests
  - MVP targets small user base (1,000 users) - no additional rate limiting needed
  - Future: May implement client-side rate limiting to prevent accidental API hammering

* **Session Security:**
  - Sessions timeout after 1 hour of inactivity (access token expiration)
  - Refresh tokens allow seamless re-authentication without re-login
  - Logout completely clears session and local cache
  - No "remember me" checkbox - refresh tokens handle persistent sessions securely

* **Security Monitoring (Future):**
  - MVP has no intrusion detection or security monitoring
  - Supabase provides basic infrastructure logs
  - Future: May add failed login attempt tracking and account lockout
  - Future: May add alerts for suspicious activity (multiple devices, unusual locations)

---

## 9. Appendices

### Appendix A: Data Models

#### Unified Entry Model
Trace uses a single, flexible entry model where attributes determine behavior. All entries are the same base type, and adding attributes transforms them into notes, tasks, or events.

**IMPORTANT: Categories vs. Tags**
Trace uses TWO organization systems that serve different purposes:
- **Category** (singular): Structured, hierarchical, user-defined (like folders). Where the entry "lives". ONE per entry.
- **Tags** (multiple): Freeform, ad-hoc, inline discovery keywords. How you "find" entries. MANY per entry.

* **Entry Entity**
    * **entry_id:** (Primary Key, GUID)
    * **user_id:** (Foreign Key to User, who created this entry)
    * **title:** (String, optional, plain text, displays prominently like H1 when viewing entry)
    * **content:** (HTML/Rich Text, the actual captured content with WYSIWYG formatting - supports bold, italic, bullets with nesting, numbered lists)
    * **category_id:** (Foreign Key to Category, optional - null means entry is in Inbox)
    * **tags:** (Array of strings, freeform tags like ["spaghetti", "favorite", "quick"] - extracted from inline #tags)
    * **mentions:** (Array of strings, @person references like ["@Janet", "@Emma"])
    * **created_at:** (Timestamp, automatically captured when entry is created)
    * **updated_at:** (Timestamp, automatically updated when entry is modified)
    * **location_lat:** (Float, optional GPS latitude where entry was captured)
    * **location_lng:** (Float, optional GPS longitude where entry was captured)
    * **location_name:** (String, optional human-readable location like "Starbucks on Main St")
    * **status:** (Enum: "none" | "incomplete" | "complete", defaults to "none")
    * **due_date:** (Timestamp, optional, null by default)
    * **completed_at:** (Timestamp, optional, set when status changes to "complete")
    * **attachments:** (Array of file references, optional - for photos, voice notes, etc.)

**Content Formatting Rules:**
- Content is stored as HTML to preserve rich text formatting
- WYSIWYG editor provides formatting toolbar (no markdown syntax needed)
- Supported formatting:
  - **Bold** and *Italic* text
  - Bullet lists with nested/indented sub-bullets (up to 3 levels)
  - Numbered lists with nested sub-items
  - Auto-continue lists: pressing Enter in a list creates next item automatically
  - Press Enter twice to exit list mode
- Title is optional but recommended for longer entries
- Title is plain text (no formatting) and displays prominently
- Tags (#tag) and mentions (@person) are extracted from content but preserved in original text

#### How Attributes Define Behavior

* **Note (default capture):**
    * status = "none"
    * due_date = null
    * Example: "Great product idea - auto-save forms #important"
    * Category: Work/Product/Features (selected from dropdown)
    * Tags: ["important"] (extracted from inline #important)

* **Task (actionable item):**
    * status = "incomplete" or "complete"
    * due_date = null or set
    * Example: "Get custom order report for @Tina #urgent"
    * Category: Work/Reports
    * Tags: ["urgent"]
    * Status: incomplete, due_date: Friday

* **Event/Appointment (time-bound occurrence):**
    * status = "none"
    * due_date = set
    * Example: "Standup meeting @team"
    * Category: Work/Meetings
    * Tags: [] (none)
    * due_date: Monday 9am

* **Completed Task:**
    * status = "complete"
    * completed_at = timestamp when marked complete
    * Example: Previous task marked complete on Friday

#### Categories vs. Tags Examples

**Example 1: Recipe Entry with Title and Nested Bullets**
```
Title: "Nonna's Spaghetti Carbonara"
Content: (HTML/rich text)
  "Amazing recipe from Nonna - **must try** #favorite #quick

  Ingredients:
  • Spaghetti
  • Eggs
  • Pancetta
    • Can substitute with bacon
    • Cut into small pieces
  • Parmesan cheese

  Notes: Takes only 20 minutes!"

Category: Recipes/Italian/Pasta (hierarchical, selected from dropdown)
Tags: ["favorite", "quick"] (extracted from inline #tags)
```

**Example 2: Workout Entry**
```
Title: "Deadlift PR Day"
Content: (HTML/rich text)
  "295x5 felt **strong** today #pr

  • Warmup sets went well
  • Form was solid
    • Kept back straight
    • Good lockout
  • Ready to try 300 next week"

Category: Exercise/Strength/Deadlift (hierarchical structure)
Tags: ["pr"] (personal record - freeform tag)
```

**Example 3: Work Task with Nested Action Items**
```
Title: "Q4 Budget Review"
Content: (HTML/rich text)
  "Review Q4 budget proposal before Friday meeting @Sarah #urgent #finance

  Action items:
  1. Review revenue projections
     • Compare to Q3 actuals
     • Check assumptions
  2. Analyze cost centers
  3. Prepare questions for @Sarah"

Category: Work/Tasks (structured location)
Tags: ["urgent", "finance"] (discovery keywords)
Status: incomplete
Due Date: Friday
```

**Example 4: Meeting Notes**
```
Title: "Product Roadmap Planning"
Content: (HTML/rich text)
  "Met with @Janet and @Mike to discuss Q1 priorities

  Key decisions:
  • Launch auto-save feature in January
    • @Mike owns backend
    • @Janet owns frontend
  • Push analytics to February
  • New design system
    • Research phase in Dec
    • Implementation in Jan

  **Action**: Schedule follow-up for next week #followup"

Category: Work/Meetings/Product
Tags: ["followup"]
Mentions: ["@Janet", "@Mike"]
```

#### Entry Evolution
Entries can transform over time:
1. Captured with no category (goes to Inbox) and optional inline #tags
2. During inbox review, assign category (select from dropdown)
3. Add status=incomplete → becomes task
4. Add due_date → task now has deadline
5. Mark status=complete → completed task, shows in history

#### Supporting Entities

* **User Entity**
    * **user_id:** (Primary Key, GUID)
    * **email:** (String, 255, Unique Index)
    * **password_hash:** (String, hashed and salted)
    * **created_at:** (Timestamp)
    * **sync_enabled:** (Boolean, whether user has enabled cross-device sync)
    * **encryption_key:** (String, for end-to-end encryption of synced data)

* **Category Entity** (for hierarchical organization structure)
    * **category_id:** (Primary Key, GUID)
    * **user_id:** (Foreign Key to User - categories are per-user)
    * **name:** (String, name of this category level, e.g., "Deadlift")
    * **full_path:** (String, complete hierarchy path like "Exercise/Strength/Deadlift")
    * **parent_category_id:** (Foreign Key to Category, null for root categories)
    * **depth:** (Integer, 0 for root, 1 for first level, etc.)
    * **entry_count:** (Integer, number of entries in this category)
    * **created_at:** (Timestamp)
    * **color:** (String, optional user-assigned color for visual organization)
    * **icon:** (String, optional icon/emoji for category)

**Category Hierarchy Rules:**
- Categories are user-defined and created on-demand
- Maximum depth: 5 levels (e.g., Work/Projects/ClientA/Phase2/Tasks)
- Category paths must be unique per user
- Deleting a category with entries requires reassignment or moves entries to parent category
- Root categories (depth=0) form the top-level organization

