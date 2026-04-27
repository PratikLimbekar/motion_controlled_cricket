Phase 1: Make Motion Meaningful (Core Input Layer)

Right now your bat “moves,” but it doesn’t mean anything. Fix that first.

1. Stabilize & Filter Sensor Data

Raw accelerometer/gyro data is messy.

Apply a low-pass filter to smooth noise
Optionally add a high-pass filter to detect sudden motion (swings)

Simple approach:

Smooth position → low-pass
Detect swing → high-pass spike

👉 Goal: eliminate jitter so the bat doesn’t feel drunk

2. Establish a Consistent Coordinate System

Phones rotate. Your game world doesn’t.

Normalize motion relative to:
initial orientation OR
gravity vector

👉 Without this, “left swing” today becomes “up swing” tomorrow.

3. Detect a Swing Event (MOST IMPORTANT STEP)

Don’t overcomplicate this.

Start with a simple heuristic:

if (acceleration_magnitude > threshold && gyro_magnitude > threshold)
    → SWING DETECTED

Then add:

cooldown (300–600 ms) to prevent multiple triggers
minimum duration (~50–150 ms)

👉 Goal: one clean swing = one action

Phase 2: Extract Gameplay Signals

Once you detect a swing, extract 3 things:

4. Swing Power

Use peak acceleration:

power = clamp(max_acc / scale_factor)

👉 Map to:

shot distance
ball speed
5. Swing Direction

Use gyro axis or dominant motion direction:

Examples:

X axis → horizontal (pull/cut)
Y axis → vertical (drive/loft)

Simple mapping:

Motion	Shot
Forward	Drive
Upward	Loft
Sideways	Cut/Pull

👉 Don’t aim for accuracy—aim for consistency

6. Timing Detection

You already control ball delivery → use that.

Define a hit window (e.g. ±150 ms around ideal contact)
Compare swing timestamp vs ball position

👉 This is what makes it feel like a game, not a demo.

Phase 3: Build the First Playable Loop

Now connect motion → outcome.

7. Ball + Hit Logic
Spawn ball
Move toward player
On swing:
check timing
check direction
check power

Then decide:

if (good timing)
    → hit
else
    → miss
8. Fake Physics (Don’t Simulate Yet)

You don’t need real physics.

Just do:

Predefined trajectories:
drive → straight arc
pull → left arc
loft → high arc

👉 This keeps it responsive and predictable.

9. Visual Feedback

This is where it starts feeling fun:

Bat swing animation trigger
Ball impact effect (flash / sound later)
Simple text feedback:
“Perfect!”
“Too Early”
“Miss”

Phase 4: Now, Tighten the Feel (Polish Core Interaction)

Now refine—not expand.

10. Add Forgiveness

Real users are messy.

widen timing window slightly
smooth direction classification
clamp extreme values

👉 Make bad swings still “kinda work”

11. Reduce Latency Perception

Even if latency exists, hide it:

Predict swing start locally (optional later)
Slight delay on ball contact for sync illusion
12. Tune Thresholds (This is Huge)

You will spend most time here:

swing threshold
timing window
power scaling

👉 This is where the game becomes fun or frustrating

Phase 5: Minimal Game Layer

Once core interaction feels good:

13. Add Scoring
runs based on:
timing
power
direction
14. Add Basic UI
score counter
“Tap to start”
feedback text
15. Add Sound (High Impact, Low Effort)

Even basic:

bat hit sound
whoosh on swing

This alone boosts perceived quality massively.