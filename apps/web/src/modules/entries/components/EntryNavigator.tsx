/**
 * EntryNavigator - Left sidebar for filtering entries
 * Based on mobile's EntryNavigator with 4 tabs: Streams, Locations, Tags, Mentions
 */
import { useState, useMemo } from "react";
import type { Stream, Entry } from "@trace/core";
import { aggregateTags, aggregateMentions, aggregateLocations } from "@trace/core";

type SegmentType = "streams" | "locations" | "tags" | "mentions";

// Selected filter can be stream_id, tag:name, mention:name, location:id, or "all"
export type SelectedFilter = string | null | "all";

interface EntryNavigatorProps {
  streams: Stream[];
  entries: Entry[];
  selectedFilter: SelectedFilter;
  onSelect: (filter: SelectedFilter, displayName: string) => void;
  allEntriesCount: number;
  noStreamCount: number;
  locationMap?: Record<string, string>; // location_id -> name
}

export function EntryNavigator({
  streams,
  entries,
  selectedFilter,
  onSelect,
  allEntriesCount,
  noStreamCount,
  locationMap,
}: EntryNavigatorProps) {
  const [selectedSegment, setSelectedSegment] = useState<SegmentType>(() => {
    // Determine initial tab based on selectedFilter
    if (typeof selectedFilter === "string") {
      if (selectedFilter.startsWith("tag:")) return "tags";
      if (selectedFilter.startsWith("mention:")) return "mentions";
      if (selectedFilter.startsWith("location:")) return "locations";
    }
    return "streams";
  });
  const [searchQuery, setSearchQuery] = useState("");

  // Aggregate tags from entries
  const tags = useMemo(() => aggregateTags(entries), [entries]);

  // Aggregate mentions from entries
  const mentions = useMemo(() => aggregateMentions(entries), [entries]);

  // Aggregate locations from entries
  const locations = useMemo(() => aggregateLocations(entries), [entries]);

  // Get entry counts per stream
  const streamEntryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const entry of entries) {
      if (entry.stream_id) {
        counts[entry.stream_id] = (counts[entry.stream_id] || 0) + 1;
      }
    }
    return counts;
  }, [entries]);

  // Filter streams by search
  const filteredStreams = useMemo(() => {
    if (!searchQuery) return streams;
    const query = searchQuery.toLowerCase();
    return streams.filter((s) => s.name.toLowerCase().includes(query));
  }, [streams, searchQuery]);

  // Filter tags by search
  const filteredTags = useMemo(() => {
    if (!searchQuery) return tags;
    const query = searchQuery.toLowerCase().replace(/^#/, "");
    return tags.filter((t) => t.tag.toLowerCase().includes(query));
  }, [tags, searchQuery]);

  // Filter mentions by search
  const filteredMentions = useMemo(() => {
    if (!searchQuery) return mentions;
    const query = searchQuery.toLowerCase().replace(/^@/, "");
    return mentions.filter((m) => m.mention.toLowerCase().includes(query));
  }, [mentions, searchQuery]);

  // Filter locations by search (using location names from locationMap)
  const filteredLocations = useMemo(() => {
    if (!searchQuery) return locations;
    const query = searchQuery.toLowerCase();
    return locations.filter((l) => {
      const name = locationMap?.[l.location_id] || l.location_id;
      return name.toLowerCase().includes(query);
    });
  }, [locations, searchQuery, locationMap]);

  const handleSelect = (filter: SelectedFilter, displayName: string) => {
    onSelect(filter, displayName);
  };

  return (
    <div className="h-full flex flex-col border-r border-gray-200 bg-white">
      {/* Search */}
      <div className="p-3 border-b border-gray-200">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Tab Bar - hide when searching */}
      {!searchQuery && (
        <div className="flex border-b border-gray-200">
          {(["streams", "locations", "tags", "mentions"] as const).map((segment) => (
            <button
              key={segment}
              onClick={() => setSelectedSegment(segment)}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                selectedSegment === segment
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {segment === "streams" && "Stream"}
              {segment === "locations" && "Loc"}
              {segment === "tags" && "Tag"}
              {segment === "mentions" && "@"}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {!searchQuery ? (
          <>
            {/* Streams View */}
            {selectedSegment === "streams" && (
              <div className="py-2">
                {/* All Entries */}
                <NavItem
                  icon={
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M22 12h-6l-2 3h-4l-2-3H2" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
                    </svg>
                  }
                  label="All Entries"
                  count={allEntriesCount}
                  selected={selectedFilter === "all"}
                  onClick={() => handleSelect("all", "All Entries")}
                />

                {/* Unassigned */}
                <NavItem
                  icon={
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeDasharray="3 2">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 2L2 7l10 5 10-5-10-5z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2 17l10 5 10-5" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2 12l10 5 10-5" />
                    </svg>
                  }
                  label="Unassigned"
                  count={noStreamCount}
                  selected={selectedFilter === null}
                  onClick={() => handleSelect(null, "Unassigned")}
                />

                {/* Streams List */}
                {filteredStreams.map((stream) => (
                  <NavItem
                    key={stream.stream_id}
                    icon={
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2L2 7l10 5 10-5-10-5z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2 17l10 5 10-5" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2 12l10 5 10-5" />
                      </svg>
                    }
                    label={stream.name}
                    count={streamEntryCounts[stream.stream_id] || 0}
                    selected={selectedFilter === stream.stream_id}
                    onClick={() => handleSelect(stream.stream_id, stream.name)}
                  />
                ))}
              </div>
            )}

            {/* Locations View */}
            {selectedSegment === "locations" && (
              <div className="py-2">
                {filteredLocations.length > 0 ? (
                  filteredLocations.map((loc) => (
                    <NavItem
                      key={loc.location_id}
                      icon={
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                          <circle cx={12} cy={10} r={3} />
                        </svg>
                      }
                      label={locationMap?.[loc.location_id] || loc.location_id.slice(0, 8) + "..."}
                      count={loc.count}
                      selected={selectedFilter === `location:${loc.location_id}`}
                      onClick={() => handleSelect(`location:${loc.location_id}`, locationMap?.[loc.location_id] || loc.location_id.slice(0, 8) + "...")}
                    />
                  ))
                ) : (
                  <EmptyState message="No locations yet" subtext="Locations appear when you add them to entries" />
                )}
              </div>
            )}

            {/* Tags View */}
            {selectedSegment === "tags" && (
              <div className="py-2">
                {filteredTags.length > 0 ? (
                  filteredTags.map((t) => (
                    <NavItem
                      key={t.tag}
                      icon={
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18" />
                        </svg>
                      }
                      label={`#${t.tag}`}
                      count={t.count}
                      selected={selectedFilter === `tag:${t.tag}`}
                      onClick={() => handleSelect(`tag:${t.tag}`, `#${t.tag}`)}
                    />
                  ))
                ) : (
                  <EmptyState message="No tags yet" subtext="Tags appear when you use #hashtags in entries" />
                )}
              </div>
            )}

            {/* Mentions View */}
            {selectedSegment === "mentions" && (
              <div className="py-2">
                {filteredMentions.length > 0 ? (
                  filteredMentions.map((m) => (
                    <NavItem
                      key={m.mention}
                      icon={
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                        </svg>
                      }
                      label={`@${m.mention}`}
                      count={m.count}
                      selected={selectedFilter === `mention:${m.mention}`}
                      onClick={() => handleSelect(`mention:${m.mention}`, `@${m.mention}`)}
                    />
                  ))
                ) : (
                  <EmptyState message="No mentions yet" subtext="Mentions appear when you use @mentions in entries" />
                )}
              </div>
            )}
          </>
        ) : (
          // Global Search Results
          <div className="py-2">
            {/* Streams */}
            {filteredStreams.map((stream) => (
              <NavItem
                key={stream.stream_id}
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2 17l10 5 10-5" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2 12l10 5 10-5" />
                  </svg>
                }
                label={stream.name}
                count={streamEntryCounts[stream.stream_id] || 0}
                selected={selectedFilter === stream.stream_id}
                onClick={() => {
                  handleSelect(stream.stream_id, stream.name);
                  setSearchQuery("");
                }}
              />
            ))}

            {/* Tags */}
            {filteredTags.map((t) => (
              <NavItem
                key={`tag:${t.tag}`}
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18" />
                  </svg>
                }
                label={`#${t.tag}`}
                count={t.count}
                selected={selectedFilter === `tag:${t.tag}`}
                onClick={() => {
                  handleSelect(`tag:${t.tag}`, `#${t.tag}`);
                  setSearchQuery("");
                }}
              />
            ))}

            {/* Mentions */}
            {filteredMentions.map((m) => (
              <NavItem
                key={`mention:${m.mention}`}
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                  </svg>
                }
                label={`@${m.mention}`}
                count={m.count}
                selected={selectedFilter === `mention:${m.mention}`}
                onClick={() => {
                  handleSelect(`mention:${m.mention}`, `@${m.mention}`);
                  setSearchQuery("");
                }}
              />
            ))}

            {/* No Results */}
            {filteredStreams.length === 0 && filteredTags.length === 0 && filteredMentions.length === 0 && (
              <EmptyState message="No results" subtext="Try a different search term" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// NavItem component
interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  count?: number;
  selected?: boolean;
  onClick: () => void;
}

function NavItem({ icon, label, count, selected, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
        selected
          ? "bg-gray-100 text-gray-900 font-medium"
          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
      }`}
    >
      <span className={selected ? "text-gray-900" : "text-gray-400"}>{icon}</span>
      <span className="flex-1 truncate text-sm">{label}</span>
      {count !== undefined && count > 0 && (
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
          {count}
        </span>
      )}
    </button>
  );
}

// EmptyState component
function EmptyState({ message, subtext }: { message: string; subtext: string }) {
  return (
    <div className="px-4 py-8 text-center">
      <p className="text-sm font-medium text-gray-500">{message}</p>
      <p className="text-xs text-gray-400 mt-1">{subtext}</p>
    </div>
  );
}
