// NutriBite results page: calories, nutrients, advantages and disadvantages
(() => {
  const root = document.getElementById("results");
  const r = NB.loadResult();

  const actions = `
    <div class="res-actions">
      <a href="scan.html?mode=camera" class="btn btn-dark">📷 Scan Another Food</a>
      <a href="scan.html?mode=upload" class="btn btn-light">🖼️ Upload Another Photo</a>
      <a href="progress.html" class="btn btn-light">📅 My Progress</a>
      <a href="index.html" class="btn btn-light">🏠 Return Home</a>
    </div>`;

  if (!r) {
    root.innerHTML = `<div class="empty-state"><div class="big">🍽️</div><h2>No scan yet</h2>
      <p style="color:var(--muted);margin:8px 0 10px">Scan or upload a food photo to see its calories and nutrients.</p>${actions}</div>`;
    return;
  }

  const n = (v) => Math.round(Number(v) || 0);
  const m = r.macros || {};
  const cal = n(r.calories), goal = NB.getGoal();
  const dayTotal = NB.dayTotals(r.day).calories;
  const score = Math.max(1, Math.min(10, n(r.healthScore) || 5));
  const scoreEmoji = score >= 8 ? "🟢" : score >= 5 ? "🟡" : "🔴";

  const macros = [
    { key: "protein", label: "Protein", color: "var(--protein)", dv: 50 },
    { key: "carbs", label: "Carbs", color: "var(--carbs)", dv: 275 },
    { key: "fat", label: "Fat", color: "var(--fat)", dv: 78 },
    { key: "fiber", label: "Fiber", color: "var(--fiber)", dv: 28 },
    { key: "sugar", label: "Sugar", color: "var(--sugar)", dv: 50 },
  ];
  const pK = n(m.protein) * 4, cK = n(m.carbs) * 4, fK = n(m.fat) * 9, totK = pK + cK + fK || 1;
  const pct = (x) => Math.round((x / totK) * 100);
  const list = (arr) => (arr || []).map((t) => `<li>${NB.esc(t)}</li>`).join("");
  const pros = r.pros?.length ? r.pros : ["Provides energy and essential nutrients."];
  const cons = r.cons?.length ? r.cons : ["Enjoy in moderation as part of a balanced diet."];

  root.innerHTML = `
    <div class="res-top">
      <div>
        <span class="badge green">✅ Scan complete · logged to Day ${r.day}</span>
        <h1 style="margin-top:12px">${NB.esc(r.foodName || "Your food")}</h1>
        <p>${NB.esc(r.description || "")}</p>
      </div>
      <a href="scan.html?mode=camera" class="btn btn-dark btn-sm">📷 Scan another</a>
    </div>

    <div class="res-grid">
      <div class="panel res-image">
        <img src="${r.image}" alt="${NB.esc(r.foodName)}" />
        <div class="res-meta">
          ${r.servingSize ? `<span class="badge">🍽️ ${NB.esc(r.servingSize)}</span>` : ""}
          ${r.confidence ? `<span class="badge green">🎯 ${n(r.confidence)}% confidence</span>` : ""}
          ${r.model ? `<span class="badge">🤖 ${NB.esc(r.model.split("/").pop())}</span>` : ""}
        </div>
      </div>
      <div>
        <div class="panel res-cal">
          <div class="ring-wrap">${NB.ring({ size: 180, stroke: 16, id: "calRing", over: cal > goal })}
            <div class="ring-center"><div><strong id="calNum">0</strong><span>calories</span></div></div></div>
          <div>
            <h2>Total Calories</h2>
            <p>This is <strong>${Math.round((cal / goal) * 100)}%</strong> of your ${goal} kcal daily goal. Day ${r.day} total so far: <strong>${dayTotal} kcal</strong>.</p>
            <span class="badge dark">${scoreEmoji} Health score ${score}/10</span>
          </div>
        </div>
        <div class="macro-cards">
          ${macros.map((x) => `<div class="macro">
            <div class="val" style="color:${x.color}"><span data-count="${n(m[x.key])}">0</span>g</div>
            <div class="lbl">${x.label}</div>
            <div class="bar"><i style="background:${x.color}" data-w="${Math.min(100, (n(m[x.key]) / x.dv) * 100)}"></i></div></div>`).join("")}
        </div>
      </div>
    </div>

    <div class="grid2">
      <div class="pc pro"><h3><span class="dot">✓</span>Advantages</h3><ul class="pc-list">${list(pros)}</ul></div>
      <div class="pc con"><h3><span class="dot">!</span>Disadvantages</h3><ul class="pc-list">${list(cons)}</ul></div>
    </div>

    <div class="grid2">
      <div class="panel">
        <h3>🧪 Nutrients &amp; minerals</h3>
        <div class="micro-grid">
          ${(r.micros || []).map((x) => `<div class="micro"><span>${NB.esc(x.name)}</span><strong>${n(x.amount)} ${NB.esc(x.unit || "")}</strong></div>`).join("") || `<p style="color:var(--muted)">No micronutrient data available.</p>`}
        </div>
        <h3 style="margin-top:22px">⚖️ Calorie breakdown</h3>
        <div class="macro-split">
          <i style="background:var(--protein);width:${pct(pK)}%"></i><i style="background:var(--carbs);width:${pct(cK)}%"></i><i style="background:var(--fat);width:${pct(fK)}%"></i>
        </div>
        <div class="legend"><span style="--c:var(--protein)">Protein ${pct(pK)}%</span><span style="--c:var(--carbs)">Carbs ${pct(cK)}%</span><span style="--c:var(--fat)">Fat ${pct(fK)}%</span></div>
      </div>
      <div class="panel">
        <h3>🥘 Detected items</h3>
        <ul class="items-list">
          ${(r.items || []).map((x) => `<li><span>${NB.esc(x.name)}</span><strong>${n(x.calories)} kcal</strong></li>`).join("") || `<li><span>${NB.esc(r.foodName)}</span><strong>${cal} kcal</strong></li>`}
        </ul>
        ${(r.tips || []).length ? `<h3 style="margin-top:22px">💡 Healthy tips</h3><ul class="tips-list">${list(r.tips)}</ul>` : ""}
      </div>
    </div>

    <p class="logged-note">📈 Added to your Day ${r.day} calorie intake</p>
    ${actions}`;

  NB.setRing(document.getElementById("calRing"), cal / goal);
  NB.countUp(document.getElementById("calNum"), cal, 1300);
  document.querySelectorAll("[data-count]").forEach((el) => NB.countUp(el, +el.dataset.count));
  setTimeout(() => document.querySelectorAll(".bar i").forEach((el) => (el.style.width = el.dataset.w + "%")), 150);
})();
