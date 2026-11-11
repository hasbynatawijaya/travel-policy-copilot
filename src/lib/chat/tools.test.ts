import { describe, expect, it, vi } from "vitest";
import { runTool, type BookingSaver, type ToolContext } from "./tools";
import type { ActiveRule } from "../policy/engine";

const rules: ActiveRule[] = [
  { id: "r-cabin", rule: { type: "cabin_class", maxCabin: "business", sourceQuote: "x" } },
  { id: "r-flight", rule: { type: "flight_price_cap", maxAmountUsd: 800, sourceQuote: "x" } },
  { id: "r-advance", rule: { type: "advance_booking", minDays: 7, sourceQuote: "x" } },
];

function ctx(saveBooking = vi.fn<BookingSaver>(async () => ({ tripId: "t-1", status: "booked" as const }))): ToolContext {
  return { rules, saveBooking };
}

describe("search tools", () => {
  it("returns synthetic flights for a route", async () => {
    const result = await runTool("search_flights", { from: "CGK", to: "SIN" }, ctx());
    expect(result.isError).toBe(false);
    const flights = JSON.parse(result.content);
    expect(flights.map((f: { id: string }) => f.id)).toEqual(["SYN-F1", "SYN-F2", "SYN-F3"]);
  });

  it("rejects a city code that is not three letters", async () => {
    const result = await runTool("search_hotels", { city: "Singapore" }, ctx());
    expect(result.isError).toBe(true);
    expect(result.content).toMatch(/Invalid input/);
  });
});

describe("book_trip", () => {
  it("passes an in-policy flight to the saver with a clean verdict", async () => {
    const save = vi.fn<BookingSaver>(async () => ({ tripId: "t-1", status: "booked" as const }));
    const result = await runTool(
      "book_trip",
      { flightId: "SYN-F1", daysBeforeTravel: 14, nights: 1 },
      ctx(save),
    );
    expect(result.isError).toBe(false);
    expect(save).toHaveBeenCalledOnce();
    expect(save.mock.calls[0]?.[0].verdict.requiresApproval).toBe(false);
    expect(JSON.parse(result.content)).toMatchObject({ tripId: "t-1", requiresApproval: false, reasons: [] });
  });

  it("reports the policy reasons for an out-of-policy flight", async () => {
    const result = await runTool(
      "book_trip",
      { flightId: "SYN-F5", daysBeforeTravel: 2, nights: 1 },
      ctx(),
    );
    expect(result.isError).toBe(false);
    const body = JSON.parse(result.content);
    expect(body.requiresApproval).toBe(true);
    expect(body.reasons).toEqual([
      "first is above the business limit",
      "Flight USD 4100 is above the USD 800 cap",
      "Booked 2 days ahead; policy needs 7",
    ]);
  });

  it("refuses to book without a flight or hotel", async () => {
    const save = vi.fn();
    const result = await runTool("book_trip", { daysBeforeTravel: 14, nights: 1 }, ctx(save));
    expect(result.isError).toBe(true);
    expect(save).not.toHaveBeenCalled();
  });

  it("rejects an unknown flight id instead of booking it", async () => {
    const save = vi.fn();
    const result = await runTool(
      "book_trip",
      { flightId: "SYN-NOPE", daysBeforeTravel: 14, nights: 1 },
      ctx(save),
    );
    expect(result.content).toBe("Unknown flight id SYN-NOPE");
    expect(save).not.toHaveBeenCalled();
  });

  it("rejects a tool name it does not know", async () => {
    const result = await runTool("delete_everything", {}, ctx());
    expect(result).toEqual({ content: "Unknown tool delete_everything", isError: true });
  });
});
