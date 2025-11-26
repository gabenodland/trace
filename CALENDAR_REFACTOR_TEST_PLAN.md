# CalendarScreen Refactoring - Test Plan

## Changes Made

### Problem Fixed
- **Issue**: "failure to insert view" and "addviewat: failed" errors when using FlatList with `stickyHeaderIndices`
- **Cause**: React Native can't properly reconcile when data array changes and stickyHeaderIndices points to non-existent items
- **Solution**: Completely replaced FlatList approach with ScrollView + fixed overlay header

### Architecture Changes

#### Before (FlatList with stickyHeaderIndices)
```typescript
<FlatList
  data={[
    { type: 'calendar' },
    { type: 'header' },
    ...entries.map(e => ({ type: 'entry', entry: e }))
  ]}
  stickyHeaderIndices={[1]}  // ❌ Causes view insertion errors
  renderItem={({ item }) => {
    if (item.type === 'calendar') return <Calendar />;
    if (item.type === 'header') return <Header />;
    return <EntryListItem entry={item.entry} />;
  }}
/>
```

#### After (ScrollView with fixed overlay)
```typescript
<ScrollView
  ref={scrollRef}
  onScroll={(e) => setScrollY(e.nativeEvent.contentOffset.y)}
  scrollEventThrottle={16}
>
  {/* Calendar Grid with height measurement */}
  <View
    style={styles.calendarContainer}
    onLayout={(e) => setGridHeight(e.nativeEvent.layout.height)}
  >
    <Calendar />
  </View>

  {/* Entry List Header (scrolls normally) */}
  <View style={styles.sectionHeader}>
    <Text>Entries for {date}</Text>
  </View>

  {/* Entries mapped directly */}
  {filteredEntries.map(entry => (
    <EntryListItem key={entry.entry_id} entry={entry} />
  ))}
</ScrollView>

{/* Fixed Overlay Header (appears when scrolled past grid) */}
{isScrolledPastGrid && (
  <View style={styles.fixedOverlayHeader}>
    <Text>Entries for {date}</Text>
    <TouchableOpacity
      onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
    >
      <Ionicons name="arrow-up" />
    </TouchableOpacity>
  </View>
)}
```

### Key Implementation Details

1. **State Management**:
   - `dayScrollY`, `monthScrollY`, `yearScrollY` - Track scroll position for each view
   - `dayGridHeight`, `monthGridHeight`, `yearGridHeight` - Track calendar grid heights
   - Overlay appears when: `scrollY > gridHeight - 50`

2. **Scroll-to-Top**:
   - Direct ref calls: `scrollRef.current?.scrollTo({ y: 0, animated: true })`
   - No callback closures - avoids stale state issues

3. **Performance**:
   - `scrollEventThrottle={16}` - Updates at 60fps
   - `onLayout` - Measures grid height only once (or when layout changes)

4. **Consistency**:
   - Same pattern applied to all three views (day, month, year)
   - Reduced code duplication

### Files Modified
- [CalendarScreen.tsx](apps/mobile/src/screens/CalendarScreen.tsx) - Reduced from ~1150 lines to ~950 lines

---

## Manual Test Plan

### Setup
1. ✅ Android emulator running (Medium_Phone_API_36.1)
2. ✅ Expo dev server started
3. ✅ Type check passed (no TypeScript errors)
4. ✅ App installed and launched

### Test Cases

#### Test 1: Day View - Basic Scrolling
- [ ] Open Calendar screen (day view by default)
- [ ] Verify calendar grid displays correctly
- [ ] Scroll down slowly
- [ ] Verify entry list header scrolls off screen
- [ ] Continue scrolling past grid
- [ ] **Expected**: Fixed overlay header appears at top with "Entries for [date]" and up arrow

#### Test 2: Day View - Scroll to Top
- [ ] With overlay header visible (scrolled down)
- [ ] Tap the up arrow icon in overlay header
- [ ] **Expected**: Smoothly scrolls back to top, showing calendar grid
- [ ] **Expected**: Overlay header disappears when back at top

#### Test 3: Day View - View Insertion Errors
- [ ] Select different dates by tapping calendar
- [ ] Switch between dates with different numbers of entries
- [ ] Scroll up and down multiple times
- [ ] **Expected**: NO "failure to insert view" or "addviewat: failed" errors in logs

#### Test 4: Month View - Basic Scrolling
- [ ] Tap "Month" tab
- [ ] Verify month calendar grid displays
- [ ] Scroll down through entries
- [ ] **Expected**: Fixed overlay header appears when scrolled past grid
- [ ] **Expected**: Shows "Entries for [month]"

#### Test 5: Month View - Scroll to Top
- [ ] With overlay visible
- [ ] Tap up arrow
- [ ] **Expected**: Scrolls to top, shows full month grid

#### Test 6: Month View - Month Navigation
- [ ] Use left/right arrows to change months
- [ ] Verify entries update for new month
- [ ] Scroll up and down
- [ ] **Expected**: No view insertion errors

#### Test 7: Year View - Basic Scrolling
- [ ] Tap "Year" tab
- [ ] Verify year grid displays (12 mini months)
- [ ] Scroll down through entries
- [ ] **Expected**: Fixed overlay appears showing "Entries for [year]"

#### Test 8: Year View - Scroll to Top
- [ ] With overlay visible
- [ ] Tap up arrow
- [ ] **Expected**: Scrolls to top, shows full year grid

#### Test 9: Year View - Year Navigation
- [ ] Use left/right arrows to change years
- [ ] Verify entries update for new year
- [ ] Scroll up and down
- [ ] **Expected**: No view insertion errors

#### Test 10: Switching Between Views
- [ ] Start in day view, scroll to bottom
- [ ] Switch to month view
- [ ] **Expected**: Resets to top of month view
- [ ] Switch to year view
- [ ] **Expected**: Resets to top of year view
- [ ] Switch back to day view
- [ ] **Expected**: Resets to top of day view

#### Test 11: Edge Cases
- [ ] Test with date that has 0 entries
- [ ] **Expected**: Calendar shows, entry section says "No entries found"
- [ ] Test with date that has 50+ entries
- [ ] **Expected**: Long list scrolls smoothly, overlay appears
- [ ] Test rapid scrolling up and down
- [ ] **Expected**: Overlay appears/disappears smoothly, no flicker

---

## Success Criteria

### Must Pass ✅
1. No "failure to insert view" errors
2. No "addviewat: failed" errors
3. Scroll-to-top works in all three views
4. Overlay header appears/disappears correctly based on scroll position
5. Switching between day/month/year views works without errors

### Performance Goals 🎯
1. Scrolling is smooth (60fps)
2. No layout jank when switching views
3. Overlay header transitions smoothly

### Known Limitations ⚠️
1. Overlay header is not "sticky" in the traditional sense - it's a fixed positioned element that appears/disappears
2. If calendar grid height changes (e.g., orientation change), `onLayout` will recalculate

---

## Logging Notes

The app currently has 298 console.log statements. After testing, we should implement the logging strategy:
- Replace debug noise with `logger.debug()` (auto-removed in production)
- Keep critical errors as `logger.error()` (sent to Sentry in production)
- Add user analytics as `logger.info()` (sent to analytics service)

See [LOGGING_STRATEGY.md](LOGGING_STRATEGY.md) for details.

---

## Next Steps After Testing

1. If tests pass: Mark CalendarScreen refactor as complete
2. If errors found: Debug and fix specific issues
3. Clean up any remaining console.logs in CalendarScreen
4. Consider applying same pattern to other screens with similar issues
