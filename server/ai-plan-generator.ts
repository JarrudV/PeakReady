import { GoogleGenAI } from "@google/genai";
import type { InsertSession } from "@shared/schema";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

export interface PlanRequest {
  eventName: string;
  eventDate: string;
  eventDistance?: number;
  eventElevation?: number;
  fitnessLevel: "beginner" | "intermediate" | "advanced";
  goals: string[];
  currentWeight?: number;
  targetWeight?: number;
  daysPerWeek: number;
  hoursPerWeek: number;
  equipment: "gym" | "home_full" | "home_minimal" | "no_equipment";
  injuries?: string;
  additionalNotes?: string;
}

function buildPrompt(req: PlanRequest): string {
  const now = new Date();
  const eventDate = new Date(req.eventDate);
  const weeksUntilEvent = Math.max(1, Math.round((eventDate.getTime() - now.getTime()) / (7 * 24 * 60 * 60 * 1000)));
  const totalWeeks = Math.min(weeksUntilEvent, 16);

  const equipmentDesc: Record<string, string> = {
    gym: "Full gym access (barbells, dumbbells, cable machines, leg press, etc.)",
    home_full: "Home gym with dumbbells, resistance bands, pull-up bar, and bench",
    home_minimal: "Minimal home equipment (resistance bands, bodyweight exercises)",
    no_equipment: "No equipment at all (bodyweight only)",
  };

  return `You are an expert mountain bike / cycling coach. Create a structured ${totalWeeks}-week training plan for the following athlete.

EVENT: ${req.eventName}
EVENT DATE: ${req.eventDate}
EVENT DISTANCE: ${req.eventDistance ? `${req.eventDistance} km` : "Not specified"}
EVENT ELEVATION: ${req.eventElevation ? `${req.eventElevation}m gain` : "Not specified"}
WEEKS UNTIL EVENT: ${weeksUntilEvent}

ATHLETE PROFILE:
- Fitness Level: ${req.fitnessLevel}
- Goals: ${req.goals.join(", ")}
- Current Weight: ${req.currentWeight ? `${req.currentWeight} kg` : "Not specified"}
- Target Weight: ${req.targetWeight ? `${req.targetWeight} kg` : "Not specified"}
- Available Days Per Week: ${req.daysPerWeek}
- Available Hours Per Week: ${req.hoursPerWeek}
- Equipment: ${equipmentDesc[req.equipment]}
${req.injuries ? `- Injuries/Limitations: ${req.injuries}` : ""}
${req.additionalNotes ? `- Additional Notes: ${req.additionalNotes}` : ""}

Generate a training plan as a JSON array. Each session should be a JSON object with these exact fields:
- "id": string (format "ai-w{week}-s{sessionNum}", e.g. "ai-w1-s1")
- "weekNumber": number (1 to ${totalWeeks})
- "type": string (one of: "Ride", "Long Ride", "Strength", "Rest")
- "description": string (short title like "Zone 2 Base Ride" or "Upper Body Strength")
- "scheduledMinutes": number (duration in minutes)
- "zone": string (one of: "Zone 1", "Zone 2", "Zone 3", "Zone 4", "Zone 5", "N/A")
- "detailsMarkdown": string (detailed workout instructions in markdown with warmup, main set, cooldown sections)

IMPORTANT GUIDELINES:
- Plan ${req.daysPerWeek} sessions per week, keeping within ${req.hoursPerWeek} total hours per week
- Include periodization: base building early, intensity buildup in middle weeks, then taper before event
- For strength sessions, ONLY prescribe exercises the athlete can do with their equipment (${equipmentDesc[req.equipment]})
- For "${req.equipment === "no_equipment" ? "bodyweight" : req.equipment}" workouts, include exercises like: ${
    req.equipment === "no_equipment" || req.equipment === "home_minimal"
      ? "push-ups, squats, lunges, planks, glute bridges, step-ups, wall sits, single-leg deadlifts, burpees, mountain climbers"
      : req.equipment === "home_full"
        ? "dumbbell squats, dumbbell lunges, resistance band pulls, dumbbell rows, bench press, pull-ups, dumbbell deadlifts"
        : "barbell squats, deadlifts, leg press, cable rows, bench press, lat pulldowns, leg curls"
  }
- Include rest days in the plan
- Each detailsMarkdown should have clear warmup, main set, and cooldown sections with specific exercises, sets, reps, durations, and intensity
- For rides, include specific zone targets and intervals where appropriate
- Make the plan progressive (gradually increasing load)
- Include a taper in the final 1-2 weeks before the event
${req.goals.includes("weight_loss") ? "- Include nutritional awareness notes in some sessions for weight management" : ""}

Respond ONLY with a valid JSON array of session objects. No explanation text, just the JSON array.`;
}

export async function generateAIPlan(req: PlanRequest): Promise<InsertSession[]> {
  const prompt = buildPrompt(req);

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      maxOutputTokens: 8192,
      temperature: 0.7,
    },
  });

  const text = response.text || "";

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error("AI did not return a valid training plan. Please try again.");
  }

  let parsed: any[];
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error("Failed to parse AI response. Please try again.");
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("AI returned an empty plan. Please try again.");
  }

  const validTypes = ["Ride", "Long Ride", "Strength", "Rest"];
  const validZones = ["Zone 1", "Zone 2", "Zone 3", "Zone 4", "Zone 5", "N/A"];
  const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  const sessions: InsertSession[] = parsed.map((s: any, i: number) => {
    const weekNum = Number(s.weekNumber) || 1;
    const sessionInWeek = parsed.filter((x: any) => (Number(x.weekNumber) || 1) === weekNum).indexOf(s);

    return {
      id: s.id || `ai-w${weekNum}-s${i + 1}`,
      week: weekNum,
      day: s.day || dayNames[Math.min(sessionInWeek, 6)] || "Monday",
      type: validTypes.includes(s.type) ? s.type : "Ride",
      description: String(s.description || "Training Session"),
      minutes: Number(s.scheduledMinutes || s.minutes) || 60,
      zone: validZones.includes(s.zone) ? s.zone : null,
      elevation: null,
      strength: s.type === "Strength",
      completed: false,
      completedAt: null,
      rpe: null,
      notes: null,
      detailsMarkdown: String(s.detailsMarkdown || ""),
      scheduledDate: null,
    };
  });

  return sessions;
}
