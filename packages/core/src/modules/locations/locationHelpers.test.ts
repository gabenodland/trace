import { describe, it, expect } from "vitest";
import {
  calculateDistance,
  formatDistance,
  parseMapboxHierarchy,
  extractMapboxCoordinates,
  getLocationLabel,
  hasLocationLabel,
  getStateAbbreviation,
  isSameLocation,
  isValidLatitude,
  isValidLongitude,
  isValidCoordinates,
  formatCoordinates,
  formatFullAddress,
  findNearbyLocation,
  analyzeLocationIssues,
  getPlaceIssueKey,
} from "./locationHelpers";
import type { PlaceForAnalysis, SavedLocationForAnalysis } from "./locationHelpers";
import type { Coordinates, LocationData, MapboxReverseGeocodeResponse } from "./LocationTypes";

describe("locationHelpers", () => {
  describe("getLocationLabel", () => {
    it("returns name when available", () => {
      expect(getLocationLabel({ name: "Starbucks", city: "Kansas City" })).toBe("Starbucks");
    });

    it("returns place_name when name not available", () => {
      expect(getLocationLabel({ place_name: "Coffee Shop", city: "NYC" })).toBe("Coffee Shop");
    });

    it("returns city when no name", () => {
      expect(getLocationLabel({ city: "Kansas City", region: "Missouri" })).toBe("Kansas City");
    });

    it("returns neighborhood when no name or city", () => {
      expect(getLocationLabel({ neighborhood: "Westport", region: "Missouri" })).toBe("Westport");
    });

    it("returns region when no name, city, or neighborhood", () => {
      expect(getLocationLabel({ region: "Missouri" })).toBe("Missouri");
    });

    it("returns country when only country available", () => {
      expect(getLocationLabel({ country: "United States" })).toBe("United States");
    });

    it("returns 'Unnamed Place' for empty object", () => {
      expect(getLocationLabel({})).toBe("Unnamed Place");
    });

    it("returns 'Unnamed Place' for null", () => {
      expect(getLocationLabel(null)).toBe("Unnamed Place");
    });

    it("returns 'Unnamed Place' for undefined", () => {
      expect(getLocationLabel(undefined)).toBe("Unnamed Place");
    });

    it("trims whitespace from values", () => {
      expect(getLocationLabel({ name: "  Starbucks  " })).toBe("Starbucks");
      expect(getLocationLabel({ city: "  Kansas City  " })).toBe("Kansas City");
    });

    it("skips empty strings", () => {
      expect(getLocationLabel({ name: "", city: "Kansas City" })).toBe("Kansas City");
      expect(getLocationLabel({ name: "   ", city: "NYC" })).toBe("NYC");
    });

    it("prefers name over place_name", () => {
      expect(getLocationLabel({ name: "Home", place_name: "123 Main St" })).toBe("Home");
    });
  });

  describe("hasLocationLabel", () => {
    it("returns true when name exists", () => {
      expect(hasLocationLabel({ name: "Starbucks" })).toBe(true);
    });

    it("returns true when city exists", () => {
      expect(hasLocationLabel({ city: "Kansas City" })).toBe(true);
    });

    it("returns true when region exists", () => {
      expect(hasLocationLabel({ region: "Missouri" })).toBe(true);
    });

    it("returns false for empty object", () => {
      expect(hasLocationLabel({})).toBe(false);
    });

    it("returns false for null", () => {
      expect(hasLocationLabel(null)).toBe(false);
    });

    it("returns false for whitespace-only values", () => {
      expect(hasLocationLabel({ name: "   " })).toBe(false);
    });
  });

  describe("getStateAbbreviation", () => {
    it("returns correct abbreviation for US states", () => {
      expect(getStateAbbreviation("Missouri")).toBe("MO");
      expect(getStateAbbreviation("California")).toBe("CA");
      expect(getStateAbbreviation("New York")).toBe("NY");
      expect(getStateAbbreviation("Texas")).toBe("TX");
    });

    it("returns correct abbreviation for states with similar names", () => {
      expect(getStateAbbreviation("Michigan")).toBe("MI");
      expect(getStateAbbreviation("Mississippi")).toBe("MS");
      expect(getStateAbbreviation("Minnesota")).toBe("MN");
    });

    it("returns correct abbreviation for Canadian provinces", () => {
      expect(getStateAbbreviation("Ontario")).toBe("ON");
      expect(getStateAbbreviation("British Columbia")).toBe("BC");
      expect(getStateAbbreviation("Quebec")).toBe("QC");
      expect(getStateAbbreviation("Québec")).toBe("QC");
      expect(getStateAbbreviation("Alberta")).toBe("AB");
      expect(getStateAbbreviation("Saskatchewan")).toBe("SK");
    });

    it("returns original value for non-US/CA regions", () => {
      expect(getStateAbbreviation("Bavaria")).toBe("Bavaria");
      expect(getStateAbbreviation("Île-de-France")).toBe("Île-de-France");
      expect(getStateAbbreviation("England")).toBe("England");
    });

    it("handles null and undefined", () => {
      expect(getStateAbbreviation(null)).toBe("");
      expect(getStateAbbreviation(undefined)).toBe("");
    });

    it("trims whitespace", () => {
      expect(getStateAbbreviation("  Missouri  ")).toBe("MO");
      expect(getStateAbbreviation("  California  ")).toBe("CA");
    });

    it("handles territories and DC", () => {
      expect(getStateAbbreviation("District of Columbia")).toBe("DC");
      expect(getStateAbbreviation("Puerto Rico")).toBe("PR");
    });
  });

  describe("calculateDistance", () => {
    it("calculates distance between two points", () => {
      // NYC to LA approximately 3,940 km
      const nyc: Coordinates = { latitude: 40.7128, longitude: -74.006 };
      const la: Coordinates = { latitude: 34.0522, longitude: -118.2437 };

      const result = calculateDistance(nyc, la);

      expect(result.kilometers).toBeGreaterThan(3900);
      expect(result.kilometers).toBeLessThan(4000);
      expect(result.meters).toBe(result.kilometers * 1000);
      expect(result.miles).toBeCloseTo(result.kilometers / 1.60934, 0);
    });

    it("returns 0 for same location", () => {
      const point: Coordinates = { latitude: 40.7128, longitude: -74.006 };
      const result = calculateDistance(point, point);

      expect(result.meters).toBe(0);
      expect(result.kilometers).toBe(0);
      expect(result.miles).toBe(0);
    });

    it("calculates short distances accurately", () => {
      // Two points ~1km apart
      const point1: Coordinates = { latitude: 40.7128, longitude: -74.006 };
      const point2: Coordinates = { latitude: 40.7218, longitude: -74.006 };

      const result = calculateDistance(point1, point2);

      expect(result.meters).toBeGreaterThan(900);
      expect(result.meters).toBeLessThan(1100);
    });
  });

  describe("formatDistance", () => {
    it("formats meters for short distances", () => {
      expect(formatDistance(500)).toBe("500m");
    });

    it("formats kilometers for long distances", () => {
      expect(formatDistance(5000)).toBe("5.0km");
    });

    it("rounds meters to whole numbers", () => {
      expect(formatDistance(123.7)).toBe("124m");
    });

    it("returns dash for negative distance", () => {
      expect(formatDistance(-100)).toBe("—");
    });

    it("returns dash for NaN", () => {
      expect(formatDistance(NaN)).toBe("—");
    });

    it("returns dash for non-number", () => {
      expect(formatDistance("abc" as unknown as number)).toBe("—");
    });

    it("formats zero meters", () => {
      expect(formatDistance(0)).toBe("0m");
    });
  });

  describe("parseMapboxHierarchy", () => {
    it("returns empty object for empty features", () => {
      const response: MapboxReverseGeocodeResponse = {
        type: "FeatureCollection",
        features: [],
        attribution: "",
      };

      expect(parseMapboxHierarchy(response)).toEqual({});
    });

    it("extracts POI from place_type", () => {
      const response: MapboxReverseGeocodeResponse = {
        type: "FeatureCollection",
        features: [
          {
            id: "poi.123",
            type: "Feature",
            place_type: ["poi"],
            text: "Coffee Shop",
            place_name: "Coffee Shop, 123 Main St",
            center: [-74.006, 40.7128],
            geometry: { type: "Point", coordinates: [-74.006, 40.7128] },
            properties: {},
          },
        ],
        attribution: "",
      };

      const hierarchy = parseMapboxHierarchy(response);
      expect(hierarchy.poi).toBe("Coffee Shop");
    });

    it("extracts address from place_type", () => {
      const response: MapboxReverseGeocodeResponse = {
        type: "FeatureCollection",
        features: [
          {
            id: "address.123",
            type: "Feature",
            place_type: ["address"],
            text: "123",
            place_name: "123 Main St, New York, NY",
            center: [-74.006, 40.7128],
            geometry: { type: "Point", coordinates: [-74.006, 40.7128] },
            properties: {},
          },
        ],
        attribution: "",
      };

      const hierarchy = parseMapboxHierarchy(response);
      expect(hierarchy.address).toBe("123 Main St");
    });

    it("extracts hierarchy from context", () => {
      const response: MapboxReverseGeocodeResponse = {
        type: "FeatureCollection",
        features: [
          {
            id: "address.123",
            type: "Feature",
            place_type: ["address"],
            text: "123",
            place_name: "123 Main St",
            center: [-74.006, 40.7128],
            geometry: { type: "Point", coordinates: [-74.006, 40.7128] },
            properties: {},
            context: [
              { id: "neighborhood.1", text: "Tribeca" },
              { id: "place.1", text: "New York" },
              { id: "region.1", text: "New York" },
              { id: "country.1", text: "United States" },
            ],
          },
        ],
        attribution: "",
      };

      const hierarchy = parseMapboxHierarchy(response);
      expect(hierarchy.neighborhood).toBe("Tribeca");
      expect(hierarchy.place).toBe("New York");
      expect(hierarchy.region).toBe("New York");
      expect(hierarchy.country).toBe("United States");
    });
  });

  describe("extractMapboxCoordinates", () => {
    it("extracts coordinates from feature center", () => {
      const feature = {
        id: "test",
        type: "Feature" as const,
        place_type: ["poi"],
        text: "Test",
        place_name: "Test Place",
        center: [-74.006, 40.7128] as [number, number],
        geometry: { type: "Point" as const, coordinates: [-74.006, 40.7128] as [number, number] },
        properties: {},
      };

      const coords = extractMapboxCoordinates(feature);
      expect(coords.latitude).toBe(40.7128);
      expect(coords.longitude).toBe(-74.006);
    });
  });

  describe("isSameLocation", () => {
    it("matches by Foursquare ID", () => {
      const loc1 = { foursquareFsqId: "fsq123" };
      const loc2 = { foursquareFsqId: "fsq123" };
      expect(isSameLocation(loc1, loc2)).toBe(true);
    });

    it("does not match different Foursquare IDs", () => {
      const loc1 = { foursquareFsqId: "fsq123" };
      const loc2 = { foursquareFsqId: "fsq456" };
      expect(isSameLocation(loc1, loc2)).toBe(false);
    });

    it("matches by Mapbox place ID", () => {
      const loc1 = { mapboxPlaceId: "mapbox123" };
      const loc2 = { mapboxPlaceId: "mapbox123" };
      expect(isSameLocation(loc1, loc2)).toBe(true);
    });

    it("matches by proximity and name", () => {
      const loc1 = {
        gpsLatitude: 40.7128,
        gpsLongitude: -74.006,
        nameOriginal: "Coffee Shop",
      };
      const loc2 = {
        gpsLatitude: 40.7129, // Very close
        gpsLongitude: -74.0061,
        nameOriginal: "Coffee Shop",
      };
      expect(isSameLocation(loc1, loc2)).toBe(true);
    });

    it("does not match distant locations with same name", () => {
      const loc1 = {
        gpsLatitude: 40.7128,
        gpsLongitude: -74.006,
        nameOriginal: "Coffee Shop",
      };
      const loc2 = {
        gpsLatitude: 34.0522, // LA
        gpsLongitude: -118.2437,
        nameOriginal: "Coffee Shop",
      };
      expect(isSameLocation(loc1, loc2)).toBe(false);
    });

    it("returns false when insufficient data", () => {
      const loc1 = { name: "Place" };
      const loc2 = { name: "Place" };
      expect(isSameLocation(loc1, loc2)).toBe(false);
    });
  });

  describe("isValidLatitude", () => {
    it("returns true for valid latitudes", () => {
      expect(isValidLatitude(0)).toBe(true);
      expect(isValidLatitude(45)).toBe(true);
      expect(isValidLatitude(-45)).toBe(true);
      expect(isValidLatitude(90)).toBe(true);
      expect(isValidLatitude(-90)).toBe(true);
    });

    it("returns false for invalid latitudes", () => {
      expect(isValidLatitude(91)).toBe(false);
      expect(isValidLatitude(-91)).toBe(false);
      expect(isValidLatitude(180)).toBe(false);
    });
  });

  describe("isValidLongitude", () => {
    it("returns true for valid longitudes", () => {
      expect(isValidLongitude(0)).toBe(true);
      expect(isValidLongitude(90)).toBe(true);
      expect(isValidLongitude(-90)).toBe(true);
      expect(isValidLongitude(180)).toBe(true);
      expect(isValidLongitude(-180)).toBe(true);
    });

    it("returns false for invalid longitudes", () => {
      expect(isValidLongitude(181)).toBe(false);
      expect(isValidLongitude(-181)).toBe(false);
    });
  });

  describe("isValidCoordinates", () => {
    it("returns true for valid coordinates", () => {
      expect(isValidCoordinates({ latitude: 40.7128, longitude: -74.006 })).toBe(true);
    });

    it("returns false for invalid latitude", () => {
      expect(isValidCoordinates({ latitude: 100, longitude: -74.006 })).toBe(false);
    });

    it("returns false for invalid longitude", () => {
      expect(isValidCoordinates({ latitude: 40.7128, longitude: 200 })).toBe(false);
    });
  });

  describe("formatCoordinates", () => {
    it("formats with default 6 decimals", () => {
      const coords: Coordinates = { latitude: 40.7128, longitude: -74.006 };
      expect(formatCoordinates(coords)).toBe("40.712800, -74.006000");
    });

    it("formats with custom decimals", () => {
      const coords: Coordinates = { latitude: 40.7128, longitude: -74.006 };
      expect(formatCoordinates(coords, 2)).toBe("40.71, -74.01");
    });
  });

  describe("formatFullAddress", () => {
    it("combines all address parts", () => {
      const location: LocationData = {
        name: "Coffee Shop",
        neighborhood: "Tribeca",
        city: "New York",
        region: "NY",
        country: "USA",
      };
      expect(formatFullAddress(location)).toBe("Coffee Shop, Tribeca, New York, NY, USA");
    });

    it("skips missing parts", () => {
      const location: LocationData = {
        name: "Coffee Shop",
        city: "New York",
      };
      expect(formatFullAddress(location)).toBe("Coffee Shop, New York");
    });

    it("returns empty string for empty location", () => {
      expect(formatFullAddress({})).toBe("");
    });
  });

  describe("findNearbyLocation", () => {
    // Helper to create a valid saved location with required fields
    const createLocation = (overrides: {
      location_id: string;
      name: string;
      latitude: number;
      longitude: number;
    }) => ({
      location_id: overrides.location_id,
      name: overrides.name,
      latitude: overrides.latitude,
      longitude: overrides.longitude,
      address: null,
      neighborhood: null,
      postal_code: null,
      city: null,
      subdivision: null,
      region: null,
      country: null,
    });

    const savedLocations = [
      createLocation({ location_id: "loc1", name: "Starbucks", latitude: 40.7128, longitude: -74.006 }),
      createLocation({ location_id: "loc2", name: "Home", latitude: 40.7500, longitude: -74.000 }),
      createLocation({ location_id: "loc3", name: "Office", latitude: 40.7600, longitude: -73.990 }),
    ];

    it("returns location: null when no locations provided", () => {
      const coords: Coordinates = { latitude: 40.7128, longitude: -74.006 };
      const result = findNearbyLocation(coords, []);
      expect(result.location).toBeNull();
    });

    it("snaps to nearby location within default threshold", () => {
      // ~10 meters away from Starbucks
      const coords: Coordinates = { latitude: 40.71281, longitude: -74.00601 };
      const result = findNearbyLocation(coords, savedLocations);

      expect(result.location).not.toBeNull();
      expect(result.location!.name).toBe("Starbucks");
      expect(result.distanceMeters).toBeLessThan(30);
    });

    it("returns location: null when outside default threshold", () => {
      // ~500 meters away from nearest location
      const coords: Coordinates = { latitude: 40.7180, longitude: -74.010 };
      const result = findNearbyLocation(coords, savedLocations);

      expect(result.location).toBeNull();
    });

    it("uses custom threshold when provided", () => {
      // ~500 meters away, but with 1000m threshold
      const coords: Coordinates = { latitude: 40.7180, longitude: -74.010 };
      const result = findNearbyLocation(coords, savedLocations, 1000);

      expect(result.location).not.toBeNull();
      expect(result.location!.name).toBe("Starbucks");
    });

    it("uses accuracy as threshold when accuracy > base threshold", () => {
      // ~100 meters away from Starbucks
      const coords: Coordinates = { latitude: 40.7138, longitude: -74.005 };

      // Without accuracy: 30m threshold - should NOT snap (100m > 30m)
      const resultNoAccuracy = findNearbyLocation(coords, savedLocations, 30);
      expect(resultNoAccuracy.location).toBeNull();

      // With 150m accuracy: effective threshold = 150m - should snap (100m < 150m)
      const resultWithAccuracy = findNearbyLocation(coords, savedLocations, 30, 150);
      expect(resultWithAccuracy.location).not.toBeNull();
      expect(resultWithAccuracy.location!.name).toBe("Starbucks");
    });

    it("uses base threshold when accuracy < base threshold", () => {
      // ~20 meters away from Starbucks
      const coords: Coordinates = { latitude: 40.71298, longitude: -74.00602 };

      // Base threshold 30m, accuracy 10m: effective threshold = 30m
      const result = findNearbyLocation(coords, savedLocations, 30, 10);
      expect(result.location).not.toBeNull();
      expect(result.location!.name).toBe("Starbucks");
    });

    it("ignores null accuracy", () => {
      // ~100 meters away from Starbucks
      const coords: Coordinates = { latitude: 40.7138, longitude: -74.005 };

      // Passing null accuracy should use base threshold only
      const result = findNearbyLocation(coords, savedLocations, 30, null);
      expect(result.location).toBeNull();
    });

    it("snaps to closest location when multiple are in range", () => {
      // Create locations close together
      const closeLocations = [
        createLocation({ location_id: "a", name: "Far Coffee", latitude: 40.7130, longitude: -74.006 }),
        createLocation({ location_id: "b", name: "Near Coffee", latitude: 40.71281, longitude: -74.00601 }),
      ];
      const coords: Coordinates = { latitude: 40.7128, longitude: -74.006 };

      const result = findNearbyLocation(coords, closeLocations, 50);
      expect(result.location).not.toBeNull();
      expect(result.location!.name).toBe("Near Coffee");
    });

    it("includes distanceMeters in result", () => {
      const coords: Coordinates = { latitude: 40.71281, longitude: -74.00601 };
      const result = findNearbyLocation(coords, savedLocations);

      expect(result.location).not.toBeNull();
      expect(typeof result.distanceMeters).toBe("number");
      expect(result.distanceMeters).toBeGreaterThanOrEqual(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // analyzeLocationIssues
  // ──────────────────────────────────────────────────────────────────────────

  describe("getPlaceIssueKey", () => {
    it("produces correct composite key", () => {
      expect(getPlaceIssueKey({
        place_name: "KFC", address: "123 Main St", city: "Austin", region: "Texas", country: "US",
      })).toBe("KFC|123 Main St|Austin|Texas|US");
    });

    it("handles nulls as empty strings", () => {
      expect(getPlaceIssueKey({
        place_name: null, address: null, city: "Austin", region: null, country: null,
      })).toBe("||Austin||");
    });
  });

  describe("analyzeLocationIssues", () => {
    const makeSavedLocation = (overrides: Partial<SavedLocationForAnalysis> = {}): SavedLocationForAnalysis => ({
      location_id: "loc-1",
      name: "KFC",
      latitude: 30.2672,
      longitude: -97.7431,
      address: "123 Main St",
      city: "Austin",
      region: "Texas",
      country: "US",
      ...overrides,
    });

    const makePlace = (overrides: Partial<PlaceForAnalysis> = {}): PlaceForAnalysis => ({
      place_name: "Coffee Shop",
      address: "456 Oak Ave",
      city: "Austin",
      region: "Texas",
      country: "US",
      avg_latitude: 30.5,
      avg_longitude: -97.5,
      is_favorite: false,
      location_id: null,
      ...overrides,
    });

    it("detects missing data on favorites", () => {
      const place = makePlace({ is_favorite: true, location_id: "loc-1", city: null, region: null });
      const result = analyzeLocationIssues([place], []);
      const key = getPlaceIssueKey(place);
      const issues = result.get(key);

      expect(issues).toBeDefined();
      expect(issues!.length).toBe(1);
      expect(issues![0].type).toBe("missing_data");
      expect(issues![0].message).toContain("city");
      expect(issues![0].message).toContain("region");
    });

    it("does NOT flag missing data when saved location has the fields filled in", () => {
      // Entry-derived data has null city/region, but the actual saved location has them
      const saved = makeSavedLocation({ location_id: "loc-1", city: "Austin", region: "Texas", country: "US" });
      const place = makePlace({ is_favorite: true, location_id: "loc-1", city: null, region: null });
      const result = analyzeLocationIssues([place], [saved]);
      const key = getPlaceIssueKey(place);
      const issues = result.get(key) || [];

      expect(issues.find(i => i.type === "missing_data")).toBeUndefined();
    });

    it("does NOT flag missing data on non-favorites", () => {
      const place = makePlace({ is_favorite: false, city: null, region: null });
      const result = analyzeLocationIssues([place], []);
      const key = getPlaceIssueKey(place);

      expect(result.has(key)).toBe(false);
    });

    it("detects snap candidate at exact same location (different names)", () => {
      // Same GPS point (< 10m) — flags even with different names
      const saved = makeSavedLocation({ latitude: 30.2672, longitude: -97.7431 });
      const place = makePlace({
        is_favorite: false,
        avg_latitude: 30.2672,
        avg_longitude: -97.7431,
      });
      const result = analyzeLocationIssues([place], [saved]);
      const key = getPlaceIssueKey(place);
      const issues = result.get(key);

      expect(issues).toBeDefined();
      const snapIssue = issues!.find(i => i.type === "snap_candidate");
      expect(snapIssue).toBeDefined();
      expect(snapIssue!.targetLocationName).toBe("KFC");
      expect(snapIssue!.targetLocationId).toBe("loc-1");
    });

    it("detects snap candidate within 50m when names match", () => {
      // ~40m apart but same name — should flag
      const saved = makeSavedLocation({ name: "Starbucks", latitude: 30.2672, longitude: -97.7431 });
      const place = makePlace({
        place_name: "Starbucks",
        is_favorite: false,
        avg_latitude: 30.26755,  // ~40m north
        avg_longitude: -97.7431,
      });
      const result = analyzeLocationIssues([place], [saved]);
      const key = getPlaceIssueKey(place);
      const issues = result.get(key);

      expect(issues).toBeDefined();
      expect(issues!.find(i => i.type === "snap_candidate")).toBeDefined();
    });

    it("does NOT flag snap within 30m when names differ", () => {
      // ~20m apart but different names — should NOT flag (different businesses nearby)
      const saved = makeSavedLocation({ name: "KFC", latitude: 30.2672, longitude: -97.7431 });
      const place = makePlace({
        place_name: "Subway",
        is_favorite: false,
        avg_latitude: 30.26738,  // ~20m north
        avg_longitude: -97.7431,
      });
      const result = analyzeLocationIssues([place], [saved]);
      const key = getPlaceIssueKey(place);
      const issues = result.get(key) || [];

      expect(issues.find(i => i.type === "snap_candidate")).toBeUndefined();
    });

    it("does NOT flag snap on favorites", () => {
      const saved = makeSavedLocation({ latitude: 30.2672, longitude: -97.7431 });
      const place = makePlace({
        is_favorite: true,
        location_id: "loc-2",
        avg_latitude: 30.2672,
        avg_longitude: -97.7431,
      });
      const result = analyzeLocationIssues([place], [saved]);
      const key = getPlaceIssueKey(place);
      const issues = result.get(key) || [];

      expect(issues.find(i => i.type === "snap_candidate")).toBeUndefined();
    });

    it("does NOT flag snap when distance is large", () => {
      const saved = makeSavedLocation({ latitude: 30.2672, longitude: -97.7431 });
      // Place far away
      const place = makePlace({
        is_favorite: false,
        avg_latitude: 31.0,
        avg_longitude: -97.0,
      });
      const result = analyzeLocationIssues([place], [saved]);
      const key = getPlaceIssueKey(place);

      expect(result.has(key)).toBe(false);
    });

    it("detects merge candidates with same normalized name+address", () => {
      const place1 = makePlace({ place_name: "Starbucks", address: "100 Main St", city: "Austin" });
      const place2 = makePlace({ place_name: "Starbucks", address: "100 Main St", city: "Dallas" });
      const result = analyzeLocationIssues([place1, place2], []);

      const issues1 = result.get(getPlaceIssueKey(place1));
      const issues2 = result.get(getPlaceIssueKey(place2));

      expect(issues1).toBeDefined();
      expect(issues1!.find(i => i.type === "merge_candidate")).toBeDefined();
      expect(issues2).toBeDefined();
      expect(issues2!.find(i => i.type === "merge_candidate")).toBeDefined();
    });

    it("merge detection is case-insensitive", () => {
      const place1 = makePlace({ place_name: "STARBUCKS", address: "100 main st", city: "Austin" });
      const place2 = makePlace({ place_name: "starbucks", address: "100 Main St", city: "Dallas" });
      const result = analyzeLocationIssues([place1, place2], []);

      expect(result.get(getPlaceIssueKey(place1))?.find(i => i.type === "merge_candidate")).toBeDefined();
    });

    it("merge_candidate includes mergeTargetLocationId when target is a saved location", () => {
      // Two saved places with same name+address but different cities (different getPlaceIssueKey)
      const place1 = makePlace({
        place_name: "Troost Coffee",
        address: "100 Main St",
        city: "Austin",
        is_favorite: true,
        location_id: "loc-A",
      });
      const place2 = makePlace({
        place_name: "Troost Coffee",
        address: "100 Main St",
        city: "Dallas",
        is_favorite: true,
        location_id: "loc-B",
      });
      const result = analyzeLocationIssues([place1, place2], []);

      const issues1 = result.get(getPlaceIssueKey(place1))!;
      const merge1 = issues1.find(i => i.type === "merge_candidate");
      expect(merge1).toBeDefined();
      expect(merge1!.mergeTargetLocationId).toBe("loc-B");

      const issues2 = result.get(getPlaceIssueKey(place2))!;
      const merge2 = issues2.find(i => i.type === "merge_candidate");
      expect(merge2).toBeDefined();
      expect(merge2!.mergeTargetLocationId).toBe("loc-A");
    });

    it("detects merge_candidate for favorites at same location with different names", () => {
      // Two saved places at same GPS point but different names
      const saved1 = makeSavedLocation({ location_id: "loc-A", name: "Troost Coffee", latitude: 30.2672, longitude: -97.7431 });
      const saved2 = makeSavedLocation({ location_id: "loc-B", name: "Troost Coffee Shop", latitude: 30.2672, longitude: -97.7431 });
      const place1 = makePlace({
        place_name: "Troost Coffee",
        address: "100 Main St",
        city: "Austin",
        is_favorite: true,
        location_id: "loc-A",
        avg_latitude: 30.2672,
        avg_longitude: -97.7431,
      });
      const place2 = makePlace({
        place_name: "Troost Coffee Shop",
        address: "100 Main St",
        city: "Austin",
        is_favorite: true,
        location_id: "loc-B",
        avg_latitude: 30.2672,
        avg_longitude: -97.7431,
      });
      const result = analyzeLocationIssues([place1, place2], [saved1, saved2]);

      const issues1 = result.get(getPlaceIssueKey(place1))!;
      const merge1 = issues1.find(i => i.type === "merge_candidate");
      expect(merge1).toBeDefined();
      expect(merge1!.mergeTargetName).toBe("Troost Coffee Shop");
      expect(merge1!.mergeTargetLocationId).toBe("loc-B");

      const issues2 = result.get(getPlaceIssueKey(place2))!;
      const merge2 = issues2.find(i => i.type === "merge_candidate");
      expect(merge2).toBeDefined();
      expect(merge2!.mergeTargetName).toBe("Troost Coffee");
      expect(merge2!.mergeTargetLocationId).toBe("loc-A");
    });

    it("merge_candidate has no mergeTargetLocationId when target has no location_id", () => {
      const place1 = makePlace({ place_name: "Starbucks", address: "100 Main St", city: "Austin" });
      const place2 = makePlace({ place_name: "Starbucks", address: "100 Main St", city: "Dallas" });
      const result = analyzeLocationIssues([place1, place2], []);

      const issues1 = result.get(getPlaceIssueKey(place1))!;
      const merge1 = issues1.find(i => i.type === "merge_candidate");
      expect(merge1).toBeDefined();
      expect(merge1!.mergeTargetLocationId).toBeUndefined();
    });

    it("merge_candidate is suppressed by merge_ignore_ids", () => {
      const saved1 = makeSavedLocation({ location_id: "loc-A", name: "John's Place", latitude: 30.2672, longitude: -97.7431 });
      const saved2 = makeSavedLocation({ location_id: "loc-B", name: "Mark's Place", latitude: 30.2672, longitude: -97.7431 });
      // Place A has loc-B in its ignore list
      const place1 = makePlace({
        place_name: "John's Place", address: "100 Main St", city: "Austin",
        is_favorite: true, location_id: "loc-A",
        avg_latitude: 30.2672, avg_longitude: -97.7431,
        merge_ignore_ids: JSON.stringify(["loc-B"]),
      });
      const place2 = makePlace({
        place_name: "Mark's Place", address: "100 Main St", city: "Austin",
        is_favorite: true, location_id: "loc-B",
        avg_latitude: 30.2672, avg_longitude: -97.7431,
        merge_ignore_ids: JSON.stringify(["loc-A"]),
      });
      const result = analyzeLocationIssues([place1, place2], [saved1, saved2]);

      // Neither should have merge_candidate
      const issues1 = result.get(getPlaceIssueKey(place1));
      const merge1 = issues1?.find(i => i.type === "merge_candidate");
      expect(merge1).toBeUndefined();

      const issues2 = result.get(getPlaceIssueKey(place2));
      const merge2 = issues2?.find(i => i.type === "merge_candidate");
      expect(merge2).toBeUndefined();
    });

    it("returns empty map for clean data", () => {
      const place = makePlace({
        is_favorite: false,
        city: "Austin",
        region: "Texas",
        country: "US",
      });
      const saved = makeSavedLocation({ latitude: 31.0, longitude: -97.0 }); // far away
      const result = analyzeLocationIssues([place], [saved]);

      expect(result.size).toBe(0);
    });

    it("can detect multiple issue types on one place", () => {
      // Favorite with missing data AND merge candidate
      const place1 = makePlace({
        is_favorite: true,
        location_id: "loc-1",
        place_name: "Cafe",
        address: "1 Main",
        city: null,
      });
      const place2 = makePlace({
        place_name: "Cafe",
        address: "1 Main",
        city: "Austin",
      });
      const result = analyzeLocationIssues([place1, place2], []);
      const issues = result.get(getPlaceIssueKey(place1));

      expect(issues).toBeDefined();
      expect(issues!.find(i => i.type === "missing_data")).toBeDefined();
      expect(issues!.find(i => i.type === "merge_candidate")).toBeDefined();
    });

    it("detects needs_geocoding when ungeocoded_count > 0", () => {
      const place = makePlace({ ungeocoded_count: 3 });
      const result = analyzeLocationIssues([place], []);
      const key = getPlaceIssueKey(place);
      const issues = result.get(key);

      expect(issues).toBeDefined();
      const geocodeIssue = issues!.find(i => i.type === "needs_geocoding");
      expect(geocodeIssue).toBeDefined();
      expect(geocodeIssue!.message).toBe("3 entries need geocoding");
    });

    it("singular message for 1 ungeocoded entry", () => {
      const place = makePlace({ ungeocoded_count: 1 });
      const result = analyzeLocationIssues([place], []);
      const key = getPlaceIssueKey(place);
      const issues = result.get(key)!;

      expect(issues.find(i => i.type === "needs_geocoding")!.message).toBe("1 entry needs geocoding");
    });

    it("does NOT flag needs_geocoding when ungeocoded_count is 0", () => {
      const place = makePlace({ ungeocoded_count: 0 });
      const result = analyzeLocationIssues([place], []);
      expect(result.has(getPlaceIssueKey(place))).toBe(false);
    });

    it("does NOT flag needs_geocoding when ungeocoded_count is undefined", () => {
      const place = makePlace(); // no ungeocoded_count field
      const result = analyzeLocationIssues([place], []);
      expect(result.has(getPlaceIssueKey(place))).toBe(false);
    });
  });
});
