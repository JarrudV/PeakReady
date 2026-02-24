import type { Session } from "@shared/schema";

export interface StructuredWorkoutDetails {
  source: "library" | "fallback";
  key: string;
  title: string;
  purpose: string;
  warmUp: string[];
  mainSet: string[];
  coolDown: string[];
  equipment?: string[];
  timeEstimate: string;
  rpeGuidance: string;
  fallbackMessage?: string;
}

interface WorkoutTemplate {
  key: string;
  title: string;
  purpose: string;
  warmUp: string[];
  mainSet: string[];
  coolDown: string[];
  equipment?: string[];
  timeEstimate: string;
  rpeGuidance: string;
  match?: string[];
}

const NON_RIDE_WORKOUT_LIBRARY: Record<string, WorkoutTemplate[]> = {
  strength: [
    {
      key: "strength-core-stability",
      title: "Strength & Core",
      purpose: "Build resilient climbing muscles and improve trunk stability for technical terrain.",
      warmUp: [
        "5-8 min easy mobility: hip circles, glute bridges, thoracic rotations",
        "2 x 10 bodyweight squats and 2 x 8 reverse lunges per side",
      ],
      mainSet: [
        "3 rounds: goblet squat x10, Romanian deadlift x10, split squat x8/side",
        "3 rounds: plank 45 sec, side plank 30 sec/side, dead bug x10/side",
        "Rest 60-75 sec between movements",
      ],
      coolDown: [
        "2-3 min easy breathing down-regulation",
        "Hip flexor + hamstring stretch 45-60 sec per side",
      ],
      equipment: ["Dumbbell or kettlebell (or loaded backpack)", "Exercise mat"],
      timeEstimate: "25-40 min",
      rpeGuidance: "Target RPE 6-7. Keep reps crisp and controlled, not to failure.",
      match: ["core", "stability", "foundational", "foundation", "strength", "posterior"],
    },
    {
      key: "strength-power",
      title: "Power Strength",
      purpose: "Develop explosive force for punchy climbs, accelerations, and technical exits.",
      warmUp: [
        "8 min dynamic prep: jump rope or brisk spin, leg swings, squat pulses",
        "2 x 5 low-amplitude jump squats and 2 x 6 step-ups per side",
      ],
      mainSet: [
        "4 rounds: split squat jump x6/side (or non-jump variant), box/step jump x6",
        "3 rounds: single-leg RDL x8/side, calf raise x12/side, hollow hold 30 sec",
        "Rest 90 sec between rounds to preserve movement quality",
      ],
      coolDown: [
        "3-5 min easy walk or spin",
        "Glute, quad, and calf stretch 45 sec per side",
      ],
      equipment: ["Step or box", "Optional dumbbells", "Exercise mat"],
      timeEstimate: "30-45 min",
      rpeGuidance: "Target RPE 7-8 on work sets, but stop before form breaks.",
      match: ["power", "plyometric", "explosive", "primer"],
    },
    {
      key: "strength-mobility",
      title: "Mobility & Core Activation",
      purpose: "Promote recovery and maintain movement quality without adding high fatigue.",
      warmUp: [
        "5 min gentle movement: cat-camel, hip openers, shoulder circles",
        "2 x 8 glute bridge and 2 x 8 bird dog per side",
      ],
      mainSet: [
        "2-3 rounds: tempo air squat x8, step-down x8/side, side plank x20-30 sec/side",
        "2-3 rounds: Pallof press x10/side, dead bug x10/side",
      ],
      coolDown: [
        "90 sec diaphragmatic breathing",
        "Light lower back and hip mobility sequence",
      ],
      equipment: ["Resistance band (optional)", "Exercise mat"],
      timeEstimate: "20-30 min",
      rpeGuidance: "Target RPE 4-6. You should finish feeling better than when you started.",
      match: ["mobility", "activation", "tune-up", "reset"],
    },
  ],
  rest: [
    {
      key: "rest-day",
      title: "Rest Day",
      purpose: "Absorb training load so your fitness adapts and fatigue drops.",
      warmUp: ["Optional: 5-10 min gentle walk or mobility if you feel stiff."],
      mainSet: [
        "No structured training",
        "Prioritize sleep, hydration, and normal fueling",
      ],
      coolDown: ["Optional light stretching before bed."],
      equipment: [],
      timeEstimate: "0-15 min optional movement",
      rpeGuidance: "Target RPE 1-2 only. Keep today truly easy.",
    },
  ],
};

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

function matchesTemplate(description: string, template: WorkoutTemplate): boolean {
  if (!template.match || template.match.length === 0) return false;
  return template.match.some((keyword) => description.includes(keyword));
}

function getFallbackDetails(session: Pick<Session, "type" | "description" | "minutes">): StructuredWorkoutDetails {
  return {
    source: "fallback",
    key: "fallback-non-ride",
    title: session.description || session.type,
    purpose: "Use this non-ride session to build consistency while keeping movement quality high.",
    warmUp: ["Start with 5-8 minutes of easy mobility and activation."],
    mainSet: [
      "Follow your coach plan or preferred routine for the scheduled duration.",
      "Keep technique strict and avoid pushing through poor form.",
    ],
    coolDown: ["Finish with 3-5 minutes of breathing and mobility."],
    equipment: [],
    timeEstimate: `${Math.max(session.minutes || 0, 10)} min planned`,
    rpeGuidance: "Use RPE 5-7 unless your plan explicitly calls for easier or harder work.",
    fallbackMessage: "No preset library entry was found for this session yet. Add your own notes below to customize it.",
  };
}

export function resolveNonRideWorkoutDetails(
  session: Pick<Session, "type" | "description" | "minutes">,
): StructuredWorkoutDetails | null {
  const type = normalize(session.type);
  if (type.includes("ride")) {
    return null;
  }

  const templates = NON_RIDE_WORKOUT_LIBRARY[type];
  if (!templates || templates.length === 0) {
    return getFallbackDetails(session);
  }

  const description = normalize(session.description || "");
  const matched = templates.find((template) => matchesTemplate(description, template)) ?? templates[0];

  return {
    source: "library",
    key: matched.key,
    title: matched.title,
    purpose: matched.purpose,
    warmUp: matched.warmUp,
    mainSet: matched.mainSet,
    coolDown: matched.coolDown,
    equipment: matched.equipment,
    timeEstimate: matched.timeEstimate,
    rpeGuidance: matched.rpeGuidance,
  };
}

