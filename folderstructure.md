# Monorepo Structure: Motion-Controlled Cricket Game

## Root Structure

```
motion-cricket/
│
├── frontend/        # Browser game (Three.js)
├── backend/         # WebSocket relay server (Node.js)
├── mobile/          # Flutter app (motion controller)
│
├── shared/          # Shared types, constants, protocols
├── docs/            # Architecture, notes, experiments
│
├── package.json     # (optional, if using monorepo tools)
├── README.md
└── .gitignore
```

---

## 1. frontend/ (Three.js Game)

```
frontend/
│
├── public/
│   └── index.html
│
├── src/
│   ├── main.js              # entry point
│   ├── scene/
│   │   ├── setupScene.js    # camera, lights, renderer
│   │   ├── bat.js           # bat object + animation
│   │   └── ball.js          # ball logic
│   │
│   ├── network/
│   │   └── socket.js        # WebSocket client
│   │
│   ├── input/
│   │   ├── motionBuffer.js  # stores recent sensor data
│   │   └── swingDetector.js # detects swings
│   │
│   ├── gameplay/
│   │   ├── shotMapper.js    # maps motion → shot type
│   │   └── gameLoop.js      # main gameplay loop
│   │
│   └── utils/
│       └── math.js
│
├── package.json
└── vite.config.js (or webpack)
```

**Responsibility**

* Render game (via Three.js)
* Receive motion data
* Detect swings
* Trigger visuals

---

## 2. backend/ (WebSocket Relay)

```
backend/
│
├── src/
│   ├── server.js        # entry point
│   ├── socketHandler.js # connection + routing logic
│   └── clients.js       # manage connected devices
│
├── package.json
└── .env
```

**Responsibility**

* Relay messages between:

  * phone (controller)
  * browser (game)
* No heavy logic (keep it dumb)

---

## 3. mobile/ (Flutter Controller)

```
mobile/
│
├── lib/
│   ├── main.dart
│   │
│   ├── sensors/
│   │   └── motion_service.dart   # accelerometer + gyro
│   │
│   ├── network/
│   │   └── socket_service.dart   # WebSocket sender
│   │
│   ├── models/
│   │   └── motion_data.dart      # data format
│   │
│   └── ui/
│       └── home_screen.dart      # start/stop + debug
│
├── pubspec.yaml
```

**Responsibility**

* Capture motion data
* Send to backend at ~60 Hz
* Provide simple UI (connect/disconnect)

---

## 4. shared/ (important, don’t skip)

```
shared/
│
├── protocol/
│   └── motion.schema.json
│
├── constants/
│   └── thresholds.js
│
└── README.md
```

**Why this matters**

* Keeps frontend + mobile in sync
* Prevents “why is this breaking?” bugs later

---

## 5. docs/

```
docs/
│
├── architecture.md
├── motion-detection.md
├── experiments/
│   └── swing-tests.md
```

---

## Data Flow (clean separation)

```id="e3zvbb"
mobile → backend → frontend
```

* mobile = producer
* backend = relay
* frontend = consumer + logic

---

## Dev workflow (simple)

1. Start backend

   ```bash
   cd backend
   npm install
   node src/server.js
   ```

2. Start frontend

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. Run Flutter app

---

## Naming conventions

* `motion_*` → raw sensor data
* `swing_*` → detected events
* `shot_*` → gameplay output

---

## Future-proofing decisions

* Keep backend stateless → easier scaling later
* Keep motion logic in frontend → faster iteration
* Keep shared schema → avoids mismatch bugs

---

## Minimal v1 focus

Ignore:

* auth
* database
* multiplayer sync

Just make:
👉 “swing → shot on screen”

---

## Guiding rule

Each layer should do **one job only**:

* mobile = send data
* backend = pass data
* frontend = decide everything
