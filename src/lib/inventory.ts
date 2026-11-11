import type { CabinClass } from "./policy/rules";

// SYNTHETIC inventory. No real airline, hotel or price is represented here.
// The demo uses it so no supplier integration or payment is needed.

export type Flight = {
  id: string;
  from: string;
  to: string;
  cabin: CabinClass;
  priceUsd: number;
};

export type Hotel = {
  id: string;
  city: string;
  cityTier: string;
  nightlyUsd: number;
};

const FLIGHTS: Flight[] = [
  { id: "SYN-F1", from: "CGK", to: "SIN", cabin: "economy", priceUsd: 310 },
  { id: "SYN-F2", from: "CGK", to: "SIN", cabin: "business", priceUsd: 1240 },
  { id: "SYN-F3", from: "CGK", to: "SIN", cabin: "premium_economy", priceUsd: 620 },
  { id: "SYN-F4", from: "CGK", to: "NRT", cabin: "economy", priceUsd: 780 },
  { id: "SYN-F5", from: "CGK", to: "NRT", cabin: "first", priceUsd: 4100 },
  { id: "SYN-F6", from: "CGK", to: "SYD", cabin: "economy", priceUsd: 950 },
];

const HOTELS: Hotel[] = [
  { id: "SYN-H1", city: "SIN", cityTier: "tier1", nightlyUsd: 230 },
  { id: "SYN-H2", city: "SIN", cityTier: "tier1", nightlyUsd: 410 },
  { id: "SYN-H3", city: "NRT", cityTier: "tier1", nightlyUsd: 260 },
  { id: "SYN-H4", city: "SYD", cityTier: "tier2", nightlyUsd: 180 },
  { id: "SYN-H5", city: "BDO", cityTier: "tier2", nightlyUsd: 140 },
  { id: "SYN-H6", city: "DPS", cityTier: "other", nightlyUsd: 95 },
];

export function searchFlights(from: string, to: string): Flight[] {
  return FLIGHTS.filter(
    (f) => f.from === from.toUpperCase() && f.to === to.toUpperCase(),
  );
}

export function searchHotels(city: string): Hotel[] {
  return HOTELS.filter((h) => h.city === city.toUpperCase());
}

export function findFlight(id: string): Flight | undefined {
  return FLIGHTS.find((f) => f.id === id);
}

export function findHotel(id: string): Hotel | undefined {
  return HOTELS.find((h) => h.id === id);
}
