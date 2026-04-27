const HIT_WINDOW_Z_START = -6.0; // Greatly widened for forgiveness
const HIT_WINDOW_Z_END = 6.0; 
const PERFECT_WINDOW_START = -1.5;
const PERFECT_WINDOW_END = 2.5;

export function handleShot(swingEvent, ballZ, isBallActive, bat) {
  const resultEl = document.getElementById('shotResult');

  let [dx, dy, dz] = swingEvent.direction_vector;
  
  // Smooth direction classification (forgiveness)
  if (Math.abs(dx) < 0.3) dx = 0;
  if (Math.abs(dy) < 0.3) dy = 0;
  if (Math.abs(dz) < 0.3) dz = 0;

  let shotType = "Basic Drive";
  let shot_hint = "";
  
  if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > Math.abs(dz)) {
      shotType = dx > 0 ? "Cut Shot!" : "Pull Shot!";
      shot_hint = dx > 0 ? "right" : "left";
  } else if (Math.abs(dy) > Math.abs(dz)) {
      shotType = dy > 0 ? "Forward Drive!" : "Backfoot Defense";
      shot_hint = dy > 0 ? "forward" : "back";
  } else {
      shotType = dz > 0 ? "Loft Shot!" : "Straight Drive";
      shot_hint = dz > 0 ? "up" : "down";
  }

  // Clamp power between 0.2 and 1.0 so even soft swings feel somewhat ok
  let rawPower = Math.max(0.2, Math.min(1.0, swingEvent.power));
  const powerPct = Math.round(rawPower * 100);

  if (!isBallActive) {
    //   console.log(`Practice Swing! Power: ${powerPct}%, Dir: [${dx.toFixed(2)}, ${dy.toFixed(2)}, ${dz.toFixed(2)}], Type: ${shotType}`);
      resultEl.innerText = `Practice: ${shotType} (${powerPct}% pwr)`;
      resultEl.style.color = "white";
      return { isHit: false, practice: true, shotType, powerPct, direction_vector: [dx, dy, dz] };
  }

  let hitResult = { isHit: false, practice: false, shotType, powerPct, direction_vector: [dx, dy, dz], timing: "miss", runs: 0 };

  if (ballZ >= HIT_WINDOW_Z_START && ballZ <= HIT_WINDOW_Z_END) {
     hitResult.isHit = true;

     if (ballZ >= PERFECT_WINDOW_START && ballZ <= PERFECT_WINDOW_END) {
        hitResult.timing = "perfect";
        resultEl.style.color = "white";
     } else {
        hitResult.timing = ballZ < PERFECT_WINDOW_START ? "early" : "late";
        resultEl.style.color = "yellow"; 
     }

     // Calculate Runs based on timing and power
     if (powerPct > 80 && hitResult.timing === "perfect") {
         hitResult.runs = 6;
     } else if (powerPct > 60 && (hitResult.timing === "perfect" || hitResult.timing === "early")) {
         hitResult.runs = 4;
     } else if (powerPct > 40) {
         hitResult.runs = 2;
     } else {
         hitResult.runs = 1;
     }

     resultEl.innerText = `${hitResult.runs} Runs! (${shotType})`;

  } else if (ballZ > HIT_WINDOW_Z_END) {
     resultEl.innerText = "Too Late!";
     resultEl.style.color = "orange";
     hitResult.timing = "late";
  } else if (ballZ < HIT_WINDOW_Z_START) {
     resultEl.innerText = "Too Early!";
     resultEl.style.color = "orange";
     hitResult.timing = "early";
  }
  
//   console.log(`Swing! Power: ${powerPct}%, Dir: [${dx.toFixed(2)}, ${dy.toFixed(2)}, ${dz.toFixed(2)}], Type: ${shotType}, Hit: ${hitResult.isHit}, Timing: ${hitResult.timing}, Runs: ${hitResult.runs}`);
  return hitResult;
}
