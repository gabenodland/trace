import { describe, it, expect } from "vitest";
import {
  calculateDistance,
  formatDistance,
  parseMapboxHierarchy,
  extractMapboxCoordinates,
  adjustCoordinatesForPrecision,
  getLocationDisplayText,
  getLocationLabel,
  hasLocationLabel,
  getStateAbbreviation,
  isSameLocation,
  roundCoordinates,
  isValidLatitude,
  isValidLongitude,
  isValidCoordinates,
  formatCoordinates,
  formatFullAddress,
  findNearbyLocation,
} from "./locationHelpers";
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

    it("returns geographicFeature when no name or city", () => {
      expect(
        getLocationLabel({
          geographicFeature: { name: "Lake Michigan", class: "water" },
          region: "Illinois",
        })
      ).toBe("Lake Michigan");
    });

    it("returns neighborhood when no name, city, or geographicFeature", () => {
      expect(getLocationLabel({ neighborhood: "Westport", region: "Missouri" })).toBe("Westport");
    });

    it("returns region when no name, city, geographicFeature, or neighborhood", () => {
      expect(getLocationLabel({ region: "Missouri" })).toBe("Missouri");
    });

    it("returns country when only country available", () => {
      expect(getLocationLabel({ country: "United States" })).toBe("United States");
    });

    it("returns geographicFeature for ocean locations", () => {
      expect(
        getLocationLabel({
          geographicFeature: { name: "Pacific Ocean", class: "ocean" },
          country: "United States",
        })
      ).toBe("Pacific Ocean");
    });

    it("prefers geographicFeature over city (when IN a water body)", () => {
      expect(
        getLocationLabel({
          city: "Liberty",
          geographicFeature: { name: "Missouri River", class: "river" },
          region: "Missouri",
        })
      ).toBe("Missouri River");
    });

    it("returns 'Unnamed Location' for empty object", () => {
      expect(getLocationLabel({})).toBe("Unnamed Location");
    });

    it("returns 'Unnamed Location' for null", () => {
      expect(getLocationLabel(null)).toBe("Unnamed Location");
    });

    it("returns 'Unnamed Location' for undefined", () => {
      expect(getLocationLabel(undefined)).toBe("Unnamed Location");
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

    it("returns true when geographicFeature exists", () => {
      expect(hasLocationLabel({ geographicFeature: { name: "Lake Michigan", class: "water" } })).toBe(true);
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

  describe("adjustCoordinatesForPrecision", () => {
    const coords: Coordinates = { latitude: 40.712776, longitude: -74.005974 };
    const hierarchy = {};

    it("returns exact coordinates for 'coords' precision", () => {
      const result = adjustCoordinatesForPrecision(coords, hierarchy, "coords");
      expect(result).toEqual(coords);
    });

    it("rounds to ~100m for poi/address/neighborhood", () => {
      const result = adjustCoordinatesForPrecision(coords, hierarchy, "poi");
      expect(result?.latitude).toBe(40.713);
      expect(result?.longitude).toBe(-74.006);
    });

    it("rounds to city level", () => {
      const result = adjustCoordinatesForPrecision(coords, hierarchy, "city");
      expect(result?.latitude).toBe(40.7);
      expect(result?.longitude).toBe(-74);
    });

    it("returns null for country level", () => {
      const result = adjustCoordinatesForPrecision(coords, hierarchy, "country");
      expect(result).toBeNull();
    });
  });

  describe("getLocationDisplayText", () => {
    it("returns name for coords precision", () => {
      const location: LocationData = {
        precision: "coords",
        name: "My Location",
        latitude: 40.7128,
        longitude: -74.006,
      };
      expect(getLocationDisplayText(location)).toBe("My Location");
    });

    it("returns coordinates when no name", () => {
      const location: LocationData = {
        precision: "coords",
        latitude: 40.7128,
        longitude: -74.006,
      };
      const result = getLocationDisplayText(location);
      expect(result).toContain("40.712800");
    });

    it("returns neighborhood for neighborhood precision", () => {
      const location: LocationData = {
        precision: "neighborhood",
        neighborhood: "Tribeca",
        city: "New York",
      };
      expect(getLocationDisplayText(location)).toBe("Tribeca");
    });

    it("falls back to city when no neighborhood", () => {
      const location: LocationData = {
        precision: "neighborhood",
        city: "New York",
      };
      expect(getLocationDisplayText(location)).toBe("New York");
    });

    it("returns city for city precision", () => {
      const location: LocationData = {
        precision: "city",
        city: "New York",
      };
      expect(getLocationDisplayText(location)).toBe("New York");
    });

    it("returns name when no precision set", () => {
      const location: LocationData = {
        name: "Default Location",
      };
      expect(getLocationDisplayText(location)).toBe("Default Location");
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

  describe("roundCoordinates", () => {
    it("rounds to specified decimals", () => {
      const coords: Coordinates = { latitude: 40.712776, longitude: -74.005974 };

      const result = roundCoordinates(coords, 2);
      expect(result.latitude).toBe(40.71);
      expect(result.longitude).toBe(-74.01);
    });

    it("rounds to 0 decimals", () => {
      const coords: Coordinates = { latitude: 40.712776, longitude: -74.005974 };

      const result = roundCoordinates(coords, 0);
      expect(result.latitude).toBe(41);
      expect(result.longitude).toBe(-74);
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
});
