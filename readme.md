# Project: Motion-Controlled Cricket Game (Web-Based)

## Overview

We are building a real-time cricket game that uses a smartphone as a motion controller. The player physically swings their phone like a bat, and the game interprets that motion to simulate cricket shots in a browser-based 3D environment.

The system is designed to feel responsive and fun rather than physically perfect. Motion input is simplified into meaningful gameplay actions such as shot type, direction, and power.

---

## Core Concept

* The **phone acts as a bat/controller**
* The **laptop browser runs the game**
* Motion data is streamed in real-time via WebSockets
* The game interprets motion into cricket shots

---

## Tech Stack

* Frontend (Game): JavaScript + Three.js
* Networking: WebSocket
* Backend (Relay Server): Node.js (lightweight message relay)
* Controller: Flutter mobile app (sensor data sender)

---

## System Architecture

Phone (Flutter App)

* Reads accelerometer + gyroscope data
* Sends motion data at ~50–60 Hz via WebSocket

↓

Node.js Server

* Acts as a relay between phone and browser
* Broadcasts motion data to connected clients

↓

Browser Game (Three.js)

* Receives motion data in real-time
* Detects swing events
* Maps motion → cricket shot
* Updates 3D scene accordingly

---

## Data Flow Format (v1)

```json
{
  "acc": [x, y, z],
  "gyro": [x, y, z]
}
```

* `acc`: linear acceleration (m/s²)
* `gyro`: rotation rate (rad/s)

---

## Gameplay Loop

1. Ball is delivered toward the player
2. Player swings phone
3. System detects:

   * Swing timing
   * Swing direction
   * Swing intensity
4. Game determines:

   * Shot type (drive, pull, loft, defensive)
   * Shot power
   * Outcome (miss, run, boundary, etc.)
5. Scene updates with animation and feedback

---

## Design Philosophy

* Prioritize **responsiveness over realism**
* Use **simple heuristics** instead of complex physics
* Tolerate noisy input and “forgive” imperfect swings
* Make interactions feel satisfying quickly

---

## Key Challenges

* Sensor noise and inconsistent motion data
* Detecting intentional swings vs random movement
* Mapping motion to intuitive cricket shots
* Maintaining low latency across devices

---

## Non-Goals (for v1)

* Perfect physics simulation
* Advanced graphics or stadium environments
* Multiplayer or online matchmaking
* Machine learning-based gesture recognition

---

## Future Extensions

* Add timing-based scoring system
* Introduce different bowling types
* Improve shot classification with ML
* Add sound, UI, and visual polish
* Support multiplayer or leaderboard system

---

## Success Criteria (v1 Prototype)

* Motion data successfully streams from phone to browser
* Swing gestures are reliably detected
* Different shot types can be triggered
* Basic visual feedback is displayed in the 3D scene

---

## Guiding Principle

This is an interaction-first project.
If the swing feels good, the game works.
