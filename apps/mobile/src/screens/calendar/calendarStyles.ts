import { StyleSheet } from "react-native";
import { FAB_CLEARANCE } from "../../components/layout/BottomNavBar";

/** Styles shared across DayView, MonthView, and YearView */
export const sharedStyles = StyleSheet.create({
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 16 + FAB_CLEARANCE,
  },
  calendarContainer: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  navButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  navButtonText: {
    fontSize: 28,
  },
  countBadge: {
    position: "absolute",
    bottom: 2,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  countText: {
    fontSize: 10,
    color: "#ffffff",
  },
  entryItemWrapper: {
    marginBottom: 8,
  },
  emptyContainer: {
    padding: 24,
    borderRadius: 8,
  },
  emptyText: {
    fontSize: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginTop: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  sectionCount: {
    fontSize: 13,
    fontWeight: "500",
  },
});
