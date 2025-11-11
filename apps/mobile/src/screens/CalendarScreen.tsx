import { useState, useMemo, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { useEntries } from "../modules/entries/mobileEntryHooks";
import { useNavigation } from "../shared/contexts/NavigationContext";
import { useNavigationMenu } from "../shared/hooks/useNavigationMenu";
import { TopBar } from "../components/layout/TopBar";
import { EntryList } from "../modules/entries/components/EntryList";
import { FloatingActionButton } from "../components/buttons/FloatingActionButton";

// Helper function to format date in YYYY-MM-DD format in local timezone
function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

interface CalendarScreenProps {
  returnDate?: string; // Date to select when returning from entry screen
  returnZoomLevel?: ZoomLevel; // Zoom level to return to
}

type ZoomLevel = "day" | "month" | "year";

export function CalendarScreen({ returnDate, returnZoomLevel }: CalendarScreenProps = {}) {
  const { navigate } = useNavigation();
  const { menuItems, userEmail, onProfilePress } = useNavigationMenu();
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>("day");
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    // Default to today
    const today = new Date();
    return formatDateKey(today);
  });

  // State for viewing month/year (separate from selected date)
  const [viewingMonth, setViewingMonth] = useState(() => new Date().getMonth());
  const [viewingYear, setViewingYear] = useState(() => new Date().getFullYear());

  // State for month view
  const [monthViewYear, setMonthViewYear] = useState(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  // State for year view
  const [viewingDecade, setViewingDecade] = useState(() => {
    const currentYear = new Date().getFullYear();
    return Math.floor(currentYear / 10) * 10;
  });
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  // When returning from entry screen, update selected date and viewing month/year
  useEffect(() => {
    if (returnDate) {
      const date = new Date(returnDate);
      const dateKey = formatDateKey(date);
      setSelectedDate(dateKey);
      setViewingMonth(date.getMonth());
      setViewingYear(date.getFullYear());
      setMonthViewYear(date.getFullYear());
      // Return to the zoom level we were on before navigating away
      if (returnZoomLevel) {
        setZoomLevel(returnZoomLevel);
      }
    }
  }, [returnDate, returnZoomLevel]);

  // Get all entries
  const { entries, isLoading } = useEntries({});

  // Calculate entry counts by date
  const entryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    entries.forEach(entry => {
      const date = new Date(entry.entry_date || entry.created_at);
      const dateKey = formatDateKey(date);
      counts[dateKey] = (counts[dateKey] || 0) + 1;
    });
    return counts;
  }, [entries]);

  // Calculate entry counts by month (YYYY-MM)
  const monthCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    entries.forEach(entry => {
      const date = new Date(entry.entry_date || entry.created_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      counts[monthKey] = (counts[monthKey] || 0) + 1;
    });
    return counts;
  }, [entries]);

  // Calculate entry counts by year
  const yearCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    entries.forEach(entry => {
      const date = new Date(entry.entry_date || entry.created_at);
      const year = date.getFullYear();
      counts[year] = (counts[year] || 0) + 1;
    });
    return counts;
  }, [entries]);

  // Filter entries for selected date
  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      const date = new Date(entry.entry_date || entry.created_at);
      const dateKey = formatDateKey(date);
      return dateKey === selectedDate;
    });
  }, [entries, selectedDate]);

  // Filter entries for selected year (always compute, use when needed)
  const filteredEntriesForYear = useMemo(() => {
    if (selectedYear === null) return [];
    return entries.filter(entry => {
      const date = new Date(entry.entry_date || entry.created_at);
      return date.getFullYear() === selectedYear;
    });
  }, [entries, selectedYear]);

  // Filter entries for selected month (always compute, use when needed)
  const filteredEntriesForMonth = useMemo(() => {
    if (selectedMonth === null) return [];
    return entries.filter(entry => {
      const date = new Date(entry.entry_date || entry.created_at);
      return date.getFullYear() === monthViewYear && date.getMonth() === selectedMonth;
    });
  }, [entries, monthViewYear, selectedMonth]);

  const handleEntryPress = (entryId: string) => {
    navigate("capture", {
      entryId,
      returnContext: {
        screen: "calendar",
        selectedDate,
        zoomLevel
      }
    });
  };

  const handleTagPress = (tag: string) => {
    // Navigate to inbox with tag filter
    navigate("inbox", { returnCategoryId: `tag:${tag}`, returnCategoryName: `#${tag}` });
  };

  const handleMentionPress = (mention: string) => {
    // Navigate to inbox with mention filter
    navigate("inbox", { returnCategoryId: `mention:${mention}`, returnCategoryName: `@${mention}` });
  };

  const handlePrevMonth = () => {
    if (viewingMonth === 0) {
      setViewingMonth(11);
      setViewingYear(viewingYear - 1);
    } else {
      setViewingMonth(viewingMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewingMonth === 11) {
      setViewingMonth(0);
      setViewingYear(viewingYear + 1);
    } else {
      setViewingMonth(viewingMonth + 1);
    }
  };

  const handleToday = () => {
    const today = new Date();
    setViewingMonth(today.getMonth());
    setViewingYear(today.getFullYear());
    setSelectedDate(formatDateKey(today));
  };

  // Generate calendar for viewing month
  const today = new Date();
  const currentMonth = viewingMonth;
  const currentYear = viewingYear;

  const firstDay = new Date(currentYear, currentMonth, 1);
  const lastDay = new Date(currentYear, currentMonth + 1, 0);
  const startDayOfWeek = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const monthName = firstDay.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  // Build calendar grid with previous and next month days
  const calendar: Array<{ day: number; isCurrentMonth: boolean; date: Date }> = [];

  // Add days from previous month
  const prevMonthLastDay = new Date(currentYear, currentMonth, 0);
  const prevMonthDays = prevMonthLastDay.getDate();
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const day = prevMonthDays - i;
    const date = new Date(currentYear, currentMonth - 1, day);
    calendar.push({ day, isCurrentMonth: false, date });
  }

  // Add days from current month
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(currentYear, currentMonth, day);
    calendar.push({ day, isCurrentMonth: true, date });
  }

  // Add days from next month to complete the grid (always show 6 rows)
  const remainingCells = 42 - calendar.length; // 6 rows * 7 days
  for (let day = 1; day <= remainingCells; day++) {
    const date = new Date(currentYear, currentMonth + 1, day);
    calendar.push({ day, isCurrentMonth: false, date });
  }

  const renderDay = (dayInfo: { day: number; isCurrentMonth: boolean; date: Date }, index: number) => {
    const { day, isCurrentMonth, date } = dayInfo;
    const dateKey = formatDateKey(date);
    const count = entryCounts[dateKey] || 0;
    const isSelected = dateKey === selectedDate;
    const isToday = dateKey === formatDateKey(today);

    return (
      <TouchableOpacity
        key={dateKey}
        style={[
          styles.dayCell,
          isSelected && styles.dayCellSelected,
          isToday && !isSelected && styles.dayCellToday,
        ]}
        onPress={() => setSelectedDate(dateKey)}
      >
        <Text style={[
          styles.dayText,
          !isCurrentMonth && styles.dayTextOtherMonth,
          isSelected && styles.dayTextSelected,
          isToday && !isSelected && styles.dayTextToday,
        ]}>
          {day}
        </Text>
        {count > 0 && (
          <View style={[styles.countBadge, isSelected && styles.countBadgeSelected]}>
            <Text style={[styles.countText, isSelected && styles.countTextSelected]}>
              {count}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // Parse selectedDate (YYYY-MM-DD) in local timezone to avoid UTC conversion
  const [selYear, selMonth, selDay] = selectedDate.split('-').map(Number);
  const selectedDateObj = new Date(selYear, selMonth - 1, selDay);
  const formattedSelectedDate = selectedDateObj.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  // Render calendar header component
  const renderCalendarHeader = () => (
    <>
      {/* Calendar */}
      <View style={styles.calendarContainer}>
        {/* Month navigation */}
        <View style={styles.monthHeader}>
          <TouchableOpacity onPress={handlePrevMonth} style={styles.navButton}>
            <Text style={styles.navButtonText}>‹</Text>
          </TouchableOpacity>

          <Text style={styles.monthTitle}>{monthName}</Text>

          <TouchableOpacity onPress={handleNextMonth} style={styles.navButton}>
            <Text style={styles.navButtonText}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Today button */}
        <TouchableOpacity onPress={handleToday} style={styles.todayButton}>
          <Text style={styles.todayButtonText}>Today</Text>
        </TouchableOpacity>

        {/* Day headers */}
        <View style={styles.weekRow}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
            <View key={index} style={styles.dayHeaderCell}>
              <Text style={styles.dayHeaderText}>{day}</Text>
            </View>
          ))}
        </View>

        {/* Calendar grid */}
        <View style={styles.calendarGrid}>
          {Array.from({ length: Math.ceil(calendar.length / 7) }).map((_, weekIndex) => (
            <View key={weekIndex} style={styles.weekRow}>
              {calendar.slice(weekIndex * 7, weekIndex * 7 + 7).map((day, dayIndex) =>
                renderDay(day, weekIndex * 7 + dayIndex)
              )}
            </View>
          ))}
        </View>
      </View>

      {/* Selected date header */}
      <View style={styles.dateHeader}>
        <Text style={styles.dateHeaderText}>{formattedSelectedDate}</Text>
        <Text style={styles.dateHeaderCount}>
          {filteredEntries.length} {filteredEntries.length === 1 ? 'entry' : 'entries'}
        </Text>
      </View>
    </>
  );

  const handleAddEntry = () => {
    let dateToUse = selectedDate;

    // In month view, use first day of selected month
    if (zoomLevel === "month" && selectedMonth !== null) {
      const firstDay = new Date(monthViewYear, selectedMonth, 1);
      dateToUse = formatDateKey(firstDay);
    }

    // In year view, use Jan 1 of selected year
    if (zoomLevel === "year" && selectedYear !== null) {
      const firstDay = new Date(selectedYear, 0, 1);
      dateToUse = formatDateKey(firstDay);
    }

    navigate("capture", {
      initialDate: dateToUse,
      returnContext: {
        screen: "calendar",
        selectedDate: dateToUse,
        zoomLevel
      }
    });
  };

  // Render year view (decade view)
  const renderYearView = () => {
    const decadeStart = viewingDecade;
    const decadeEnd = viewingDecade + 9;
    const years = Array.from({ length: 10 }, (_, i) => decadeStart + i);

    const handlePrevDecade = () => {
      setViewingDecade(viewingDecade - 10);
      setSelectedYear(null);
    };

    const handleNextDecade = () => {
      setViewingDecade(viewingDecade + 10);
      setSelectedYear(null);
    };

    return (
      <View style={styles.content}>
        {/* Decade navigation */}
        <View style={styles.yearViewHeader}>
          <TouchableOpacity onPress={handlePrevDecade} style={styles.navButton}>
            <Text style={styles.navButtonText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.decadeTitle}>{decadeStart}-{decadeEnd}</Text>
          <TouchableOpacity onPress={handleNextDecade} style={styles.navButton}>
            <Text style={styles.navButtonText}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Years grid */}
        <View style={styles.yearsGrid}>
          {years.map(year => {
            const count = yearCounts[year] || 0;
            const isSelected = year === selectedYear;

            return (
              <TouchableOpacity
                key={year}
                style={[styles.yearCell, isSelected && styles.yearCellSelected]}
                onPress={() => {
                  if (isSelected) {
                    // Double-click behavior: go to month view
                    setMonthViewYear(year);
                    setSelectedMonth(null);
                    setZoomLevel("month");
                  } else {
                    setSelectedYear(year);
                  }
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.yearCellText, isSelected && styles.yearCellTextSelected]}>
                  {year}
                </Text>
                {count > 0 && (
                  <View style={[styles.countBadge, isSelected && styles.countBadgeSelected]}>
                    <Text style={[styles.countText, isSelected && styles.countTextSelected]}>
                      {count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Entries for selected year */}
        {selectedYear !== null && (
          <View style={styles.entriesSection}>
            <Text style={styles.entriesSectionTitle}>
              {selectedYear} • {filteredEntriesForYear.length} {filteredEntriesForYear.length === 1 ? 'entry' : 'entries'}
            </Text>
            <EntryList
              entries={filteredEntriesForYear}
              isLoading={false}
              onEntryPress={handleEntryPress}
              onTagPress={handleTagPress}
              onMentionPress={handleMentionPress}
            />
          </View>
        )}
      </View>
    );
  };

  // Render month view (year view)
  const renderMonthView = () => {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];

    const handlePrevYear = () => {
      setMonthViewYear(monthViewYear - 1);
      setSelectedMonth(null);
    };

    const handleNextYear = () => {
      setMonthViewYear(monthViewYear + 1);
      setSelectedMonth(null);
    };

    return (
      <View style={styles.content}>
        {/* Year navigation */}
        <View style={styles.monthViewHeader}>
          <TouchableOpacity onPress={handlePrevYear} style={styles.navButton}>
            <Text style={styles.navButtonText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.yearTitle}>{monthViewYear}</Text>
          <TouchableOpacity onPress={handleNextYear} style={styles.navButton}>
            <Text style={styles.navButtonText}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Months grid */}
        <View style={styles.monthsGrid}>
          {monthNames.map((monthName, monthIndex) => {
            const monthKey = `${monthViewYear}-${String(monthIndex + 1).padStart(2, '0')}`;
            const count = monthCounts[monthKey] || 0;
            const isSelected = monthIndex === selectedMonth;

            return (
              <TouchableOpacity
                key={monthIndex}
                style={[styles.monthCell, isSelected && styles.monthCellSelected]}
                onPress={() => {
                  if (isSelected) {
                    // Double-click behavior: go to day view
                    setViewingMonth(monthIndex);
                    setViewingYear(monthViewYear);
                    setZoomLevel("day");
                  } else {
                    setSelectedMonth(monthIndex);
                  }
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.monthCellText, isSelected && styles.monthCellTextSelected]}>
                  {monthName.substring(0, 3)}
                </Text>
                {count > 0 && (
                  <View style={[styles.countBadge, isSelected && styles.countBadgeSelected]}>
                    <Text style={[styles.countText, isSelected && styles.countTextSelected]}>
                      {count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Entries for selected month */}
        {selectedMonth !== null && (
          <View style={styles.entriesSection}>
            <Text style={styles.entriesSectionTitle}>
              {monthNames[selectedMonth]} {monthViewYear} • {filteredEntriesForMonth.length} {filteredEntriesForMonth.length === 1 ? 'entry' : 'entries'}
            </Text>
            <EntryList
              entries={filteredEntriesForMonth}
              isLoading={false}
              onEntryPress={handleEntryPress}
              onTagPress={handleTagPress}
              onMentionPress={handleMentionPress}
            />
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <TopBar
        title="Calendar"
        menuItems={menuItems}
        userEmail={userEmail}
        onProfilePress={onProfilePress}
      />

      {/* Zoom Level Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, zoomLevel === "day" && styles.tabActive]}
          onPress={() => setZoomLevel("day")}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, zoomLevel === "day" && styles.tabTextActive]}>
            Day
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, zoomLevel === "month" && styles.tabActive]}
          onPress={() => setZoomLevel("month")}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, zoomLevel === "month" && styles.tabTextActive]}>
            Month
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, zoomLevel === "year" && styles.tabActive]}
          onPress={() => setZoomLevel("year")}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, zoomLevel === "year" && styles.tabTextActive]}>
            Year
          </Text>
        </TouchableOpacity>
      </View>

      {/* Render appropriate view based on zoom level */}
      {zoomLevel === "day" && (
        <EntryList
          entries={filteredEntries}
          isLoading={isLoading}
          onEntryPress={handleEntryPress}
          onTagPress={handleTagPress}
          onMentionPress={handleMentionPress}
          ListHeaderComponent={renderCalendarHeader}
        />
      )}

      {zoomLevel === "month" && renderMonthView()}

      {zoomLevel === "year" && renderYearView()}

      <FloatingActionButton onPress={handleAddEntry} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  calendarContainer: {
    backgroundColor: "#ffffff",
    padding: 16,
    marginBottom: 16,
  },
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  monthTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
    textAlign: "center",
  },
  navButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
  },
  navButtonText: {
    fontSize: 28,
    color: "#374151",
    fontWeight: "600",
  },
  todayButton: {
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: "#2563eb",
    borderRadius: 6,
    marginBottom: 16,
  },
  todayButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
  },
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  dayHeaderCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
  },
  dayHeaderText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
  },
  calendarGrid: {
    marginTop: 8,
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    margin: 2,
    borderRadius: 8,
    maxHeight: 50,
    paddingTop: 4,
  },
  dayCellToday: {
    backgroundColor: "#dbeafe",
  },
  dayCellSelected: {
    backgroundColor: "#2563eb",
  },
  dayText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#111827",
  },
  dayTextOtherMonth: {
    color: "#d1d5db",
  },
  dayTextToday: {
    color: "#2563eb",
    fontWeight: "600",
  },
  dayTextSelected: {
    color: "#ffffff",
    fontWeight: "600",
  },
  countBadge: {
    position: "absolute",
    bottom: 2,
    backgroundColor: "#2563eb",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  countBadgeSelected: {
    backgroundColor: "#ffffff",
  },
  countText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#ffffff",
  },
  countTextSelected: {
    color: "#2563eb",
  },
  dateHeader: {
    backgroundColor: "#ffffff",
    padding: 16,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dateHeaderText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  dateHeaderCount: {
    fontSize: 14,
    color: "#6b7280",
  },
  // Tab styles
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#e5e7eb",
    borderRadius: 8,
    padding: 4,
    margin: 16,
    marginBottom: 0,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6b7280",
  },
  tabTextActive: {
    color: "#111827",
  },
  // List view styles
  content: {
    flex: 1,
    padding: 16,
  },
  yearSection: {
    marginBottom: 24,
  },
  yearSectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  yearItem: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  yearText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111827",
  },
  monthItem: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  monthText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#111827",
  },
  countBadgeList: {
    backgroundColor: "#2563eb",
    borderRadius: 12,
    minWidth: 32,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  countTextList: {
    fontSize: 12,
    fontWeight: "600",
    color: "#ffffff",
  },
  // Year view (decade) styles
  yearViewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  decadeTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
    textAlign: "center",
  },
  yearsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingHorizontal: 16,
  },
  yearCell: {
    width: "47%",
    aspectRatio: 2,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "flex-start",
    padding: 16,
    paddingTop: 12,
  },
  yearCellSelected: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  yearCellText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111827",
  },
  yearCellTextSelected: {
    color: "#ffffff",
  },
  // Month view (year) styles
  monthViewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  yearTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
    textAlign: "center",
  },
  monthsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingHorizontal: 16,
  },
  monthCell: {
    width: "30%",
    aspectRatio: 1.5,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "flex-start",
    padding: 12,
    paddingTop: 8,
  },
  monthCellSelected: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  monthCellText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  monthCellTextSelected: {
    color: "#ffffff",
  },
  // Entries section styles
  entriesSection: {
    marginTop: 24,
    flex: 1,
  },
  entriesSectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
});
