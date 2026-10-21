// BiteLens results page: calories, nutrients, advantages and disadvantages
(() => {
  const root = document.getElementById("results");
  const r = NB.loadResult();

  const actions = `
    <div class="res-actions">
      <a href="scan.html?mode=camera" class="btn btn-dark"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:6px"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>Scan Another Food</a>
      <a href="scan.html?mode=upload" class="btn btn-light"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:6px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>Upload Another Photo</a>
      <a href="progress.html" class="btn btn-light"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:6px"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>My Progress</a>
      <a href="index.html" class="btn btn-light"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:6px"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>Return Home</a>
    </div>`;

  if (!r) {
    root.innerHTML = `<div class="empty-state"><div class="big"><svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path><path d="M2 12h20"></path></svg></div><h2>No scan yet</h2>
      <p style="color:var(--muted);margin:8px 0 10px">Scan or upload a food photo to see its calories and nutrients.</p>${actions}</div>`;
    return;
  }

  const n = (v) => Math.round(Number(v) || 0);
  const m = r.macros || {};
  const cal = n(r.calories), goal = NB.getGoal();
  const dayTotal = NB.dayTotals(r.day).calories;
  const score = Math.max(1, Math.min(10, n(r.healthScore) || 5));
  const scoreColor = score >= 8 ? "var(--green)" : score >= 5 ? "#eab308" : "#ef4444";

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
        <span class="badge green"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:4px"><polyline points="20 6 9 17 4 12"></polyline></svg>Scan complete · logged to Day ${r.day}</span>
        <h1 style="margin-top:12px">${NB.esc(r.foodName || "Your food")}</h1>
        <p>${NB.esc(r.description || "")}</p>
      </div>
      <a href="scan.html?mode=camera" class="btn btn-dark btn-sm"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>Scan another</a>
    </div>

    <div class="res-grid">
      <div class="panel res-image">
        <img src="${r.image}" alt="${NB.esc(r.foodName)}" />
        <div class="res-meta">
          ${r.servingSize ? `<span class="badge"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px;margin-right:4px"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 3"></path></svg>${NB.esc(r.servingSize)}</span>` : ""}
          ${r.confidence ? `<span class="badge green"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px;margin-right:4px"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>${n(r.confidence)}% confidence</span>` : ""}
          ${r.model ? `<span class="badge"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px;margin-right:4px"><rect x="4" y="4" width="16" height="16" rx="2"></rect><rect x="9" y="9" width="6" height="6"></rect></svg>${NB.esc(r.model.split("/").pop())}</span>` : ""}
        </div>
      </div>
      <div>
        <div class="panel res-cal">
          <div class="ring-wrap">${NB.ring({ size: 210, stroke: 16, id: "calRing", over: cal > goal })}
            <div class="ring-center">
              <div class="ring-metric">
                <div id="calNum" class="cal-number">${Math.round(cal).toLocaleString()}</div>
                <div class="cal-unit">calories</div>
              </div>
            </div>
          </div>
          <div>
            <h2>Total Calories</h2>
            <p>This is <strong>${Math.round((cal / goal) * 100)}%</strong> of your ${goal} kcal daily goal. Day ${r.day} total so far: <strong>${dayTotal} kcal</strong>.</p>
            <span class="badge dark"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${scoreColor};margin-right:6px"></span>Health score ${score}/10</span>
          </div>
        </div>
        <div class="macro-cards">
          ${macros.map((x) => `<div class="macro">
            <div class="val" style="color:${x.color}">${n(m[x.key])}g</div>
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
        <h3><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:6px"><path d="M10 2v7.31"></path><path d="M14 9.3V2"></path><path d="M8.5 2h7"></path><path d="M14 9.3a6.5 6.5 0 1 1-4 0"></path><path d="M5.52 16h12.96"></path></svg>Nutrients &amp; minerals</h3>
        <div class="micro-grid">
          ${(r.micros || []).map((x) => `<div class="micro"><span>${NB.esc(x.name)}</span><strong>${n(x.amount)} ${NB.esc(x.unit || "")}</strong></div>`).join("") || `<p style="color:var(--muted)">No micronutrient data available.</p>`}
        </div>
        <h3 style="margin-top:22px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:6px"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg>Calorie breakdown</h3>
        <div class="macro-split">
          <i style="background:var(--protein);width:${pct(pK)}%"></i><i style="background:var(--carbs);width:${pct(cK)}%"></i><i style="background:var(--fat);width:${pct(fK)}%"></i>
        </div>
        <div class="legend"><span style="--c:var(--protein)">Protein ${pct(pK)}%</span><span style="--c:var(--carbs)">Carbs ${pct(cK)}%</span><span style="--c:var(--fat)">Fat ${pct(fK)}%</span></div>
      </div>
      <div class="panel">
        <h3><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:6px"><path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line></svg>Detected items</h3>
        <ul class="items-list">
          ${(r.items || []).map((x) => `<li><span>${NB.esc(x.name)}</span><strong>${n(x.calories)} kcal</strong></li>`).join("") || `<li><span>${NB.esc(r.foodName)}</span><strong>${cal} kcal</strong></li>`}
        </ul>
        ${(r.tips || []).length ? `<h3 style="margin-top:22px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:6px"><path d="M9 18h6M10 22h4M15 9a3 3 0 1 0-6 0c0 1.5 1 2.5 1.5 3.5.5 1 .5 1.5.5 1.5h2s0-.5.5-1.5c.5-1 1.5-2 1.5-3.5z"></path></svg>Healthy tips</h3><ul class="tips-list">${list(r.tips)}</ul>` : ""}
      </div>
    </div>

    <p class="logged-note"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2" style="vertical-align:-2px;margin-right:6px"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>Added to your Day ${r.day} calorie intake</p>
    ${actions}`;

  NB.setRing(document.getElementById("calRing"), cal / goal);
  setTimeout(() => document.querySelectorAll(".bar i").forEach((el) => (el.style.width = el.dataset.w + "%")), 150);
})();
