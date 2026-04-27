# Motion Controlled Cricket Game: Project Overview

## 1. System Architecture

Three components work together in real-time:

```
Phone (Flutter App) --> Node.js Relay Server --> Browser (Three.js Game)
   [sends sensor data]     [broadcasts]         [renders & interprets]
```

1. **Mobile App (Flutter)**
   - Reads Accelerometer + Gyroscope at ~50Hz
   - Sends data as JSON `{ type: 'motion', data: { acc: [x,y,z], gyro: [x,y,z] } }`
   - Also sends action messages `{ type: 'action', action: 'next_ball' }` from the NEXT BALL button

2. **Relay Server (Node.js / `server.js`)**
   - Runs on `ws://0.0.0.0:8080`
   - Clients register as `mobile` or `frontend`
   - Relays `motion` and `action` messages from mobile → all frontend clients
   - Notifies frontends when mobile connects/disconnects

3. **Frontend Game (Three.js / `main.js`)**
   - Receives real-time sensor data and translates it to 3D bat movement
   - Handles the full gameplay loop: ball delivery → swing detection → hit logic → ball physics → scoring

---

## 2. Core Game Loop (Step by Step)

1. Player presses "NEXT BALL" on the phone (or Space on keyboard)
2. A 4-second countdown runs — calibration snapshot is taken at this moment
3. The ball spawns at `Z = -20` with randomized speed, lateral swing, and pitch position
4. Ball moves toward player (`Z = 0` and beyond)
5. The phone's motion is continuously read and applied to the 3D bat
6. `swingDetector.js` watches the motion buffer for a spike — when detected, a Swing Event fires
7. `shotMapper.js` receives the event and:
   - Classifies the shot type (Drive, Loft, Cut, Pull)
   - Computes power
   - Checks if ball is within the Hit Window
8. If timing is good → hit! Ball gets a velocity vector based on shot type and flies into the field
9. Score is updated based on timing quality + power
10. Player presses NEXT BALL again to repeat

---

## 3. File Map

| File | Purpose |
|---|---|
| `mobile/lib/main.dart` | Flutter UI, Connect/Disconnect, NEXT BALL button |
| `mobile/lib/network/socket_service.dart` | WebSocket client, sends motion + action data |
| `mobile/lib/sensors/motion_service.dart` | Reads accelerometer + gyroscope |
| `backend/src/server.js` | WebSocket relay server |
| `frontend/src/main.js` | Core game loop, bat physics, orchestrator |
| `frontend/src/scene/setupScene.js` | Three.js scene, bat mesh, ball mesh, camera, lighting |
| `frontend/src/input/swingDetector.js` | Analyses buffered motion data, fires swing events |
| `frontend/src/input/motionBuffer.js` | Stores and filters the last ~1s of sensor frames |
| `frontend/src/gameplay/shotMapper.js` | Maps swing events to shot types, timing, runs |
| `frontend/src/network/socket.js` | WebSocket client for the browser |
| `frontend/index.html` | HTML shell, UI elements (score, status, shotResult) |

---

## 4. Essential Parameters & Why They Exist

### `main.js` — Bat Controller

| Parameter | Value | Purpose |
|---|---|---|
| `ROTATION_SENSITIVITY` | 1.0 | Scales gyro → rotation. 1.0 = true 1:1. Increase for a more dramatic bat angle. |
| `POSITION_SCALE` | 0.02 | How far the bat translates per unit of linear acceleration. Kept small to stay in camera view. |
| `RETURN_DAMPING` | 0.1 | Lerp factor pulling bat back to `restPosition`. Prevents sensor drift accumulating permanently. |
| `GYRO_DEADZONE` | 0.1 | Gyro values below this are clamped to zero, eliminating micro-jitter from holding the phone still. |
| `alpha` (gravity filter) | 0.95 | Low-pass filter coefficient. 0.95 = very slow adaptation → gravity estimate is stable. |
| `deliverySpeed` | 12–20 (random) | How fast the ball travels per second. Randomized each delivery for variety. |
| `deliverySwingX` | -3 to +3 (random) | Lateral drift per second on the ball (like real swing bowling). |
| `deliveryPitchZ` | -15 to -7 (random) | Where on the pitch the ball bounces. Changes the height at which it reaches the player. |

### `motionBuffer.js` — Signal Filtering

| Parameter | Value | Purpose |
|---|---|---|
| `BUFFER_SIZE` | 60 frames | Stores ~1 second of sensor data. Used by swing detector to analyze recent motion history. |
| `ALPHA` | 0.08 | Low-pass filter on the buffer. A low value (0.08) heavily smooths data → reduces jitter in swing detection. |
| `K_GYRO` | 2.0 | Weight multiplier on gyro contribution to `motionScore`. Gyro is a stronger indicator of an intentional swing than acceleration alone. |

### `swingDetector.js` — Swing Recognition

| Parameter | Value | Purpose |
|---|---|---|
| `SWING_THRESHOLD` | 28.0 | Combined motion score needed to register a swing. Below this = noise/idle. Above = intentional swing. Tune this first if swings are not detecting. |
| `COOLDOWN` | 600ms | Lock-out period after a swing fires. Prevents a single physical swing from triggering 3–4 swing events. |
| `PEAK_SEARCH_WINDOW` | 8 frames | How far back in the buffer to look for the motion peak. Approx ~130ms of context. |
| `MAX_EXPECTED_ACC` | 40.0 | Used to normalize power. A swing at 40 m/s² = 100% power. Adjust if power always reads too high/low. |

### `shotMapper.js` — Hit Detection & Scoring

| Parameter | Value | Purpose |
|---|---|---|
| `HIT_WINDOW_Z_START` | -6.0 | Ball must have passed at least Z=-6 for a swing to register as a hit (not too early). |
| `HIT_WINDOW_Z_END` | 6.0 | Ball can still be hit up to Z=6 before it fully passes the player. Wide window = more forgiving. |
| `PERFECT_WINDOW_START` | -1.5 | Inner "sweet spot" start. Hitting here gives max runs. |
| `PERFECT_WINDOW_END` | 2.5 | Inner "sweet spot" end. |
| Direction deadzone | 0.3 | Swing axis components below 0.3 are zeroed out. Forces clean shot classification despite shaky real-world input. |
| Power clamp min | 0.2 | Even a soft swing registers at 20% power. Prevents 0-run outcomes from gentle but valid swings. |

---

## 5. Known Design Decisions & Trade-offs

- **No `isBallHit` guard on `launchBall()`**: Intentional. The previous ball rolling in the field should not block bowling the next one — it's a prototype, not a real over.
- **Hitstop was removed**: It was causing choppy animation and interfering with the 1:1 motion tracking loop. The flash color effect is kept as a lighter substitute.
- **`rawOrientation` is separate from `currentOrientation`**: `currentOrientation` is used for rendering the bat angle; `rawOrientation` is used for computing bat translation arc. This separation prevents gravity-correction drift from affecting position calculations.
- **Practice swings are currently identified by `isBallActive === false`**: This means swings during the 4-second countdown are marked as practice. The ball being in-flight (`isBallActive = true`) is what gates real hit detection.
