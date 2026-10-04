// NutriBite progress page: unlimited days of calorie intake
(() => {
  const $ = (s) => document.querySelector(s);
  const goalInput = $("#goal");
  goalInput.value = NB.getGoal();

  $("#saveGoal").addEventListener("click", () => {
    const g = Math.max(800, Math.min(6000, Number(goalInput.value) || 2000));
    NB.setGoal(g); goalInput.value = g; render(); NB.toast(`🎯 Daily goal set to ${g} kcal`);
  });
  $("#clearBtn").addEventListener("click", () => {
    if (confirm("Clear all logged foods and start again from Day 1?")) { NB.clearAll(); render(); NB.toast("History cleared"); }
  });

  function render() {
    const goal = NB.getGoal(), cur = NB.currentDay();
    const days = NB.activeDays();
    const totals = Object.fromEntries(days.map((d) => [d, NB.dayTotals(d)]));
    const logged = days.filter((d) => totals[d].calories > 0);
    const sum = logged.reduce((s, d) => s + totals[d].calories, 0);
    const avg = logged.length ? Math.round(sum / logged.length) : 0;
    const today = totals[cur];

    $("#summary").innerHTML = `
      <div class="sum dark"><small>Today · Day ${cur}</small><strong>${today.calories.toLocaleString()}</strong><span>of ${goal} kcal goal</span></div>
      <div class="sum"><small>Daily average</small><strong>${avg.toLocaleString()}</strong><span>kcal per logged day</span></div>
      <div class="sum"><small>Days logged</small><strong>${logged.length}</strong><span>since Day 1</span></div>
      <div class="sum"><small>Foods scanned</small><strong>${NB.getLog().length}</strong><span>all time</span></div>`;

    // Last 7 days chart (ending today)
    const first = Math.max(1, cur - 6), range = [];
    for (let d = first; d <= cur; d++) range.push(d);
    const max = Math.max(goal * 1.15, ...range.map((d) => NB.dayTotals(d).calories));
    $("#chart").innerHTML = `<div class="plot"><div class="goal-line" style="bottom:${(goal / max) * 100}%"><span>Goal ${goal}</span></div>` +
      range.map((d) => {
        const c = NB.dayTotals(d).calories;
        return `<div class="col" data-day="${d}" title="Day ${d}: ${c} kcal">
          <div class="b ${c > goal ? "over" : ""}" data-h="${(c / max) * 100}">${c ? `<span class="v">${c}</span>` : ""}</div></div>`;
      }).join("") + `</div><div class="labels">${range.map((d) => `<small>Day ${d}</small>`).join("")}</div>`;
    requestAnimationFrame(() => setTimeout(() => document.querySelectorAll(".chart .b").forEach((b) => (b.style.height = b.dataset.h + "%")), 60));
    document.querySelectorAll(".chart .col").forEach((c) => c.addEventListener("click", () => {
      const card = document.getElementById(`day${c.dataset.day}`);
      if (card) { card.scrollIntoView({ behavior: "smooth", block: "center" }); card.classList.remove("flash"); void card.offsetWidth; card.classList.add("flash"); }
    }));

    // Day cards (newest first)
    const wrap = $("#days");
    wrap.innerHTML = "";
    [...days].reverse().forEach((d) => {
      const t = totals[d], over = t.calories > goal, isToday = d === cur;
      const card = document.createElement("div");
      card.id = `day${d}`;
      card.className = `day-card reveal in ${isToday ? "today" : ""}`;
      card.innerHTML = `
        <div class="day-head"><div><h3>Day ${d}</h3><small>${NB.fmtDate(NB.dateOfDay(d))}</small></div>
          <span class="badge ${isToday ? "green" : over ? "" : "dark"}" ${over ? 'style="background:#fee2e2;color:#b91c1c"' : ""}>${isToday ? "Today" : over ? "Over goal" : "Logged"}</span></div>
        <div class="day-body">
          <div class="ring-wrap">${NB.ring({ size: 118, stroke: 11, id: `r${d}`, over })}
            <div class="ring-center"><div><strong id="c${d}">0</strong><span>kcal</span></div></div></div>
          <div class="mini-macros">
            <div><span>Protein</span><b style="color:var(--protein)">${t.protein}g</b></div>
            <div><span>Carbs</span><b style="color:var(--carbs)">${t.carbs}g</b></div>
            <div><span>Fat</span><b style="color:var(--fat)">${t.fat}g</b></div>
          </div>
        </div>
        <ul class="day-foods">${t.items.length
          ? t.items.map((e) => `<li><span class="nm">${NB.esc(e.name)}<br><span class="tm">${NB.fmtTime(e.ts)}</span></span><span class="kc">${e.calories} kcal</span><button data-del="${e.id}" title="Remove">✕</button></li>`).join("")
          : `<li class="empty">No foods scanned yet</li>`}</ul>
        ${isToday ? `<a class="day-add" href="scan.html">＋ Scan food for Day ${d}</a>` : ""}`;
      wrap.appendChild(card);
      NB.setRing(card.querySelector(`#r${d}`), t.calories / goal);
      NB.countUp(card.querySelector(`#c${d}`), t.calories);
    });
    wrap.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => { NB.deleteEntry(+b.dataset.del); render(); NB.toast("Food removed"); }));
  }
  render();
})();
