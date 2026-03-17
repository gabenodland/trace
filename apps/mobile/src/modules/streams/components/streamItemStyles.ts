import { StyleSheet } from "react-native";

/** Shared styles for stream list items — used by StreamList and StreamPicker */
export const streamItemStyles = StyleSheet.create({
  itemContainer: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    // borderBottomColor applied inline
  },
  itemContainerSelected: {
    // backgroundColor applied inline
  },
  itemContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  itemName: {
    fontSize: 16,
    flex: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    // backgroundColor applied inline
  },
  badgeText: {
    fontSize: 12,
  },
});
