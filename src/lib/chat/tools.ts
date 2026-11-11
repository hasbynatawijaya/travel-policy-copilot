import { z } from "zod";
import { checkOption, checkTrip, type ActiveRule, type Option, type Verdict } from "../policy/engine";
import { findFlight, findHotel, searchFlights, searchHotels } from "../inventory";

// Tools the chat model can call. The model searches and proposes; the engine
// decides compliance. Each input is validated here before the handler runs,
// because the SDK's parser can return a partly parsed object.

const searchFlightsInput = z.object({
  from: z.string().length(3),
  to: z.string().length(3),
});

const searchHotelsInput = z.object({
  city: z.string().length(3),
});

const bookTripInput = z.object({
  flightId: z.string().optional(),
  hotelId: z.string().optional(),
  daysBeforeTravel: z.number().int().min(0).max(365),
  nights: z.number().int().min(1).max(30),
});

export const CHAT_TOOLS = [
  {
    name: "search_flights",
    description:
      "Search mock flight inventory by origin and destination airport codes (3 letters). Returns flight ids, cabin and price in USD.",
    strict: true,
    eager_input_streaming: true,
    input_schema: {
      type: "object" as const,
      properties: {
        from: { type: "string", description: "Origin airport code, e.g. CGK" },
        to: { type: "string", description: "Destination airport code, e.g. SIN" },
      },
      required: ["from", "to"],
      additionalProperties: false,
    },
  },
  {
    name: "search_hotels",
    description:
      "Search mock hotel inventory by city code (3 letters). Returns hotel ids, city tier and nightly price in USD.",
    strict: true,
    eager_input_streaming: true,
    input_schema: {
      type: "object" as const,
      properties: {
        city: { type: "string", description: "City code, e.g. SIN" },
      },
      required: ["city"],
      additionalProperties: false,
    },
  },
  {
    name: "book_trip",
    description:
      "Check one flight and/or one hotel against the approved travel policy and create the booking. Out-of-policy trips go to an approver. Returns the policy verdict.",
    strict: true,
    eager_input_streaming: true,
    input_schema: {
      type: "object" as const,
      properties: {
        flightId: { type: "string", description: "Flight id from search_flights, optional" },
        hotelId: { type: "string", description: "Hotel id from search_hotels, optional" },
        daysBeforeTravel: { type: "integer", description: "Days between booking today and travel" },
        nights: { type: "integer", description: "Hotel nights, at least 1" },
      },
      required: ["daysBeforeTravel", "nights"],
      additionalProperties: false,
    },
  },
];

export type ToolName = (typeof CHAT_TOOLS)[number]["name"];

export type BookingSaver = (input: {
  options: Option[];
  optionVerdicts: Verdict[];
  verdict: ReturnType<typeof checkTrip>;
}) => Promise<{ tripId: string; status: "booked" | "pending_approval" }>;

export type ToolContext = {
  rules: ActiveRule[];
  saveBooking: BookingSaver;
};

// Returns the JSON string sent back as the tool_result content.
export async function runTool(
  name: string,
  rawInput: unknown,
  ctx: ToolContext,
): Promise<{ content: string; isError: boolean }> {
  try {
    switch (name) {
      case "search_flights": {
        const input = searchFlightsInput.parse(rawInput);
        return ok(searchFlights(input.from, input.to));
      }
      case "search_hotels": {
        const input = searchHotelsInput.parse(rawInput);
        return ok(searchHotels(input.city));
      }
      case "book_trip": {
        const input = bookTripInput.parse(rawInput);
        if (!input.flightId && !input.hotelId) {
          return err("Pick at least one flight or hotel.");
        }
        const options: Option[] = [];
        if (input.flightId) {
          const flight = findFlight(input.flightId);
          if (!flight) return err(`Unknown flight id ${input.flightId}`);
          options.push({
            kind: "flight",
            cabin: flight.cabin,
            priceUsd: flight.priceUsd,
            daysBeforeTravel: input.daysBeforeTravel,
          });
        }
        if (input.hotelId) {
          const hotel = findHotel(input.hotelId);
          if (!hotel) return err(`Unknown hotel id ${input.hotelId}`);
          options.push({
            kind: "hotel",
            cityTier: hotel.cityTier,
            nightlyUsd: hotel.nightlyUsd,
            nights: input.nights,
            daysBeforeTravel: input.daysBeforeTravel,
          });
        }
        const optionVerdicts = options.map((o) => checkOption(o, ctx.rules));
        const verdict = checkTrip(options, ctx.rules);
        const saved = await ctx.saveBooking({ options, optionVerdicts, verdict });
        return ok({ ...saved, requiresApproval: verdict.requiresApproval, reasons: verdict.reasons });
      }
      default:
        return err(`Unknown tool ${name}`);
    }
  } catch (e) {
    if (e instanceof z.ZodError) {
      return err(`Invalid input: ${e.issues.map((i) => i.message).join("; ")}`);
    }
    throw e;
  }
}

function ok(value: unknown) {
  return { content: JSON.stringify(value), isError: false };
}

function err(message: string) {
  return { content: message, isError: true };
}
