// BiteLens – Bespoke 3D Interactive Ambient Scanner Field
// Renders an interactive 3D spatial field with perspective-projected scanner rings,
// nutrient nodes, and smooth mouse/touch parallax. Pure vanilla canvas, 60fps, zero bloat.
(() => {
  const canvas = document.getElementById("bg3d");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  let width = 0, height = 0, dpr = 1;
  let targetRotX = 0, targetRotY = 0;
  let rotX = 0, rotY = 0;
  let isVisible = true;
  let animId = null;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = canvas.parentElement ? canvas.parentElement.offsetWidth : window.innerWidth;
    height = canvas.parentElement ? canvas.parentElement.offsetHeight : window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
  }
  resize();
  window.addEventListener("resize", resize, { passive: true });

  // Mouse & touch parallax
  function onMove(e) {
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    const normX = (x / window.innerWidth) * 2 - 1;
    const normY = (y / window.innerHeight) * 2 - 1;
    targetRotY = normX * 0.35; // yaw
    targetRotX = -normY * 0.25; // pitch
  }
  window.addEventListener("mousemove", onMove, { passive: true });
  window.addEventListener("touchmove", onMove, { passive: true });

  // 3D Spatial Particles (Nutrient & Energy Nodes)
  const NODE_COUNT = 45;
  const nodes = [];
  for (let i = 0; i < NODE_COUNT; i++) {
    nodes.push({
      x: (Math.random() - 0.5) * 1100,
      y: (Math.random() - 0.5) * 700,
      z: (Math.random() - 0.5) * 800,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      vz: (Math.random() - 0.5) * 0.4,
      radius: Math.random() * 2.2 + 1.2,
      color: Math.random() > 0.6 ? "rgba(34, 197, 94, " : Math.random() > 0.5 ? "rgba(16, 185, 129, " : "rgba(59, 130, 246, "
    });
  }

  // 3D Scanner Rings (Concentric Aperture Scanner)
  const rings = [
    { radius: 180, tiltX: 0.8, tiltZ: 0.3, speed: 0.006, angle: 0, dash: [8, 12], color: "rgba(34, 197, 94, 0.22)" },
    { radius: 260, tiltX: -0.6, tiltZ: 0.5, speed: -0.004, angle: 0, dash: [4, 8], color: "rgba(16, 185, 129, 0.16)" },
    { radius: 340, tiltX: 0.4, tiltZ: -0.7, speed: 0.003, angle: 0, dash: [12, 18], color: "rgba(59, 130, 246, 0.14)" }
  ];

  const FOCAL = 650; // Camera focal length for 3D projection

  function project(x, y, z) {
    // Apply 3D rotation
    // 1. Rotate around Y (yaw)
    const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
    const x1 = x * cosY + z * sinY;
    const z1 = -x * sinY + z * cosY;

    // 2. Rotate around X (pitch)
    const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
    const y2 = y * cosX - z1 * sinX;
    const z2 = y * sinX + z1 * cosX;

    const scale = FOCAL / (FOCAL + z2 + 500);
    return {
      x: (width / 2) + x1 * scale,
      y: (height / 2) + y2 * scale,
      scale: Math.max(0, scale),
      z: z2
    };
  }

  let time = 0;
  function render() {
    if (!isVisible) return;
    time += 0.016;

    // Damped interpolation for rotation
    rotX += (targetRotX - rotX) * 0.06;
    rotY += (targetRotY - rotY) * 0.06;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Draw volumetric ambient glow in 3D center
    const centerProj = project(0, 0, 0);
    const rad = 280 * centerProj.scale;
    if (rad > 10) {
      const grad = ctx.createRadialGradient(centerProj.x, centerProj.y, 0, centerProj.x, centerProj.y, rad);
      grad.addColorStop(0, "rgba(34, 197, 94, 0.09)");
      grad.addColorStop(0.5, "rgba(16, 185, 129, 0.04)");
      grad.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(centerProj.x, centerProj.y, rad, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Draw 3D Holographic Scanner Rings
    rings.forEach((ring) => {
      ring.angle += ring.speed;
      ctx.save();
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = 1.2;
      ctx.setLineDash(ring.dash);

      ctx.beginPath();
      const SEGMENTS = 48;
      for (let i = 0; i <= SEGMENTS; i++) {
        const theta = (i / SEGMENTS) * Math.PI * 2 + ring.angle;
        // Point on 3D circle tilted in space
        const rx = ring.radius * Math.cos(theta);
        const rz = ring.radius * Math.sin(theta);
        // Tilt
        const y3d = -rz * Math.sin(ring.tiltX);
        const z3d = rz * Math.cos(ring.tiltX);
        const x3d = rx * Math.cos(ring.tiltZ) - y3d * Math.sin(ring.tiltZ);
        const yFinal = rx * Math.sin(ring.tiltZ) + y3d * Math.cos(ring.tiltZ);

        const p = project(x3d, yFinal, z3d);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.restore();
    });

    // 3. Update & Project Nodes
    const projected = [];
    nodes.forEach((n) => {
      n.x += n.vx;
      n.y += n.vy;
      n.z += n.vz;

      // Wrap boundaries in 3D
      if (n.x > 550) n.x = -550; if (n.x < -550) n.x = 550;
      if (n.y > 350) n.y = -350; if (n.y < -350) n.y = 350;
      if (n.z > 400) n.z = -400; if (n.z < -400) n.z = 400;

      const p = project(n.x, n.y, n.z);
      projected.push({ p, node: n });
    });

    // 4. Draw connecting proximity energy lines
    ctx.lineWidth = 0.7;
    for (let i = 0; i < projected.length; i++) {
      for (let j = i + 1; j < projected.length; j++) {
        const a = projected[i], b = projected[j];
        const dx = a.p.x - b.p.x;
        const dy = a.p.y - b.p.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 110) {
          const alpha = (1 - d / 110) * 0.18 * Math.min(a.p.scale, b.p.scale);
          ctx.strokeStyle = `rgba(34, 197, 94, ${alpha})`;
          ctx.beginPath();
          ctx.moveTo(a.p.x, a.p.y);
          ctx.lineTo(b.p.x, b.p.y);
          ctx.stroke();
        }
      }
    }

    // 5. Draw 3D Nodes
    projected.forEach(({ p, node }) => {
      const alpha = Math.max(0.15, Math.min(0.85, (p.z + 400) / 800));
      ctx.fillStyle = node.color + alpha + ")";
      ctx.beginPath();
      ctx.arc(p.x, p.y, node.radius * p.scale, 0, Math.PI * 2);
      ctx.fill();

      // Subtle glow on nearest nodes
      if (p.scale > 1.1) {
        ctx.fillStyle = node.color + (alpha * 0.3) + ")";
        ctx.beginPath();
        ctx.arc(p.x, p.y, node.radius * p.scale * 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    ctx.restore();
    animId = requestAnimationFrame(render);
  }

  // Auto-pause when off-screen to preserve battery and 60fps
  const obs = new IntersectionObserver(([entry]) => {
    isVisible = entry.isIntersecting;
    if (isVisible && !animId) animId = requestAnimationFrame(render);
    else if (!isVisible && animId) { cancelAnimationFrame(animId); animId = null; }
  }, { threshold: 0.05 });
  obs.observe(canvas);

  animId = requestAnimationFrame(render);
})();
