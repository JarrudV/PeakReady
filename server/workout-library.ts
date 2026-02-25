export interface WorkoutTemplate {
  key: string;
  detailsMarkdown: string;
}

export const workoutLibrary: Record<string, string> = {
  "strength-a": `## Strength + Core A (40 mins)

**Goal:** Build everyday leg and core strength so riding feels steadier and easier.

### Warm Up (5 mins)
- Chair squats x 8
- Glute bridges x 10
- Step-back lunges x 6 per side
- Easy hip hinge practice x 8

### Main Set (30 mins)
Do 3 rounds, rest 60 seconds between movements:
- Chair squat x 10
- Step-back lunge x 8 per leg
- Backpack hip hinge x 10
- Calf raises x 15
- Front plank 30-40 seconds
- Side plank 20-30 seconds per side

### Cool Down (5 mins)
- Hip flexor stretch 60 seconds per side
- Hamstring stretch 60 seconds
- Gentle back rotation 8 per side

### Equipment
- Sturdy chair or bench
- Light backpack (optional)
- Mat (optional)`,

  "strength-b": `## Strength + Core B (45 mins)

**Goal:** Build steady climbing strength and better balance without high-impact moves.

### Warm Up (5 mins)
- Step ups x 10 per leg
- Air squats x 10
- Calf raises x 12

### Main Set (35 mins)
3 rounds:
- Step ups (chair/box) x 10 per leg
- Split squat hold 20 seconds per leg
- Wall push ups x 10
- Back-lying arm-and-leg reach x 8 per side

Rest 60-90 seconds between rounds.

### Cool Down
- Quad stretch 60 seconds per leg
- Glute stretch 60 seconds per side

### Equipment
- Chair or box for step ups
- Mat (optional)`,

  "strength-power": `## Strength + Bike Power (Beginner Friendly) (40 mins)

**Goal:** Build controlled pedal power and confidence with simple low-impact movements.

### Warm Up (5 mins)
- March in place x 40 seconds
- Bodyweight squats x 10
- Leg swings x 8 per side
- Step ups x 6 per side

### Main Set (30 mins)
3 rounds:
- Step ups x 8 per side
- Split squat hold 20 seconds per side
- Single leg calf raises x 12 per side
- Wall push ups x 10
- Front plank hold 30 seconds
- Easy mountain climbers x 12 per side

Rest 90 seconds between rounds.

### Cool Down (5 mins)
- Pigeon stretch 60 seconds per side
- Standing quad stretch 45 seconds per leg
- Child's pose 60 seconds

### Equipment
- Box or step
- Mat (optional)`,
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

  "skills-cadence": `## MTB Skills + Cadence Session

**Goal:** Improve trail handling while reinforcing smooth cadence and bike control.

### Warm Up (10 mins)
- 5 mins easy spin in Z1-Z2
- 3 x 20 sec high-cadence spin-ups (100-110 RPM) with 40 sec easy
- 2 mins easy, focus on relaxed upper body

### Main Set (20-35 mins)
Complete 3-4 rounds on trail, pump track, or safe open area:
- Cornering drill: 4 controlled reps each direction
- Braking drill: 4 progressive braking efforts, focus on front/rear balance
- Line-choice drill: 2-3 passes through a short technical section
- Cadence block: 3 mins steady Z2 spin at 90-100 RPM
- Recovery: 2 mins easy between rounds

### Cool Down (5-10 mins)
- Easy spin Z1
- Light mobility for hips, ankles, and thoracic spine

### Notes
- Keep skill reps controlled: quality over speed
- Stay below hard effort; this is technical learning, not a max effort day
- Log one skill cue that improved today`,

  "sweet-spot": `## Steady Hard Intervals

**Goal:** Build stronger steady riding without overcomplicating the workout.

### Warm Up (15 mins)
Z1-Z2 ramp up. Include 3 x 20 second spin-ups with 40 second rest.

### Main Set
- 3-4 x 10 min intervals at **Z3-Z4** (comfortably hard effort)
- Recovery: 5 min easy spinning between intervals
- Seated for at least half of each interval
- Cadence: 80-90 RPM

### Cool Down (10 mins)
Easy Z1 spin. Let heart rate drop fully.

### Notes
- This should feel steady and controlled, not all-out
- Not gasping, not easy - right in between
- Focus on even pacing through each interval`,

  "threshold-climbs": `## Hard Climb Repeats

**Goal:** Build climbing strength and confidence for longer hills.

### Warm Up (15 mins)
Z1-Z2 ramp. Include 2 x 1 min Z3 pickups.

### Main Set
- 4 x 5 min climbs at **Zone 4** (hard but repeatable)
- Recovery: 3 min easy spinning/descending between efforts
- Stay seated for first 3 mins of each rep
- Stand for final 2 mins if needed
- Cadence: 65-80 RPM on climbs

### Cool Down (10 mins)
Easy spin on flat terrain. Deep breathing.

### Notes
- This should feel hard but manageable
- If rep 3 falls apart, start a little easier next time
- Target consistent effort across all reps`,

  "vo2max": `## Short Hard Intervals

**Goal:** Build your ability to handle short hard efforts, then recover smoothly.

### Warm Up (15 mins)
Z1-Z2 ramp with 3 x 30 second hard efforts, 30 seconds easy.

### Main Set
- 5 x 3 min at **Zone 4-5** (very hard, can barely talk)
- Recovery: 3 min easy spinning between efforts
- Go hard but controlled so you can complete all 5 reps
- Cadence: 90-100+ RPM

### Cool Down (10 mins)
Very easy Z1 spin.

### Notes
- Keep this session short and focused
- If form fades, reduce pace slightly
- Hydrate well before and during`,

  "race-simulation": `## Event Practice Ride

**Goal:** Practice steady pacing and fueling on terrain similar to your event.

### Warm Up (15 mins)
Z1-Z2 progressive ramp.

### Main Set
- Ride a route with climbs similar to your target event
- Alternate between:
  - Z3 on climbs (steady effort)
  - Z4 surges (1-2 min) on steeper sections
  - Z2 recovery on flats/descents
- Practice event-day fueling: eat/drink on schedule
- Ride technical sections with smooth control

### Cool Down (10 mins)
Easy Z1 spin. Full body stretch after.

### Notes
- This is event practice - do not go all-out
- Focus on pacing: start conservative, build effort
- Practice eating while riding at steady effort`,

  "race-rehearsal": `## Long Event Practice Ride

**Goal:** Practice a long ride day with simple pacing, fueling, and comfort checks.

### Warm Up (20 mins)
Z1-Z2 progressive ramp. Eat a normal pre-ride meal 2-3 hours before.

### Main Set
- Ride close to your event duration
- Mostly Z2, with event-style blocks:
  - From Week 5+: 2 x 15 min at Z3 with 10 min easy between
  - Practice climbing at steady effort
  - Practice descending with control
- Fuel every 30-45 mins
- Hydrate every 15-20 mins

### Cool Down (15 mins)
Easy Z1 spin. Extended stretching session.

### Notes
- Wear the setup you plan to use on event day
- Practice your plan: fueling, pacing, and simple cues
- Note what works and what does not in your session notes`,

  "long-ride": `## Long Ride

**Goal:** Build long-ride confidence with steady effort and good fueling habits.

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
    if (descLower.includes("power") || descLower.includes("explosive")) {
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

  if (
    descLower.includes("short hard interval") ||
    descLower.includes("short hard hill") ||
    descLower.includes("vo2max") ||
    descLower.includes("vo2")
  ) {
    return workoutLibrary["vo2max"];
  }
  if (descLower.includes("event practice ride") || descLower.includes("race simulation")) {
    return workoutLibrary["race-simulation"];
  }
  if (
    descLower.includes("long event practice ride") ||
    descLower.includes("event practice day") ||
    descLower.includes("race rehearsal")
  ) {
    return workoutLibrary["race-rehearsal"];
  }
  if (
    descLower.includes("skill") ||
    descLower.includes("handling") ||
    descLower.includes("technique") ||
    descLower.includes("cadence")
  ) {
    return workoutLibrary["skills-cadence"];
  }
  if (descLower.includes("steady hard interval") || descLower.includes("sweet spot")) {
    return workoutLibrary["sweet-spot"];
  }
  if (
    (descLower.includes("hard") && descLower.includes("climb")) ||
    (descLower.includes("threshold") && descLower.includes("climb"))
  ) {
    return workoutLibrary["threshold-climbs"];
  }
  if (descLower.includes("steady effort") || descLower.includes("steady climb") || descLower.includes("tempo")) {
    return workoutLibrary["tempo-ride"];
  }

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

