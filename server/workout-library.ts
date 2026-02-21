export interface WorkoutTemplate {
  key: string;
  detailsMarkdown: string;
}

export const workoutLibrary: Record<string, string> = {
  "strength-a": `## Strength + Core A (40 mins)

**Goal:** Build durability for climbing and protect knees and lower back.

### Warm Up (5 mins)
- Bodyweight squats x 10
- Glute bridges x 12
- Dead bugs x 10 per side
- Hip hinge drill x 10

### Main Set (30 mins)
Do 3 rounds, rest 60 seconds between movements:
- Goblet squat (or bodyweight) x 10
- Reverse lunge x 8 per leg
- Romanian deadlift with backpack or dumbbells x 10
- Calf raises x 15
- Plank 45 seconds
- Side plank 30 seconds per side

### Cool Down (5 mins)
- Hip flexor stretch 60 seconds per side
- Hamstring stretch 60 seconds
- Thoracic rotation 10 per side

### Equipment
- Dumbbell or kettlebell or a loaded backpack
- Mat`,

  "strength-b": `## Strength + Core B (45 mins)

**Goal:** Improve climbing power and stability.

### Warm Up (5 mins)
- Step ups x 10 per leg
- Air squats x 10
- Shoulder openers x 10

### Main Set (35 mins)
4 rounds:
- Step ups (chair/box) x 10 per leg
- Split squat x 8 per leg
- Single leg RDL (light) x 8 per leg
- Push ups x 10
- Hollow hold 25 seconds

Rest 60–90 seconds between rounds.

### Cool Down
- Quad stretch 60 seconds per leg
- Glute stretch 60 seconds per side

### Equipment
- Chair or box for step ups
- Light dumbbell (optional)
- Mat`,

  "strength-power": `## Power & Plyometrics (40 mins)

**Goal:** Build explosive power for race-day efforts and technical sections.

### Warm Up (5 mins)
- Jumping jacks x 20
- Bodyweight squats x 10
- Leg swings x 10 per side
- High knees x 20

### Main Set (30 mins)
4 rounds:
- Box jumps (or squat jumps) x 8
- Bulgarian split squat x 8 per leg
- Single leg calf raises x 12 per side
- Medicine ball slams (or explosive push ups) x 8
- Hollow body hold 30 seconds
- Mountain climbers x 20

Rest 90 seconds between rounds.

### Cool Down (5 mins)
- Pigeon stretch 60 seconds per side
- Standing quad stretch 45 seconds per leg
- Child's pose 60 seconds

### Equipment
- Box or step
- Medicine ball (optional)
- Mat`,

  "easy-z2": `## Easy Z2 Ride

**Goal:** Build aerobic base and comfort on the bike.

### Warm Up (10 mins)
Easy spin, light gears. Let your legs wake up.

### Main Set
- Stay in **Zone 2** the entire time
- Cadence 85–95 RPM
- Breathe through your nose if possible
- Keep effort **conversational** — you should be able to talk

### Cool Down (10 mins)
Easy spin, high cadence. Let heart rate drop below Z2.

### Notes
- Don't chase Strava segments
- If it feels too easy, you're doing it right
- Focus on smooth pedaling and relaxed upper body`,

  "endurance-ride": `## Endurance Ride

**Goal:** Build sustained riding capacity at moderate effort.

### Warm Up (10 mins)
Z1–Z2 progressive ramp. Easy gears, increasing cadence.

### Main Set
- Ride at steady **Z2** effort
- Mix in some gentle climbing if available
- Focus on:
  - Consistent cadence (85–90 RPM)
  - Smooth gear changes
  - Relaxed grip and shoulders
  - Hydrate every 20 mins

### Cool Down (10 mins)
Easy spin, drop cadence, stretch on the bike.

### Notes
- This is your bread-and-butter ride
- Keep it conversational throughout`,

  "tempo-ride": `## Tempo Ride

**Goal:** Raise sustainable power and teach your body to work harder without redlining.

### Warm Up (15 mins)
Z1–Z2 progressive ramp. Include 2 x 30 second pickups.

### Main Set
- Ride at **Zone 3** (comfortably hard, can speak in short sentences)
- Hold tempo for the prescribed duration
- If on flat terrain: keep cadence 80–90
- If climbing: stay seated, cadence 70–80

### Cool Down (10 mins)
Easy Z1 spin. Stretch hamstrings at stop.

### Notes
- Don't drift into Z4 — this isn't a race
- If you can't hold a few words, back off`,

  "sweet-spot": `## Sweet Spot Intervals

**Goal:** Maximize training stimulus with manageable fatigue. The best bang for your buck.

### Warm Up (15 mins)
Z1–Z2 ramp up. Include 3 x 20 second sprints with 40 second rest.

### Main Set
- 3–4 x 10 min intervals at **Z3–Z4** (sweet spot = ~88–93% FTP feel)
- Recovery: 5 min easy spinning between intervals
- Seated for at least half of each interval
- Cadence: 80–90 RPM

### Cool Down (10 mins)
Easy Z1 spin. Let HR drop fully.

### Notes
- Sweet spot should feel like "comfortably uncomfortable"
- Not gasping, not easy — right in between
- Focus on even pacing through each interval`,

  "threshold-climbs": `## Threshold Climbs

**Goal:** Build race-specific climbing power at or near lactate threshold.

### Warm Up (15 mins)
Z1–Z2 ramp. Include 2 x 1 min Z3 pickups.

### Main Set
- 4 x 5 min climbs at **Zone 4** (threshold)
- Recovery: 3 min easy spinning/descend between efforts
- Stay seated for first 3 mins of each rep
- Stand for final 2 mins if needed
- Cadence: 65–80 RPM on climbs

### Cool Down (10 mins)
Easy spin on flat terrain. Deep breathing.

### Notes
- This should hurt but be sustainable
- If you blow up on rep 3, the pace was too hard
- Target consistent effort across all reps`,

  "vo2max": `## VO2max Intervals

**Goal:** Push your ceiling higher. Improve max aerobic capacity for race-day surges.

### Warm Up (15 mins)
Z1–Z2 ramp with 3 x 30 second hard efforts, 30 seconds rest.

### Main Set
- 5 x 3 min at **Zone 4–5** (very hard, can barely talk)
- Recovery: 3 min easy spinning between efforts
- Go hard but sustainable — aim to complete all 5 reps
- Cadence: 90–100+ RPM (high cadence)

### Cool Down (10 mins)
Very easy Z1 spin. Extended cool down recommended.

### Notes
- This is the hardest session of the week
- If you can do 6 reps easily, go harder
- Hydrate well before and during`,

  "race-simulation": `## Race Simulation

**Goal:** Practice race pacing, nutrition, and mental toughness on race-like terrain.

### Warm Up (15 mins)
Z1–Z2 progressive ramp. Mental rehearsal of race segments.

### Main Set
- Ride a route with climbs similar to your target event
- Alternate between:
  - Z3 on climbs (sustained power)
  - Z4 surges (1–2 min) on steep sections
  - Z2 recovery on flats/descents
- Practice race nutrition: eat/drink on schedule
- Practice technical sections at race pace

### Cool Down (10 mins)
Easy Z1 spin. Full body stretch after.

### Notes
- This simulates race effort — don't go all out
- Focus on pacing: start conservative, build effort
- Practice eating while riding at tempo`,

  "race-rehearsal": `## Race Rehearsal (Long)

**Goal:** Full dress rehearsal. Simulate race duration, fueling, pacing, and mental strategy.

### Warm Up (20 mins)
Z1–Z2 progressive ramp. Eat pre-ride meal 2–3 hours before.

### Main Set
- Ride at **race duration** or close to it
- Mostly Z2, with race-specific blocks:
  - From Week 5+: 2 x 15 min at Z3 with 10 min easy between
  - Practice climbing at target race effort
  - Practice descending at race speed
- Fuel every 30–45 mins (gels, bars, real food)
- Hydrate every 15–20 mins

### Cool Down (15 mins)
Easy Z1 spin. Extended stretching session.

### Notes
- Wear race kit, use race setup
- Practice everything: nutrition, pacing, mental cues
- Note what works and what doesn't in your session notes`,

  "long-ride": `## Long Ride

**Goal:** Race durability. Fueling practice. Pacing discipline.

### Rules
- Mostly **Zone 2** — do not smash it
- Every 30 mins: **drink**
- Every 45 mins: **eat something** (gel, bar, banana)
- If you feel amazing, you still don't smash it

### Optional Blocks (from Week 5+)
- 2 x 15 min tempo (Z3) with 10 min easy between

### Warm Up
- First 15 mins easy spin Z1
- Gradually build to Z2

### Cool Down
- Last 15 mins easy spin
- Extended stretching at home

### Notes
- This ride builds race endurance
- Practice your race nutrition strategy
- Track what you eat/drink in session notes`,

  "easy-long-ride": `## Easy Long Ride (Recovery Week)

**Goal:** Maintain endurance while allowing recovery. Low stress, steady effort.

### Warm Up (10 mins)
Very easy spin. Light gears.

### Main Set
- Stay in **Zone 2** throughout
- Keep cadence comfortable (80–90 RPM)
- No hard efforts, no chasing groups
- Focus on:
  - Smooth pedaling
  - Relaxed upper body
  - Consistent hydration

### Cool Down (10 mins)
Easy spin, stretch on the bike.

### Notes
- This is a recovery week ride — keep it genuinely easy
- Shorter than usual long rides on purpose
- Practice nutrition but don't force volume`,

  "recovery-spin": `## Recovery Spin (30 mins)

**Goal:** Active recovery. Flush the legs. Spin easy.

### Session
- Stay in **Zone 1** the entire time
- Very light gears
- Cadence 90+ RPM
- Don't push — this should feel effortless
- Indoor trainer is fine

### Notes
- If your legs feel heavy, keep spinning gently
- Heart rate should stay well below Z2
- This is NOT a workout — it's recovery
- Skip this if you need full rest instead`,

  "short-opener": `## Short Opener (25 mins)

**Goal:** Shake out the legs during taper. Stay sharp without fatiguing.

### Warm Up (5 mins)
Easy spin Z1.

### Main Set (15 mins)
- 3 x 1 min at Z3 with 2 min easy between
- 2 x 30 sec sprint (80% effort) with 90 sec easy between
- Stay smooth and controlled

### Cool Down (5 mins)
Easy spin.

### Notes
- Taper ride — the goal is to feel snappy, not tired
- Keep total effort low
- This primes the legs for race day`,

  "light-intervals": `## Light Intervals (30 mins)

**Goal:** Maintain sharpness during taper without adding fatigue.

### Warm Up (5 mins)
Easy Z1 spin.

### Main Set (20 mins)
- 4 x 2 min at Z3 with 2 min easy between
- 2 x 20 sec sprint (85% effort) with 1 min rest
- Keep everything controlled and smooth

### Cool Down (5 mins)
Easy Z1 spin.

### Notes
- Don't add extra reps — resist the urge
- You should finish feeling better than when you started
- Race week is about rest, not fitness gains`,

  "shakeout-ride": `## Shakeout Ride (20 mins)

**Goal:** Final pre-race loosener. Open the legs, nothing more.

### Session
- 5 min easy spin
- 5 min Z2 steady
- 3 x 30 sec at Z3 with 1 min easy between
- 5 min easy spin cool down

### Notes
- Do this 1–2 days before your event
- Lay out race kit and check bike after
- Eat well, hydrate, sleep early
- You're ready — trust the training`,
};

export function getWorkoutDetails(type: string, description: string, week: number): string {
  const descLower = description.toLowerCase();
  const typeLower = type.toLowerCase();

  if (typeLower === "strength" || descLower.includes("strength") || descLower.includes("core")) {
    if (descLower.includes("power") || descLower.includes("plyometric") || descLower.includes("explosive")) {
      return workoutLibrary["strength-power"];
    }
    if (week % 2 === 0) {
      return workoutLibrary["strength-b"];
    }
    return workoutLibrary["strength-a"];
  }

  if (descLower.includes("recovery spin")) return workoutLibrary["recovery-spin"];
  if (descLower.includes("short opener")) return workoutLibrary["short-opener"];
  if (descLower.includes("light interval")) return workoutLibrary["light-intervals"];
  if (descLower.includes("shakeout")) return workoutLibrary["shakeout-ride"];

  if (descLower.includes("vo2max") || descLower.includes("vo2")) return workoutLibrary["vo2max"];
  if (descLower.includes("race simulation")) return workoutLibrary["race-simulation"];
  if (descLower.includes("race rehearsal")) return workoutLibrary["race-rehearsal"];
  if (descLower.includes("sweet spot")) return workoutLibrary["sweet-spot"];
  if (descLower.includes("threshold") && descLower.includes("climb")) return workoutLibrary["threshold-climbs"];
  if (descLower.includes("tempo")) return workoutLibrary["tempo-ride"];

  if (typeLower === "long ride") {
    if (descLower.includes("easy long")) return workoutLibrary["easy-long-ride"];
    if (descLower.includes("endurance") && descLower.includes("climb")) return workoutLibrary["race-rehearsal"];
    return workoutLibrary["long-ride"];
  }

  if (descLower.includes("endurance") && descLower.includes("climb")) return workoutLibrary["endurance-ride"];
  if (descLower.includes("endurance")) return workoutLibrary["endurance-ride"];
  if (descLower.includes("easy")) return workoutLibrary["easy-z2"];

  if (typeLower === "rest") {
    return `## Rest Day

**Goal:** Full recovery. Let your body adapt to training stress.

### Session
- No structured exercise
- Light walking or stretching is fine
- Focus on sleep, nutrition, and hydration

### Notes
- Rest days are when you actually get stronger
- Don't feel guilty — this is part of the plan`;
  }

  return `## ${description} (${typeLower === "long ride" ? "Long " : ""}${typeLower.includes("ride") ? "Ride" : "Session"})

**Goal:** Follow the prescribed workout at the target intensity.

### Session
- Duration: As prescribed
${zoneInfo(typeLower)}
- Focus on consistent effort and good form
- Stay hydrated throughout

### Notes
- Adjust intensity if fatigued from previous sessions
- Log your RPE and any notes after completing`;
}

function zoneInfo(type: string): string {
  if (type.includes("ride")) {
    return `- Stay in the prescribed heart rate zone
- Cadence: 80-95 RPM
- Keep effort manageable and sustainable`;
  }
  return `- Focus on controlled movements
- Rest between sets as needed
- Quality over quantity`;
}
