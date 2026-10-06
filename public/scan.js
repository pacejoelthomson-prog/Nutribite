// NutriBite scan page: camera scanner, photo upload fallback, AI analysis
(() => {
  const $ = (s) => document.querySelector(s);
  const video = $("#video"), canvas = $("#canvas"), camMsg = $("#camMsg"), liveLine = $("#liveLine");
  const btnCapture = $("#capture"), btnFlip = $("#flipCam"), btnStop = $("#stopCam");
  const fileInput = $("#fileInput"), dropzone = $("#dropzone");
  const loading = $("#loading"), loadingText = $("#loadingText");
  let stream = null, facing = "environment";

  function setTab(name) {
    document.querySelectorAll(".seg button").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
    $("#cameraPane").hidden = name !== "camera";
    $("#uploadPane").hidden = name !== "upload";
    if (name === "upload") stopCamera();
  }
  document.querySelectorAll(".seg button").forEach((t) => t.addEventListener("click", () => setTab(t.dataset.tab)));

  function showMsg(icon, text, action) {
    camMsg.hidden = false;
    camMsg.innerHTML = `<div><div class="big">${icon}</div><p>${text}</p>
      ${action ? `<button class="btn btn-green btn-sm" data-act="${action.key}">${action.label}</button>` : ""}</div>`;
    camMsg.querySelector("[data-act=start]")?.addEventListener("click", startCamera);
    camMsg.querySelector("[data-act=upload]")?.addEventListener("click", () => setTab("upload"));
  }
  const idle = () => showMsg("📸", "Allow camera access to scan your food live.", { key: "start", label: "Start Camera" });

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      showMsg("🚫", "Camera isn't available here (it needs HTTPS or localhost). Upload a photo instead.", { key: "upload", label: "Upload a Photo" });
      return NB.toast("Scanner not available — please upload a photo.", "error");
    }
    stopCamera(true);
    showMsg("⏳", "Starting camera…");
    try {
      const constraints = {
        video: { facingMode: { ideal: facing } },
        audio: false
      };
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = stream;

      await new Promise((resolve) => {
        if (video.readyState >= 2) return resolve();
        video.onloadeddata = () => resolve();
        setTimeout(resolve, 1200);
      });

      try {
        await video.play();
      } catch (e) {
        console.warn("video.play() warning:", e);
      }

      video.hidden = false;
      camMsg.hidden = true;
      liveLine.hidden = false;
      btnCapture.disabled = btnFlip.disabled = btnStop.disabled = false;
    } catch (err) {
      console.warn("Camera access failed:", err);
      showMsg("😕", "We couldn't access your camera. You can upload a photo of your food instead.", { key: "upload", label: "Upload a Photo" });
      NB.toast("Scanner not working — try uploading a photo.", "error");
    }
  }
  function stopCamera(silent) {
    stream?.getTracks().forEach((t) => t.stop()); stream = null;
    video.hidden = true; liveLine.hidden = true;
    btnCapture.disabled = btnFlip.disabled = btnStop.disabled = true;
    if (!silent) idle();
  }
  btnStop.addEventListener("click", () => stopCamera());
  btnFlip.addEventListener("click", () => { facing = facing === "environment" ? "user" : "environment"; startCamera(); });
  btnCapture.addEventListener("click", () => {
    if (!stream) return;
    const img = toDataUrl(video, video.videoWidth, video.videoHeight);
    stopCamera(true); analyze(img);
  });

  fileInput.addEventListener("change", () => fileInput.files[0] && handleFile(fileInput.files[0]));
  ["dragenter", "dragover"].forEach((ev) => dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.add("drag"); }));
  ["dragleave", "drop"].forEach((ev) => dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.remove("drag"); }));
  dropzone.addEventListener("drop", (e) => e.dataTransfer.files[0] && handleFile(e.dataTransfer.files[0]));

  function handleFile(file) {
    if (!file.type.startsWith("image/")) return NB.toast("Please choose an image file.", "error");
    const img = new Image();
    img.onload = () => { analyze(toDataUrl(img, img.naturalWidth, img.naturalHeight)); URL.revokeObjectURL(img.src); };
    img.onerror = () => NB.toast("Couldn't read that image. Try a JPG or PNG.", "error");
    img.src = URL.createObjectURL(file);
    fileInput.value = "";
  }
  function toDataUrl(src, w, h, max = 1024) {
    const s = Math.min(1, max / Math.max(w, h));
    canvas.width = Math.round(w * s); canvas.height = Math.round(h * s);
    canvas.getContext("2d").drawImage(src, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  }

  const steps = ["Identifying ingredients", "Estimating portion size", "Calculating calories", "Measuring nutrients", "Weighing pros & cons"];
  async function analyze(image) {
    loading.classList.add("show");
    let i = 0; loadingText.textContent = steps[0];
    const timer = setInterval(() => { i = Math.min(i + 1, steps.length - 1); loadingText.textContent = steps[i]; }, 1600);
    try {
      const res = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Server error (${res.status})`);
      if (data.isFood === false) throw new Error(data.message || "No food detected. Try another photo.");
      const entry = NB.addEntry(data);
      NB.saveResult({ ...data, image, day: entry.day, entryId: entry.id, scannedAt: entry.ts });
      location.href = "results.html";
    } catch (err) {
      console.error(err);
      NB.toast(`⚠️ ${err.message}`, "error");
      loading.classList.remove("show");
      if (!stream) idle();
    } finally { clearInterval(timer); }
  }

  idle();
  const mode = new URLSearchParams(location.search).get("mode");
  if (mode === "upload") setTab("upload"); else if (mode === "camera") startCamera();
  addEventListener("pagehide", () => stopCamera(true));
})();
