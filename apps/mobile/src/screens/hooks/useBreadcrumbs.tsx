/**
 * useBreadcrumbs - Builds breadcrumb segments from stream selection
 * Extracts breadcrumb logic from EntryListScreen
 */

import { useMemo } from 'react';
import Svg, { Path, Circle } from 'react-native-svg';
import type { Stream } from '@trace/core';
import type { BreadcrumbSegment } from '../../components/layout/Breadcrumb';

interface UseBreadcrumbsOptions {
  selectedStreamId: string | null;
  selectedStreamName: string;
  streams: Stream[];
  iconColor: string;
}

export function useBreadcrumbs({
  selectedStreamId,
  selectedStreamName,
  streams,
  iconColor,
}: UseBreadcrumbsOptions): BreadcrumbSegment[] {
  return useMemo((): BreadcrumbSegment[] => {
    // If a stream is selected - show only stream name (no Home >)
    if (selectedStreamId && typeof selectedStreamId === 'string' &&
        !selectedStreamId.startsWith("tag:") &&
        !selectedStreamId.startsWith("mention:") &&
        !selectedStreamId.startsWith("location:") &&
        !selectedStreamId.startsWith("geo:") &&
        selectedStreamId !== "all") {
      const stream = streams.find(s => s.stream_id === selectedStreamId);
      if (stream) {
        return [{ id: stream.stream_id, label: stream.name }];
      }
    }

    if (selectedStreamId === "all") {
      return [{ id: "all", label: "All Entries" }];
    } else if (selectedStreamId === null) {
      return [{ id: null, label: "Unassigned" }];
    } else if (typeof selectedStreamId === 'string' && selectedStreamId.startsWith("tag:")) {
      const tag = selectedStreamId.substring(4);
      return [{ id: selectedStreamId, label: `#${tag}` }];
    } else if (typeof selectedStreamId === 'string' && selectedStreamId.startsWith("mention:")) {
      const mention = selectedStreamId.substring(8);
      return [{ id: selectedStreamId, label: `@${mention}` }];
    } else if (typeof selectedStreamId === 'string' && selectedStreamId.startsWith("location:")) {
      return [
        {
          id: selectedStreamId,
          label: selectedStreamName || "Location",
          icon: (
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth={2}>
              <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
              <Circle cx={12} cy={10} r={3} />
            </Svg>
          )
        }
      ];
    } else if (typeof selectedStreamId === 'string' && selectedStreamId.startsWith("geo:")) {
      return [
        {
          id: selectedStreamId,
          label: selectedStreamName || "Location",
          icon: (
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth={2}>
              <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
              <Circle cx={12} cy={10} r={3} />
            </Svg>
          )
        }
      ];
    }

    return [{ id: "all", label: "All Entries" }];
  }, [selectedStreamId, selectedStreamName, streams, iconColor]);
}
