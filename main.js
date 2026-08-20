/* ===== script block 1 of 5 ===== */
    (function () {
      const svg = document.getElementById('network');
      const W = 1600, H = 900;
      const NS = 'http://www.w3.org/2000/svg';

      // Seeded RNG so the network looks the same every load
      let seed = 7;
      const rand = () => { const x = Math.sin(seed++) * 10000; return x - Math.floor(x); };

      // ===== SVG element factories =====
      function makePath(d, opts = {}) {
        const p = document.createElementNS(NS, 'path');
        p.setAttribute('d', d);
        p.setAttribute('fill', 'none');
        p.setAttribute('stroke', opts.stroke || 'var(--river-deep)');
        p.setAttribute('stroke-width', opts.width || 1.5);
        p.setAttribute('stroke-linecap', 'round');
        p.setAttribute('stroke-linejoin', 'round');
        if (opts.opacity != null) p.setAttribute('opacity', opts.opacity);
        return p;
      }
      function makeCircle(x, y, r, opts = {}) {
        const c = document.createElementNS(NS, 'circle');
        c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', r);
        if (opts.fill) c.setAttribute('fill', opts.fill);
        if (opts.stroke) c.setAttribute('stroke', opts.stroke);
        if (opts.strokeWidth != null) c.setAttribute('stroke-width', opts.strokeWidth);
        if (opts.opacity != null) c.setAttribute('opacity', opts.opacity);
        return c;
      }
      function makeRect(cx, cy, size, opts = {}) {
        const r = document.createElementNS(NS, 'rect');
        r.setAttribute('x', cx - size / 2);
        r.setAttribute('y', cy - size / 2);
        r.setAttribute('width', size);
        r.setAttribute('height', size);
        r.setAttribute('fill', opts.fill || 'var(--river-deep)');
        if (opts.opacity != null) r.setAttribute('opacity', opts.opacity);
        return r;
      }

      // ===== Generate a polyline that crosses the canvas =====
      function pointOnEdge(edge, t) {
        const m = 60;
        if (edge === 'top')    return { x: m + t * (W - 2 * m), y: -20 };
        if (edge === 'bottom') return { x: m + t * (W - 2 * m), y: H + 20 };
        if (edge === 'left')   return { x: -20, y: m + t * (H - 2 * m) };
        return { x: W + 20, y: m + t * (H - 2 * m) }; // right
      }
      const allEdges = ['top', 'bottom', 'left', 'right'];

      function generateLineWaypoints() {
        // Pick two different edges, biased to produce diagonal-ish routes
        const startEdge = allEdges[Math.floor(rand() * 4)];
        let endEdge = allEdges[Math.floor(rand() * 4)];
        while (endEdge === startEdge) endEdge = allEdges[Math.floor(rand() * 4)];

        const start = pointOnEdge(startEdge, rand());
        const end = pointOnEdge(endEdge, rand());

        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const dist = Math.hypot(dx, dy) || 1;
        const perpX = -dy / dist;
        const perpY = dx / dist;

        // 3–6 internal bends per line
        const numBends = 3 + Math.floor(rand() * 4);
        const points = [start];
        for (let i = 0; i < numBends; i++) {
          const t = (i + 1) / (numBends + 1);
          const idealX = start.x + dx * t;
          const idealY = start.y + dy * t;
          // Perpendicular offset, tapered so bends are stronger in the middle
          const taper = 1 - Math.abs(t - 0.5) * 1.6;
          const offset = (rand() - 0.5) * 220 * Math.max(0.15, taper);
          points.push({ x: idealX + perpX * offset, y: idealY + perpY * offset });
        }
        points.push(end);
        return points;
      }

      // ===== Convert waypoints to an SVG path with rounded corners =====
      function waypointsToPathD(points) {
        if (points.length < 2) return '';
        const cornerRadius = 22;
        let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

        for (let i = 1; i < points.length - 1; i++) {
          const prev = points[i - 1];
          const cur = points[i];
          const next = points[i + 1];

          // Approach-side anchor
          const ax = prev.x - cur.x, ay = prev.y - cur.y;
          const aLen = Math.hypot(ax, ay) || 1;
          const r1 = Math.min(cornerRadius, aLen / 2);
          const inX = cur.x + (ax / aLen) * r1;
          const inY = cur.y + (ay / aLen) * r1;

          // Leave-side anchor
          const bx = next.x - cur.x, by = next.y - cur.y;
          const bLen = Math.hypot(bx, by) || 1;
          const r2 = Math.min(cornerRadius, bLen / 2);
          const outX = cur.x + (bx / bLen) * r2;
          const outY = cur.y + (by / bLen) * r2;

          d += ` L ${inX.toFixed(2)} ${inY.toFixed(2)}`;
          d += ` Q ${cur.x.toFixed(2)} ${cur.y.toFixed(2)} ${outX.toFixed(2)} ${outY.toFixed(2)}`;
        }

        const last = points[points.length - 1];
        d += ` L ${last.x.toFixed(2)} ${last.y.toFixed(2)}`;
        return d;
      }

      // ===== Build the line layer =====
      // Layers (in z-order): grid -> lines -> stations -> pulses
      const gridGroup = document.createElementNS(NS, 'g');
      const linesGroup = document.createElementNS(NS, 'g');
      const stationsGroup = document.createElementNS(NS, 'g');
      const pulseGroup = document.createElementNS(NS, 'g');

      svg.appendChild(gridGroup);
      svg.appendChild(linesGroup);
      svg.appendChild(stationsGroup);
      svg.appendChild(pulseGroup);

      // Faint dot grid (remote-sensing flavor)
      gridGroup.setAttribute('opacity', '0.14');
      const gridStep = 80;
      for (let gx = gridStep / 2; gx < W; gx += gridStep) {
        for (let gy = gridStep / 2; gy < H; gy += gridStep) {
          const dot = document.createElementNS(NS, 'circle');
          dot.setAttribute('cx', gx);
          dot.setAttribute('cy', gy);
          dot.setAttribute('r', 0.7);
          dot.setAttribute('fill', 'var(--ink-mute)');
          gridGroup.appendChild(dot);
        }
      }

      // Four color families: red, purple, blue, yellow.
      // Each has a "main" primary line and several "soft" secondary lines.
      const lineColors = [
        { main: 'var(--line-red)',    soft: 'var(--line-red-soft)',    pulse: 'var(--line-red-pulse)' },
        { main: 'var(--line-purple)', soft: 'var(--line-purple-soft)', pulse: 'var(--line-purple-pulse)' },
        { main: 'var(--line-blue)',   soft: 'var(--line-blue-soft)',   pulse: 'var(--line-blue-pulse)' },
        { main: 'var(--line-yellow)', soft: 'var(--line-yellow-soft)', pulse: 'var(--line-yellow-pulse)' },
      ];

      const NUM_LINES = 12;
      const lines = [];
      const lineTiers = [];

      for (let i = 0; i < NUM_LINES; i++) {
        const points = generateLineWaypoints();
        const d = waypointsToPathD(points);

        // First four are "primaries" — one per family.
        // Remaining lines cycle through families using the lighter "soft" shade.
        const colorIdx = i % 4;
        const family = lineColors[colorIdx];
        const isPrimary = i < 4;

        const stroke = isPrimary ? family.main : family.soft;
        const width = isPrimary ? 2.0 + rand() * 0.3 : 1.3 + rand() * 0.3;
        const opacity = isPrimary ? 0.7 : 0.45;
        const weight = isPrimary ? 3 : 1;

        const path = makePath(d, { stroke, width, opacity });
        linesGroup.appendChild(path);
        lines.push({
          el: path,
          weight,
          mainColor: stroke,
          pulseColor: family.pulse,
        });
        lineTiers.push(isPrimary ? 0 : 1);
      }

      // Deterministic line 1 — far left edge, blue family (calm anchor).
      {
        const pts = [
          { x: 55, y: -20 },
          { x: 105, y: 170 },
          { x: 70, y: 360 },
          { x: 130, y: 580 },
          { x: 80, y: H + 20 }
        ];
        const path = makePath(waypointsToPathD(pts), {
          stroke: 'var(--line-blue)',
          width: 1.9,
          opacity: 0.6,
        });
        linesGroup.appendChild(path);
        lines.push({ el: path, weight: 2, mainColor: 'var(--line-blue)', pulseColor: 'var(--line-blue-pulse)' });
        lineTiers.push(0);
      }

      // Deterministic line 2 — a curvy "/" diagonal sweeping from
      // the bottom-left up to the top-right. Built as a chain of
      // quadratic Beziers (Q + T) so the curve flows continuously
      // with gentle S-shaped undulations. Passes behind the hero card
      // mid-page. Purple family.
      {
        const d = `M -20 ${H + 20} ` +
                  `Q 80 840, 220 730 ` +
                  `T 400 570 ` +
                  `T 580 410 ` +
                  `T 760 260 ` +
                  `T 940 130 ` +
                  `T 1140 -20`;
        const path = makePath(d, {
          stroke: 'var(--line-purple)',
          width: 2.0,
          opacity: 0.65,
        });
        linesGroup.appendChild(path);
        lines.push({ el: path, weight: 3, mainColor: 'var(--line-purple)', pulseColor: 'var(--line-purple-pulse)' });
        lineTiers.push(0);
      }

      // Deterministic line 3 — Faint line passing behind the hero card
      {
        const pts = [
          { x: 300, y: -20 },
          { x: 350, y: 220 },
          { x: 280, y: 450 },
          { x: 380, y: 700 },
          { x: 320, y: H + 20 }
        ];
        const path = makePath(waypointsToPathD(pts), {
          stroke: 'var(--line-red-soft)',
          width: 1.2,
          opacity: 0.35,
        });
        linesGroup.appendChild(path);
        lines.push({ el: path, weight: 1, mainColor: 'var(--line-red-soft)', pulseColor: 'var(--line-red-pulse)' });
        lineTiers.push(1);
      }

      // Deterministic line 4 — Another faint vertical wave near the card
      {
        const pts = [
          { x: 480, y: -20 },
          { x: 420, y: 280 },
          { x: 520, y: 550 },
          { x: 460, y: 800 },
          { x: 500, y: H + 20 }
        ];
        const path = makePath(waypointsToPathD(pts), {
          stroke: 'var(--line-yellow-soft)',
          width: 1.2,
          opacity: 0.35,
        });
        linesGroup.appendChild(path);
        lines.push({ el: path, weight: 1, mainColor: 'var(--line-yellow-soft)', pulseColor: 'var(--line-yellow-pulse)' });
        lineTiers.push(1);
      }

      // Deterministic line 5 — Horizontal sweep pushed into the bottom third
      {
        const pts = [
          { x: -20, y: 750 },
          { x: 400, y: 720 },
          { x: 800, y: 800 },
          { x: 1200, y: 680 },
          { x: 1620, y: 750 }
        ];
        const path = makePath(waypointsToPathD(pts), {
          stroke: 'var(--line-blue-soft)',
          width: 1.4,
          opacity: 0.45,
        });
        linesGroup.appendChild(path);
        lines.push({ el: path, weight: 2, mainColor: 'var(--line-blue-soft)', pulseColor: 'var(--line-blue-pulse)' });
        lineTiers.push(1);
      }

      // ===== Stations: small filled squares spaced along each line =====
      // Each station inherits its color from the line it sits on.
      lines.forEach((line) => {
        const totalLength = line.el.getTotalLength();
        const interval = 110 + rand() * 50;
        for (let dist = interval; dist < totalLength - interval; dist += interval) {
          const pt = line.el.getPointAtLength(dist);
          const station = makeRect(pt.x, pt.y, 3.5, {
            fill: line.mainColor,
            opacity: 0.7,
          });
          stationsGroup.appendChild(station);
        }
      });


      // ===== Pulses (flowing dots along the lines) =====
      // Pre-compute path lengths
      lines.forEach((p) => {
        try { p.length = p.el.getTotalLength(); } catch (e) { p.length = 0; }
      });

      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      // Glow filter from <defs> above
      pulseGroup.setAttribute('filter', 'url(#pulse-glow)');

      const totalWeight = lines.reduce((s, p) => s + (p.weight || 1), 0);
      function pickPath() {
        let r = rand() * totalWeight;
        for (const p of lines) { r -= (p.weight || 1); if (r <= 0) return p; }
        return lines[lines.length - 1];
      }

      const NUM_PULSES = 40;
      const pulses = [];
      for (let i = 0; i < NUM_PULSES; i++) {
        const dot = document.createElementNS(NS, 'circle');
        dot.setAttribute('r', 2.4);
        // Fill is set on each assignment to match its line's family color
        dot.setAttribute('opacity', '0');
        pulseGroup.appendChild(dot);
        pulses.push({
          el: dot,
          path: null,
          duration: 0,
          startTime: 0,
          delay: rand() * 3000,
        });
      }

      function assignPulse(pulse, now) {
        const p = pickPath();
        if (!p || p.length < 10) {
          pulse.delay = 200 + rand() * 1000;
          pulse.startTime = now + pulse.delay;
          return;
        }
        pulse.path = p;
        pulse.el.setAttribute('fill', p.pulseColor); // color matches the line's family
        pulse.duration = 2200 + (p.length / 80) * 900 + rand() * 1500;
        pulse.startTime = now;
      }

      if (!prefersReducedMotion) {
        const start = performance.now();
        function frame(now) {
          for (const pulse of pulses) {
            if (!pulse.path) {
              if (now > start + pulse.delay) assignPulse(pulse, now);
              continue;
            }
            const elapsed = now - pulse.startTime;
            const t = elapsed / pulse.duration;
            if (t >= 1) {
              pulse.el.setAttribute('opacity', '0');
              pulse.path = null;
              pulse.delay = 2200 + rand() * 18000; // Much longer, highly randomized respawn
              pulse.startTime = now;
              continue;
            }
            const dist = t * pulse.path.length;
            let pt;
            try { pt = pulse.path.el.getPointAtLength(dist); }
            catch (e) { pulse.path = null; continue; }
            pulse.el.setAttribute('cx', pt.x);
            pulse.el.setAttribute('cy', pt.y);
            let alpha;
            if (t < 0.12) alpha = t / 0.12;
            else if (t > 0.82) alpha = (1 - t) / 0.18;
            else alpha = 1;
            pulse.el.setAttribute('opacity', (alpha * 0.95).toFixed(2));
          }
          requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      }

      // Year in footer
      document.getElementById('year').textContent = new Date().getFullYear();

      // ===== Tab switching =====
      const tabs = document.querySelectorAll('.tab');
      const panels = document.querySelectorAll('.tab-panel');
      tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
          const target = tab.getAttribute('data-tab');
          tabs.forEach((t) => t.classList.toggle('active', t === tab));
          panels.forEach((p) => p.classList.toggle('active', p.getAttribute('data-panel') === target));
        });
      });
      // --- NEW: Make Navbar links automatically switch tabs ---
      document.querySelectorAll('nav.top a[data-nav-tab]').forEach(link => {
        link.addEventListener('click', () => {
          const target = link.getAttribute('data-nav-tab');
          const targetTab = document.querySelector(`.tab[data-tab="${target}"]`);
          if (targetTab) targetTab.click();
        });
      });
    })();
  

/* ===== script block 2 of 5 ===== */
    (function () {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      // ─── Sequential CDN loader (guarantees THREE before three-globe) ───
      function loadScript(src) {
        return new Promise(function(resolve, reject) {
          var s = document.createElement('script');
          s.src = src;
          s.async = false;
          s.onload = function() { resolve(src); };
          s.onerror = function() { reject(new Error('failed to load ' + src)); };
          document.head.appendChild(s);
        });
      }

      var threeReady = null;
      function ensureThree() {
        if (threeReady) return threeReady;
        threeReady = loadScript('https://cdn.jsdelivr.net/npm/three@0.155.0/build/three.min.js')
          .then(function() { return loadScript('https://cdn.jsdelivr.net/npm/three-globe@2.30.0/dist/three-globe.min.js'); });
        return threeReady;
      }

      // ═════════ 1. RIU: 3D Amazon with South America basemap ═════════
      const AMAZON_COORDS = [[-62.339,9.944],[-60.851,9.445],[-60.816,8.591],[-60.01,8.573],[-58.601,7.51],[-58.605,6.415],[-58.333,6.895],[-57.245,6.192],[-57.141,5.816],[-54.199,5.88],[-54.008,5.566],[-53.891,5.77],[-52.961,5.46],[-51.633,4.182],[-51.414,4.386],[-50.682,2.133],[-49.909,1.663],[-50.175,0.348],[-49.5,0.367],[-49.7,0.151],[-49.383,-0.196],[-48.404,-0.256],[-48.475,-0.874],[-47.322,-0.591],[-45.722,-1.109],[-45.254,-1.591],[-44.846,-1.414],[-44.481,-1.986],[-44.683,-2.272],[-44.358,-2.338],[-44.613,-3.033],[-44.304,-2.486],[-44.027,-2.4],[-44.123,-2.759],[-43.72,-2.286],[-43.609,-2.251],[-43.583,-2.293],[-43.969,-2.803],[-43.979,-6.751],[-45.471,-7.691],[-45.995,-8.927],[-45.955,-10.226],[-45.697,-10.264],[-46.617,-11.289],[-46.083,-11.636],[-46.398,-12.04],[-46.112,-12.926],[-46.331,-13.252],[-46.041,-13.277],[-46.266,-14.098],[-45.907,-14.353],[-46.088,-14.936],[-46.504,-14.701],[-47.011,-15.491],[-48.817,-15.75],[-49.075,-16.249],[-50.216,-16.231],[-50.428,-16.903],[-51.049,-16.863],[-51.299,-17.219],[-52.024,-17.031],[-52.129,-17.325],[-52.66,-17.297],[-53.023,-18.05],[-53.953,-17.917],[-53.706,-17.227],[-54.079,-17.618],[-55.127,-17.655],[-56.116,-17.168],[-57.457,-17.905],[-58.396,-17.185],[-58.322,-16.266],[-60.598,-16.433],[-60.757,-16.582],[-59.977,-17.341],[-60.553,-18.719],[-62.035,-19.004],[-62.703,-19.888],[-64.243,-20.535],[-64.852,-19.149],[-65.167,-19.203],[-65.57,-18.702],[-66.114,-19.093],[-66.484,-18.908],[-66.921,-17.543],[-67.329,-17.133],[-67.854,-17.131],[-68.231,-16.115],[-69.02,-15.728],[-69.166,-14.722],[-69.786,-14.275],[-70.788,-14.08],[-71.118,-14.649],[-70.97,-15.233],[-71.452,-15.041],[-71.759,-15.525],[-71.838,-15.089],[-72.477,-14.658],[-73.535,-14.506],[-73.821,-14.732],[-74.184,-14.296],[-74.687,-14.257],[-75.223,-13.238],[-75.042,-13.089],[-75.544,-12.767],[-75.629,-12.13],[-76.351,-11.543],[-77.244,-9.808],[-77.746,-8.079],[-78.25,-7.97],[-78.658,-6.664],[-79.617,-5.714],[-79.111,-4.405],[-79.347,-3.738],[-78.924,-3.268],[-79.358,-3.005],[-78.622,-2.301],[-78.809,-0.817],[-78.33,-0.659],[-76.708,1.961],[-76.12,1.552],[-75.737,1.782],[-74.005,4.11],[-73.073,3.104],[-70.358,4.059],[-70.573,4.506],[-67.827,4.979],[-67.043,7.143],[-65.609,7.918],[-64.815,7.659],[-64.502,8.027],[-62.278,8.57],[-61.995,8.893],[-62.444,9.543],[-62.339,9.944]];
      const TOWER_DATA = {"towers":[{"lon":-60.307,"lat":-2.486,"pattern":"growth","heights":[0.416,0.579,0.732,0.809,0.985]},{"lon":-60.271,"lat":-3.478,"pattern":"growth","heights":[0.452,0.59,0.76,0.862,1.018]},{"lon":-61.116,"lat":-3.356,"pattern":"growth","heights":[0.343,0.481,0.534,0.717,0.838]},{"lon":-58.666,"lat":-2.591,"pattern":"growth","heights":[0.375,0.442,0.657,0.744,0.895]},{"lon":-58.756,"lat":-2.801,"pattern":"growth","heights":[0.464,0.629,0.776,0.897,1.021]},{"lon":-59.526,"lat":-2.878,"pattern":"growth","heights":[0.316,0.5,0.619,0.707,0.869]},{"lon":-61.999,"lat":-2.074,"pattern":"growth","heights":[0.381,0.589,0.685,0.82,0.849]},{"lon":-59.392,"lat":-2.501,"pattern":"growth","heights":[0.381,0.413,0.482,0.594,0.725]},{"lon":-62.03,"lat":-5.193,"pattern":"growth","heights":[0.429,0.604,0.667,0.778,0.815]},{"lon":-61.068,"lat":-3.662,"pattern":"growth","heights":[0.304,0.397,0.612,0.709,0.854]},{"lon":-59.633,"lat":-3.155,"pattern":"growth","heights":[0.273,0.493,0.592,0.72,0.882]},{"lon":-59.375,"lat":-3.871,"pattern":"growth","heights":[0.448,0.587,0.657,0.743,0.846]},{"lon":-48.191,"lat":-1.106,"pattern":"growth","heights":[0.291,0.385,0.524,0.571,0.687]},{"lon":-49.12,"lat":-2.24,"pattern":"growth","heights":[0.287,0.415,0.496,0.672,0.758]},{"lon":-48.844,"lat":-1.606,"pattern":"growth","heights":[0.381,0.412,0.596,0.671,0.79]},{"lon":-47.868,"lat":-1.252,"pattern":"growth","heights":[0.468,0.593,0.73,0.774,0.93]},{"lon":-48.947,"lat":-2.457,"pattern":"growth","heights":[0.432,0.551,0.646,0.778,0.896]},{"lon":-49.021,"lat":-0.279,"pattern":"growth","heights":[0.415,0.505,0.678,0.779,0.857]},{"lon":-49.308,"lat":-1.255,"pattern":"growth","heights":[0.336,0.449,0.516,0.642,0.721]},{"lon":-48.073,"lat":-2.99,"pattern":"growth","heights":[0.497,0.615,0.835,0.918,1.07]},{"lon":-50.514,"lat":-1.822,"pattern":"growth","heights":[0.298,0.407,0.484,0.621,0.678]},{"lon":-48.606,"lat":-2.317,"pattern":"growth","heights":[0.343,0.393,0.478,0.592,0.671]},{"lon":-67.352,"lat":-9.956,"pattern":"growth","heights":[0.442,0.55,0.673,0.806,0.874]},{"lon":-69.118,"lat":-9.155,"pattern":"growth","heights":[0.33,0.537,0.677,0.766,0.994]},{"lon":-67.198,"lat":-9.049,"pattern":"growth","heights":[0.502,0.634,0.69,0.853,0.974]},{"lon":-66.503,"lat":-9.574,"pattern":"growth","heights":[0.5,0.612,0.779,0.894,1.032]},{"lon":-67.693,"lat":-11.069,"pattern":"growth","heights":[0.309,0.414,0.471,0.626,0.681]},{"lon":-67.246,"lat":-10.451,"pattern":"growth","heights":[0.444,0.548,0.624,0.827,0.946]},{"lon":-73.617,"lat":-4.585,"pattern":"stable","heights":[0.354,0.367,0.307,0.374,0.326]},{"lon":-73.977,"lat":-4.072,"pattern":"stable","heights":[0.241,0.288,0.235,0.289,0.312]},{"lon":-72.398,"lat":-5.122,"pattern":"stable","heights":[0.337,0.347,0.367,0.375,0.36]},{"lon":-74.32,"lat":-3.532,"pattern":"stable","heights":[0.336,0.343,0.354,0.403,0.359]},{"lon":-72.29,"lat":-3.295,"pattern":"stable","heights":[0.315,0.32,0.34,0.381,0.383]},{"lon":-74.9,"lat":1.982,"pattern":"volatile","heights":[0.42,0.266,0.357,0.336,0.337]},{"lon":-72.158,"lat":2.689,"pattern":"volatile","heights":[0.197,0.507,0.23,0.541,0.525]},{"lon":-71.595,"lat":3.473,"pattern":"volatile","heights":[0.157,0.334,0.478,0.537,0.33]},{"lon":-71.739,"lat":3.232,"pattern":"volatile","heights":[0.257,0.234,0.528,0.234,0.383]},{"lon":-71.163,"lat":1.935,"pattern":"volatile","heights":[0.207,0.36,0.531,0.203,0.478]},{"lon":-71.991,"lat":3.331,"pattern":"volatile","heights":[0.353,0.505,0.431,0.243,0.509]},{"lon":-63.953,"lat":-8.037,"pattern":"stable","heights":[0.3,0.298,0.346,0.342,0.327]},{"lon":-63.215,"lat":-7.607,"pattern":"stable","heights":[0.263,0.26,0.312,0.228,0.303]},{"lon":-65.261,"lat":-9.083,"pattern":"stable","heights":[0.38,0.46,0.439,0.458,0.397]},{"lon":-64.173,"lat":-8.301,"pattern":"stable","heights":[0.314,0.374,0.333,0.311,0.317]},{"lon":-63.027,"lat":-10.946,"pattern":"stable","heights":[0.26,0.265,0.338,0.284,0.349]},{"lon":-71.064,"lat":-4.471,"pattern":"scatter","heights":[0.096,0.111,0.091,0.102,0.137]},{"lon":-69.929,"lat":0.776,"pattern":"scatter","heights":[0.205,0.194,0.211,0.213,0.189]},{"lon":-45.522,"lat":-6.583,"pattern":"scatter","heights":[0.139,0.18,0.163,0.182,0.175]},{"lon":-71.284,"lat":-13.195,"pattern":"scatter","heights":[0.087,0.14,0.092,0.113,0.105]},{"lon":-72.115,"lat":-13.869,"pattern":"scatter","heights":[0.13,0.144,0.101,0.125,0.104]},{"lon":-49.585,"lat":-5.616,"pattern":"scatter","heights":[0.141,0.127,0.127,0.129,0.171]},{"lon":-56.146,"lat":3.989,"pattern":"scatter","heights":[0.123,0.164,0.169,0.137,0.118]},{"lon":-76.033,"lat":-0.182,"pattern":"scatter","heights":[0.079,0.094,0.079,0.087,0.089]},{"lon":-52.745,"lat":-5.659,"pattern":"scatter","heights":[0.172,0.163,0.143,0.143,0.15]},{"lon":-67.362,"lat":4.025,"pattern":"scatter","heights":[0.116,0.099,0.112,0.153,0.103]},{"lon":-53.632,"lat":-14.9,"pattern":"scatter","heights":[0.148,0.162,0.123,0.127,0.125]},{"lon":-66.736,"lat":-3.54,"pattern":"scatter","heights":[0.125,0.155,0.149,0.15,0.099]},{"lon":-60.57,"lat":8.009,"pattern":"scatter","heights":[0.096,0.108,0.082,0.089,0.054]},{"lon":-63.817,"lat":6.152,"pattern":"scatter","heights":[0.153,0.147,0.148,0.155,0.112]},{"lon":-50.085,"lat":-13.669,"pattern":"scatter","heights":[0.072,0.094,0.104,0.12,0.106]},{"lon":-70.186,"lat":-11.211,"pattern":"scatter","heights":[0.174,0.155,0.161,0.13,0.175]},{"lon":-70.581,"lat":-2.407,"pattern":"scatter","heights":[0.133,0.117,0.096,0.086,0.093]},{"lon":-69.922,"lat":-7.43,"pattern":"scatter","heights":[0.168,0.133,0.131,0.158,0.161]},{"lon":-66.618,"lat":-6.255,"pattern":"scatter","heights":[0.11,0.133,0.097,0.115,0.124]},{"lon":-64.278,"lat":7.532,"pattern":"scatter","heights":[0.204,0.218,0.194,0.179,0.18]},{"lon":-61.442,"lat":-4.045,"pattern":"scatter","heights":[0.208,0.184,0.167,0.195,0.206]},{"lon":-63.596,"lat":-14.507,"pattern":"scatter","heights":[0.116,0.14,0.156,0.114,0.102]},{"lon":-72.968,"lat":-5.795,"pattern":"scatter","heights":[0.116,0.132,0.102,0.138,0.135]},{"lon":-53.618,"lat":-3.306,"pattern":"scatter","heights":[0.123,0.169,0.129,0.16,0.124]},{"lon":-67.591,"lat":-4.45,"pattern":"scatter","heights":[0.122,0.094,0.134,0.106,0.088]},{"lon":-59.56,"lat":3.528,"pattern":"scatter","heights":[0.102,0.117,0.134,0.086,0.1]},{"lon":-75.286,"lat":-3.191,"pattern":"scatter","heights":[0.134,0.084,0.079,0.079,0.099]},{"lon":-70.303,"lat":-11.692,"pattern":"scatter","heights":[0.211,0.202,0.218,0.214,0.178]},{"lon":-51.971,"lat":-4.769,"pattern":"scatter","heights":[0.128,0.117,0.074,0.112,0.095]},{"lon":-59.339,"lat":2.8,"pattern":"scatter","heights":[0.115,0.105,0.095,0.112,0.116]},{"lon":-47.063,"lat":-6.703,"pattern":"scatter","heights":[0.172,0.223,0.177,0.186,0.214]},{"lon":-57.562,"lat":-4.833,"pattern":"scatter","heights":[0.175,0.152,0.177,0.171,0.204]},{"lon":-61.074,"lat":0.782,"pattern":"scatter","heights":[0.095,0.127,0.075,0.098,0.122]},{"lon":-63.168,"lat":-4.001,"pattern":"scatter","heights":[0.144,0.144,0.146,0.197,0.157]}],"years":[2015,2016,2017,2018,2019]};
      const SA_COUNTRIES = {"Argentina":[[[-67.75,-53.85],[-66.45,-54.45],[-65.05,-54.7],[-65.5,-55.2],[-66.45,-55.25],[-66.96,-54.9],[-68.63,-54.87],[-68.63,-52.64],[-67.75,-53.85]],[[-58.5,-34.43],[-57.23,-35.29],[-57.36,-35.98],[-56.74,-36.41],[-56.79,-36.9],[-57.75,-38.18],[-59.23,-38.72],[-62.34,-38.83],[-62.15,-40.68],[-62.75,-41.03],[-63.77,-41.17],[-64.73,-40.8],[-65.12,-41.06],[-64.98,-42.06],[-64.3,-42.36],[-63.76,-42.04],[-63.46,-42.56],[-64.38,-42.87],[-65.18,-43.5],[-65.57,-45.04],[-66.51,-45.04],[-67.29,-45.55],[-67.58,-46.3],[-66.6,-47.03],[-65.64,-47.24],[-65.99,-48.13],[-67.17,-48.7],[-67.82,-49.87],[-68.73,-50.26],[-69.14,-50.73],[-68.82,-51.77],[-68.15,-52.35],[-71.91,-52.01],[-72.33,-51.43],[-72.31,-50.68],[-72.98,-50.74],[-73.33,-50.38],[-73.42,-49.32],[-72.65,-48.88],[-72.33,-48.24],[-72.45,-47.74],[-71.92,-46.88],[-71.55,-45.56],[-71.66,-44.97],[-71.22,-44.78],[-71.33,-44.41],[-71.79,-44.21],[-71.46,-43.79],[-71.92,-43.41],[-72.15,-42.25],[-71.75,-42.05],[-71.92,-40.83],[-71.41,-38.92],[-70.81,-38.55],[-71.12,-36.66],[-70.36,-36.01],[-70.39,-35.17],[-69.82,-34.19],[-69.81,-33.27],[-70.07,-33.09],[-70.54,-31.37],[-69.92,-30.34],[-70.01,-29.37],[-69.66,-28.46],[-68.3,-26.9],[-68.59,-26.51],[-68.39,-26.19],[-68.42,-24.52],[-67.33,-24.03],[-66.99,-22.99],[-67.11,-22.74],[-66.27,-21.83],[-64.96,-22.08],[-64.38,-22.8],[-63.99,-21.99],[-62.85,-22.03],[-60.85,-23.88],[-60.03,-24.03],[-57.78,-25.16],[-57.63,-25.6],[-58.62,-27.12],[-56.49,-27.55],[-55.7,-27.39],[-54.79,-26.62],[-54.63,-25.74],[-54.13,-25.55],[-53.63,-26.12],[-53.65,-26.92],[-55.16,-27.88],[-57.63,-30.22],[-58.5,-34.43]]],"Chile":[[[-68.63,-54.87],[-66.96,-54.9],[-67.29,-55.3],[-68.15,-55.61],[-71.01,-55.05],[-73.29,-53.96],[-74.66,-52.84],[-71.11,-54.07],[-70.27,-52.93],[-69.35,-52.52],[-68.63,-52.64],[-68.63,-54.87]],[[-69.1,-18.26],[-68.97,-18.98],[-68.44,-19.41],[-68.76,-20.37],[-67.83,-22.87],[-67.11,-22.74],[-66.99,-22.99],[-67.33,-24.03],[-68.42,-24.52],[-68.39,-26.19],[-68.59,-26.51],[-68.3,-26.9],[-69.66,-28.46],[-70.01,-29.37],[-69.92,-30.34],[-70.54,-31.37],[-70.07,-33.09],[-69.81,-33.27],[-69.82,-34.19],[-70.39,-35.17],[-70.36,-36.01],[-71.12,-36.66],[-70.81,-38.55],[-71.41,-38.92],[-71.92,-40.83],[-71.75,-42.05],[-72.15,-42.25],[-71.92,-43.41],[-71.46,-43.79],[-71.79,-44.21],[-71.33,-44.41],[-71.22,-44.78],[-71.66,-44.97],[-71.55,-45.56],[-71.92,-46.88],[-72.45,-47.74],[-72.33,-48.24],[-72.65,-48.88],[-73.42,-49.32],[-73.33,-50.38],[-72.98,-50.74],[-72.31,-50.68],[-72.33,-51.43],[-71.91,-52.01],[-68.57,-52.3],[-69.46,-52.29],[-70.85,-52.9],[-71.01,-53.83],[-71.43,-53.86],[-72.56,-53.53],[-74.95,-52.26],[-75.26,-51.63],[-74.98,-51.04],[-75.48,-50.38],[-75.61,-48.67],[-75.18,-47.71],[-74.13,-46.94],[-75.64,-46.65],[-74.69,-45.76],[-74.35,-44.1],[-73.24,-44.45],[-72.72,-42.38],[-73.39,-42.12],[-73.7,-43.37],[-74.33,-43.22],[-73.68,-39.94],[-73.22,-39.26],[-73.59,-37.16],[-73.17,-37.12],[-71.44,-32.42],[-71.67,-30.92],[-71.37,-30.1],[-71.49,-28.86],[-70.91,-27.64],[-70.09,-21.39],[-70.37,-18.35],[-69.86,-18.09],[-69.59,-17.58],[-69.1,-18.26]]],"Uruguay":[[[-56.98,-30.11],[-53.79,-32.05],[-53.21,-32.73],[-53.65,-33.2],[-53.37,-33.77],[-53.81,-34.4],[-54.94,-34.95],[-56.22,-34.86],[-57.14,-34.43],[-57.82,-34.46],[-58.43,-33.91],[-57.63,-30.22],[-56.98,-30.11]]],"Brazil":[[[-53.65,-33.2],[-53.21,-32.73],[-53.79,-32.05],[-56.98,-30.11],[-57.63,-30.22],[-55.16,-27.88],[-53.65,-26.92],[-53.63,-26.12],[-54.13,-25.55],[-54.63,-25.74],[-54.29,-24.02],[-54.65,-23.84],[-55.4,-23.96],[-55.8,-22.36],[-56.47,-22.09],[-56.88,-22.28],[-57.94,-22.09],[-57.87,-20.73],[-58.17,-20.18],[-57.85,-19.97],[-57.95,-19.4],[-57.5,-18.17],[-57.73,-17.55],[-58.28,-17.27],[-58.24,-16.3],[-60.16,-16.26],[-60.54,-15.09],[-60.25,-15.08],[-60.5,-13.78],[-61.08,-13.48],[-61.71,-13.49],[-63.2,-12.63],[-64.32,-12.46],[-65.4,-11.57],[-65.34,-9.76],[-66.65,-9.93],[-68.27,-11.01],[-70.55,-11.01],[-70.48,-9.49],[-71.3,-10.08],[-72.18,-10.05],[-72.56,-9.52],[-73.23,-9.46],[-73.02,-9.03],[-73.99,-7.52],[-73.72,-7.34],[-73.72,-6.92],[-73.12,-6.63],[-73.22,-6.09],[-72.89,-5.27],[-70.79,-4.25],[-69.89,-4.3],[-69.42,-1.12],[-69.58,-0.55],[-70.02,-0.19],[-70.02,0.54],[-69.25,0.6],[-69.22,0.99],[-69.8,1.09],[-69.82,1.71],[-67.87,1.69],[-67.54,2.04],[-67.07,1.13],[-66.88,1.25],[-66.33,0.72],[-65.55,0.79],[-65.35,1.1],[-64.2,1.49],[-64.08,1.92],[-63.37,2.2],[-63.42,2.41],[-64.27,2.5],[-64.37,3.8],[-64.82,4.06],[-63.09,3.77],[-60.97,4.54],[-60.6,4.92],[-60.73,5.2],[-60.21,5.24],[-59.98,5.01],[-60.11,4.57],[-59.54,3.96],[-59.97,2.76],[-59.65,1.79],[-59.03,1.32],[-58.54,1.27],[-57.34,1.95],[-56.0,1.82],[-55.97,2.51],[-55.1,2.52],[-54.09,2.11],[-53.78,2.38],[-53.42,2.05],[-52.94,2.12],[-51.66,4.16],[-51.32,4.2],[-50.51,1.9],[-49.97,1.74],[-49.95,1.05],[-50.7,0.22],[-50.39,-0.08],[-48.62,-0.24],[-48.58,-1.24],[-47.82,-0.58],[-44.91,-1.55],[-44.42,-2.14],[-44.58,-2.69],[-43.42,-2.38],[-41.47,-2.91],[-39.98,-2.87],[-38.5,-3.7],[-37.22,-4.82],[-35.6,-5.15],[-35.24,-5.46],[-34.73,-7.34],[-35.13,-9.0],[-37.05,-11.04],[-38.42,-13.04],[-38.67,-13.06],[-38.95,-13.79],[-38.88,-15.67],[-39.27,-17.87],[-39.58,-18.26],[-39.76,-19.6],[-40.77,-20.9],[-40.94,-21.94],[-41.75,-22.37],[-41.99,-22.97],[-43.07,-22.97],[-44.65,-23.35],[-46.47,-24.09],[-47.65,-24.89],[-48.5,-25.88],[-48.64,-26.62],[-48.47,-27.18],[-48.89,-28.67],[-49.59,-29.22],[-50.7,-30.98],[-52.26,-32.25],[-52.71,-33.2],[-53.37,-33.77],[-53.65,-33.2]]],"Bolivia":[[[-68.27,-11.01],[-66.65,-9.93],[-65.34,-9.76],[-65.4,-11.57],[-64.32,-12.46],[-63.2,-12.63],[-61.71,-13.49],[-61.08,-13.48],[-60.5,-13.78],[-60.25,-15.08],[-60.54,-15.09],[-60.16,-16.26],[-58.24,-16.3],[-58.28,-17.27],[-57.73,-17.55],[-57.5,-18.17],[-57.95,-19.4],[-57.85,-19.97],[-58.17,-20.18],[-58.18,-19.87],[-59.12,-19.36],[-61.79,-19.63],[-62.27,-20.51],[-62.69,-22.25],[-62.85,-22.03],[-63.99,-21.99],[-64.38,-22.8],[-64.96,-22.08],[-66.27,-21.83],[-67.11,-22.74],[-67.83,-22.87],[-68.76,-20.37],[-68.44,-19.41],[-68.97,-18.98],[-69.1,-18.26],[-69.59,-17.58],[-68.96,-16.5],[-69.39,-15.66],[-69.16,-15.32],[-69.34,-14.95],[-68.95,-14.45],[-68.88,-12.9],[-68.67,-12.56],[-69.53,-10.95],[-68.27,-11.01]]],"Peru":[[[-70.79,-4.25],[-72.89,-5.27],[-73.22,-6.09],[-73.12,-6.63],[-73.72,-6.92],[-73.72,-7.34],[-73.99,-7.52],[-73.02,-9.03],[-73.23,-9.46],[-72.56,-9.52],[-72.18,-10.05],[-71.3,-10.08],[-70.48,-9.49],[-70.55,-11.01],[-69.53,-10.95],[-68.67,-12.56],[-68.88,-12.9],[-68.95,-14.45],[-69.34,-14.95],[-69.16,-15.32],[-69.39,-15.66],[-68.96,-16.5],[-69.86,-18.09],[-70.37,-18.35],[-71.38,-17.77],[-71.46,-17.36],[-73.44,-16.36],[-76.01,-14.65],[-76.42,-13.82],[-76.26,-13.54],[-79.76,-7.19],[-81.25,-6.14],[-80.93,-5.69],[-81.41,-4.74],[-81.1,-4.04],[-80.3,-3.4],[-80.18,-3.82],[-80.47,-4.06],[-80.44,-4.43],[-79.62,-4.45],[-79.21,-4.96],[-78.64,-4.55],[-77.84,-3.0],[-76.64,-2.61],[-75.54,-1.56],[-75.23,-0.91],[-75.37,-0.15],[-75.11,-0.06],[-73.66,-1.26],[-73.07,-2.31],[-70.81,-2.26],[-70.05,-2.73],[-70.69,-3.74],[-70.39,-3.77],[-69.89,-4.3],[-70.79,-4.25]]],"Colombia":[[[-67.07,1.13],[-67.54,2.04],[-67.87,1.69],[-69.82,1.71],[-69.8,1.09],[-69.22,0.99],[-69.25,0.6],[-70.02,0.54],[-70.02,-0.19],[-69.58,-0.55],[-69.42,-1.12],[-69.89,-4.3],[-70.39,-3.77],[-70.69,-3.74],[-70.05,-2.73],[-70.81,-2.26],[-73.07,-2.31],[-73.66,-1.26],[-75.11,-0.06],[-75.37,-0.15],[-76.29,0.42],[-76.58,0.26],[-77.42,0.4],[-77.67,0.83],[-78.86,1.38],[-78.99,1.69],[-78.62,1.77],[-78.66,2.27],[-78.43,2.63],[-77.93,2.7],[-77.13,3.85],[-77.5,4.09],[-77.31,4.67],[-77.53,5.58],[-77.32,5.85],[-77.48,6.69],[-77.88,7.22],[-77.75,7.71],[-77.43,7.64],[-77.24,7.94],[-77.47,8.52],[-76.84,8.64],[-75.67,9.44],[-75.48,10.62],[-74.91,11.08],[-74.28,11.1],[-74.2,11.31],[-73.41,11.23],[-71.75,12.44],[-71.4,12.38],[-71.14,12.11],[-71.33,11.78],[-71.97,11.61],[-72.91,10.45],[-73.3,9.15],[-72.79,9.09],[-72.44,8.41],[-72.44,7.42],[-71.96,6.99],[-70.09,6.96],[-69.39,6.1],[-67.7,6.27],[-67.34,6.1],[-67.82,4.5],[-67.3,3.32],[-67.81,2.82],[-67.18,2.25],[-66.88,1.25],[-67.07,1.13]]],"Panama":[[[-77.24,7.94],[-77.43,7.64],[-77.75,7.71],[-77.88,7.22],[-78.43,8.05],[-78.18,8.32],[-79.12,9.0],[-79.56,8.93],[-79.76,8.58],[-80.38,8.3],[-80.48,8.09],[-80.0,7.55],[-80.89,7.22],[-81.06,7.82],[-81.52,7.71],[-81.72,8.11],[-82.82,8.29],[-82.85,8.07],[-82.97,8.23],[-82.72,8.93],[-82.93,9.48],[-82.55,9.57],[-82.21,9.0],[-81.71,9.03],[-81.44,8.79],[-79.57,9.61],[-79.02,9.55],[-78.06,9.25],[-77.35,8.67],[-77.24,7.94]]],"Costa Rica":[[[-82.93,9.48],[-82.72,8.93],[-82.97,8.23],[-83.51,8.45],[-83.71,8.66],[-83.63,9.05],[-84.65,9.62],[-84.98,10.09],[-85.0,9.99],[-85.0,11.05],[-83.9,10.73],[-83.66,10.94],[-82.55,9.57],[-82.93,9.48]]],"Nicaragua":[[[-83.9,10.73],[-84.67,11.08],[-85.0,11.08],[-85.0,14.71],[-84.92,14.79],[-84.45,14.62],[-83.15,15.0],[-83.52,13.57],[-83.47,12.42],[-83.86,11.37],[-83.66,10.94],[-83.9,10.73]]],"Venezuela":[[[-60.6,4.92],[-60.97,4.54],[-63.09,3.77],[-64.82,4.06],[-64.37,3.8],[-64.27,2.5],[-63.42,2.41],[-63.37,2.2],[-64.08,1.92],[-64.2,1.49],[-65.35,1.1],[-65.55,0.79],[-66.33,0.72],[-66.88,1.25],[-67.18,2.25],[-67.81,2.82],[-67.3,3.32],[-67.82,4.5],[-67.34,6.1],[-67.7,6.27],[-69.39,6.1],[-70.09,6.96],[-71.96,6.99],[-72.44,7.42],[-72.44,8.41],[-72.79,9.09],[-73.3,9.15],[-72.91,10.45],[-71.97,11.61],[-71.33,11.78],[-71.36,11.54],[-71.95,11.42],[-71.62,10.97],[-71.63,10.45],[-72.07,9.87],[-71.7,9.07],[-71.26,9.14],[-71.04,9.86],[-71.35,10.21],[-71.4,10.97],[-70.16,11.38],[-70.29,11.85],[-69.94,12.16],[-69.58,11.46],[-68.88,11.44],[-68.23,10.89],[-68.19,10.55],[-66.23,10.65],[-65.66,10.2],[-64.89,10.08],[-64.33,10.39],[-64.32,10.64],[-61.88,10.72],[-62.73,10.42],[-62.39,9.95],[-61.59,9.87],[-60.83,9.38],[-60.67,8.58],[-59.76,8.37],[-60.55,7.78],[-60.64,7.42],[-60.3,7.04],[-61.16,6.7],[-61.14,6.23],[-61.41,5.96],[-60.6,4.92]]],"Guyana":[[[-57.34,1.95],[-58.54,1.27],[-59.03,1.32],[-59.65,1.79],[-59.97,2.76],[-59.54,3.96],[-60.11,4.57],[-59.98,5.01],[-60.21,5.24],[-60.73,5.2],[-61.41,5.96],[-61.14,6.23],[-61.16,6.7],[-60.3,7.04],[-60.64,7.42],[-60.55,7.78],[-59.76,8.37],[-58.48,7.35],[-58.45,6.83],[-58.08,6.81],[-57.15,5.97],[-57.31,5.07],[-57.91,4.81],[-58.04,4.06],[-57.6,3.33],[-57.28,3.33],[-56.54,1.9],[-57.34,1.95]]],"Suriname":[[[-55.97,2.51],[-56.0,1.82],[-56.54,1.9],[-57.28,3.33],[-57.6,3.33],[-58.04,4.06],[-57.91,4.81],[-57.31,5.07],[-57.15,5.97],[-55.95,5.77],[-55.03,6.03],[-53.96,5.76],[-54.48,4.9],[-54.4,4.21],[-54.01,3.62],[-54.52,2.31],[-55.97,2.51]]],"Ecuador":[[[-75.23,-0.91],[-75.54,-1.56],[-76.64,-2.61],[-77.84,-3.0],[-78.64,-4.55],[-79.21,-4.96],[-79.62,-4.45],[-80.44,-4.43],[-80.47,-4.06],[-80.18,-3.82],[-80.3,-3.4],[-79.77,-2.66],[-79.99,-2.22],[-80.37,-2.69],[-80.97,-2.25],[-80.76,-1.97],[-80.93,-1.06],[-80.58,-0.91],[-80.02,0.36],[-80.09,0.77],[-78.86,1.38],[-77.67,0.83],[-77.42,0.4],[-76.58,0.26],[-76.29,0.42],[-75.37,-0.15],[-75.23,-0.91]]],"Paraguay":[[[-57.87,-20.73],[-57.94,-22.09],[-56.88,-22.28],[-56.47,-22.09],[-55.8,-22.36],[-55.4,-23.96],[-54.65,-23.84],[-54.29,-24.02],[-54.79,-26.62],[-55.7,-27.39],[-56.49,-27.55],[-58.62,-27.12],[-57.63,-25.6],[-57.78,-25.16],[-60.03,-24.03],[-60.85,-23.88],[-62.69,-22.25],[-62.27,-20.51],[-61.79,-19.63],[-59.12,-19.36],[-58.18,-19.87],[-57.87,-20.73]]]};
      const SA_LABELS = {"Argentina":[-64.08,-37.24],"Chile":[-69.84,-54.02],"Brazil":[-49.71,-14.07],"Bolivia":[-63.64,-16.4],"Peru":[-75.87,-9.25],"Colombia":[-72.49,3.97],"Venezuela":[-65.43,6.48],"Guyana":[-58.85,4.91],"Ecuador":[-78.28,-1.76],"Paraguay":[-58.64,-23.11]};
      const WORLD_COUNTRIES = {"type":"FeatureCollection","features":[{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[33.9,-0.9],[39.2,-4.7],[39.5,-10.9],[34.6,-11.5],[29.6,-6.5],[30.4,-1.1],[33.9,-0.9]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[-8.7,27.7],[-8.7,25.9],[-12.0,25.9],[-12.9,21.3],[-17.1,21.0],[-14.8,21.5],[-11.4,26.9],[-8.7,27.7]]]}},{"type":"Feature","properties":{},"geometry":{"type":"MultiPolygon","coordinates":[[[[-122.8,49.0],[-125.6,50.4],[-127.4,50.8],[-130.5,54.3],[-130.0,55.9],[-135.5,59.8],[-137.5,58.9],[-141.0,60.3],[-141.0,69.7],[-136.5,68.9],[-128.1,70.5],[-113.5,67.7],[-106.2,68.8],[-101.5,67.6],[-97.7,68.6],[-96.1,67.3],[-94.2,69.1],[-96.5,70.1],[-95.2,71.9],[-87.4,67.2],[-85.5,69.9],[-82.6,69.7],[-81.4,67.1],[-85.8,66.6],[-90.7,63.6],[-94.7,58.9],[-92.3,57.1],[-82.3,55.1],[-79.9,51.2],[-78.6,52.6],[-79.8,54.7],[-76.5,56.5],[-78.5,58.8],[-77.3,59.9],[-78.1,62.3],[-73.8,62.4],[-69.6,61.1],[-67.6,58.2],[-64.6,60.3],[-61.8,56.3],[-57.3,54.6],[-55.7,52.1],[-60.0,50.2],[-66.4,50.2],[-71.1,46.8],[-65.1,49.2],[-64.5,46.2],[-63.2,45.7],[-61.5,45.9],[-60.5,47.0],[-59.8,45.9],[-65.4,43.5],[-66.2,44.5],[-64.4,45.3],[-67.1,45.1],[-69.2,47.4],[-71.5,45.0],[-82.4,41.7],[-82.6,45.3],[-88.4,48.3],[-122.8,49.0]]],[[[-83.1,62.2],[-83.3,62.9],[-81.9,62.9],[-83.1,62.2]]],[[[-78.4,72.9],[-80.8,73.7],[-76.3,72.8],[-78.4,72.9]]],[[[-79.7,61.6],[-79.9,62.4],[-79.3,62.2],[-79.7,61.6]]],[[[-94.9,75.6],[-94.2,74.6],[-96.8,74.9],[-94.9,75.6]]],[[[-94.4,77.8],[-96.2,77.6],[-96.4,77.8],[-94.4,77.8]]],[[[-97.3,78.8],[-95.6,78.4],[-98.6,78.9],[-97.3,78.8]]],[[[-79.8,74.9],[-92.4,74.8],[-97.1,76.8],[-79.8,74.9]]],[[[-112.7,78.1],[-109.9,78.0],[-113.5,77.7],[-112.7,78.1]]],[[[-111.5,78.8],[-109.7,78.6],[-112.5,78.4],[-111.5,78.8]]],[[[-55.6,51.3],[-56.8,49.8],[-53.5,49.2],[-53.1,46.7],[-59.3,47.6],[-55.6,51.3]]],[[[-85.9,65.7],[-81.6,64.0],[-80.1,63.7],[-87.2,63.5],[-85.9,65.7]]],[[[-82.3,73.8],[-68.8,70.5],[-67.0,69.2],[-68.8,68.7],[-61.9,66.9],[-63.9,65.0],[-68.0,66.3],[-64.7,63.4],[-68.8,63.7],[-66.2,61.9],[-68.9,62.3],[-78.6,64.6],[-74.0,65.5],[-73.3,68.1],[-79.0,70.2],[-88.7,70.4],[-90.2,72.2],[-85.8,73.8],[-85.8,72.5],[-82.3,73.8]]],[[[-96.0,73.4],[-92.4,74.1],[-90.5,73.9],[-95.4,72.1],[-96.0,73.4]]],[[[-122.9,76.1],[-119.1,77.5],[-116.2,77.6],[-117.1,76.5],[-122.9,76.1]]],[[[-133.1,53.4],[-131.7,54.1],[-131.2,52.2],[-133.1,53.4]]],[[[-105.5,79.3],[-100.8,78.8],[-99.7,77.9],[-105.2,78.4],[-104.2,78.7],[-105.5,79.3]]],[[[-123.5,48.5],[-125.7,48.8],[-128.4,50.8],[-125.8,50.3],[-123.5,48.5]]],[[[-124.9,74.3],[-117.6,74.2],[-115.5,73.5],[-119.2,72.5],[-120.5,71.4],[-123.1,70.9],[-125.9,71.9],[-123.9,73.7],[-124.9,74.3]]],[[[-115.4,76.5],[-105.7,75.5],[-117.7,75.2],[-115.4,76.5]]],[[[-108.4,73.1],[-101.1,69.6],[-113.3,68.5],[-117.3,70.0],[-112.4,70.4],[-119.4,71.6],[-115.2,73.3],[-108.2,71.7],[-108.4,73.1]]],[[[-100.4,72.7],[-101.5,73.4],[-97.4,73.8],[-96.5,72.6],[-98.4,71.3],[-102.5,72.5],[-100.4,72.7]]],[[[-106.6,73.6],[-105.3,73.6],[-104.5,73.4],[-105.4,72.8],[-106.6,73.6]]],[[[-98.5,76.7],[-98.2,75.0],[-102.5,75.6],[-102.6,76.3],[-98.5,76.7]]],[[[-96.0,80.6],[-92.4,81.3],[-85.8,79.3],[-92.9,78.3],[-96.0,80.6]]],[[[-91.6,81.9],[-79.3,83.1],[-61.9,82.6],[-76.9,79.3],[-75.4,78.5],[-80.6,76.2],[-89.5,76.5],[-88.3,77.9],[-85.0,77.5],[-88.0,78.4],[-85.1,79.3],[-86.9,80.3],[-81.8,80.5],[-91.6,81.9]]],[[[-75.2,67.4],[-77.0,67.1],[-77.2,67.6],[-75.9,68.3],[-75.2,67.4]]],[[[-98.2,70.1],[-96.3,68.8],[-99.8,69.4],[-98.2,70.1]]],[[[-64.5,49.9],[-62.9,49.7],[-61.8,49.1],[-63.6,49.4],[-64.5,49.9]]],[[[-64.1,46.4],[-63.7,46.6],[-62.0,46.4],[-62.9,46.0],[-64.1,46.4]]]]}},{"type":"Feature","properties":{},"geometry":{"type":"MultiPolygon","coordinates":[[[[-122.8,49.0],[-88.4,48.3],[-82.6,45.3],[-82.7,41.7],[-71.5,45.0],[-69.2,47.4],[-67.0,44.8],[-70.1,43.7],[-70.0,41.6],[-75.5,39.5],[-75.1,38.4],[-75.9,37.2],[-76.3,39.1],[-77.0,38.2],[-75.7,35.6],[-81.3,31.4],[-80.4,25.2],[-83.7,29.9],[-86.4,30.4],[-94.7,29.5],[-97.5,25.8],[-101.0,29.4],[-103.9,29.3],[-106.5,31.8],[-117.1,32.5],[-120.6,34.6],[-124.4,40.3],[-124.7,48.2],[-122.6,47.1],[-122.8,49.0]]],[[[-156.1,19.7],[-154.8,19.5],[-155.7,18.9],[-156.1,19.7]]],[[[-156.6,21.0],[-156.4,20.6],[-156.7,20.9],[-156.6,21.0]]],[[[-157.3,21.2],[-156.8,21.1],[-157.3,21.1],[-157.3,21.2]]],[[[-158.1,21.3],[-157.7,21.3],[-157.7,21.3],[-158.1,21.3]]],[[[-159.6,22.2],[-159.5,21.9],[-159.8,22.1],[-159.6,22.2]]],[[[-167.5,60.2],[-165.7,60.3],[-165.6,59.9],[-167.5,60.2]]],[[[-154.7,57.5],[-152.1,57.6],[-154.5,57.0],[-154.7,57.5]]],[[[-141.0,69.7],[-141.0,60.3],[-137.5,58.9],[-135.5,59.8],[-130.0,55.9],[-130.5,54.8],[-134.1,58.1],[-136.6,58.2],[-139.9,59.5],[-147.1,60.9],[-151.7,59.2],[-150.6,61.3],[-158.4,56.0],[-164.9,54.6],[-157.0,58.9],[-162.0,58.7],[-165.3,60.5],[-165.7,62.1],[-160.8,64.8],[-168.1,65.7],[-161.7,66.1],[-166.2,68.9],[-156.6,71.4],[-141.0,69.7]]],[[[-171.7,63.8],[-170.5,63.7],[-168.7,63.3],[-169.5,63.0],[-171.7,63.8]]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[87.4,49.2],[80.0,44.9],[80.3,42.3],[74.2,43.3],[68.6,40.7],[64.9,43.7],[62.0,43.5],[58.5,45.6],[55.9,45.0],[56.0,41.3],[52.5,41.8],[50.3,44.6],[53.0,45.3],[53.0,46.9],[49.1,46.4],[46.5,48.4],[50.8,51.7],[61.3,50.8],[60.0,52.0],[61.4,54.0],[69.1,55.4],[73.4,53.5],[76.9,54.5],[80.0,50.9],[87.4,49.2]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[56.0,41.3],[55.9,45.0],[58.5,45.6],[62.0,43.5],[64.9,43.7],[68.3,40.7],[71.0,42.3],[73.1,40.9],[67.7,39.6],[67.8,37.1],[58.6,42.8],[56.0,41.3]]]}},{"type":"Feature","properties":{},"geometry":{"type":"MultiPolygon","coordinates":[[[[141.0,-2.6],[147.6,-6.1],[147.2,-7.4],[150.7,-10.6],[144.7,-7.6],[141.0,-9.1],[141.0,-2.6]]],[[[150.9,-2.5],[152.8,-4.8],[150.7,-2.7],[150.9,-2.5]]],[[[152.1,-4.1],[149.7,-6.3],[148.3,-5.7],[152.1,-4.1]]],[[[154.8,-5.3],[156.0,-6.5],[155.9,-6.8],[155.2,-6.5],[154.8,-5.3]]]]}},{"type":"Feature","properties":{},"geometry":{"type":"MultiPolygon","coordinates":[[[[141.0,-2.6],[141.0,-9.1],[137.6,-8.4],[137.9,-5.4],[133.0,-4.1],[132.0,-2.8],[133.7,-2.2],[130.5,-0.9],[134.0,-0.8],[135.5,-3.4],[137.4,-1.7],[141.0,-2.6]]],[[[125.0,-8.9],[124.4,-10.1],[123.5,-10.2],[124.0,-9.3],[125.0,-8.9]]],[[[134.7,-6.2],[134.1,-6.1],[134.5,-5.4],[134.7,-6.2]]],[[[117.9,4.1],[119.0,0.9],[116.1,-4.0],[110.2,-2.9],[109.7,2.0],[110.5,0.8],[113.8,1.2],[115.9,4.3],[117.9,4.1]]],[[[127.9,-3.4],[130.5,-3.1],[130.8,-3.9],[127.9,-3.4]]],[[[127.0,-3.1],[126.2,-3.6],[126.0,-3.2],[127.0,-3.1]]],[[[127.9,2.2],[128.7,1.1],[128.1,-0.9],[127.4,1.0],[127.9,2.2]]],[[[119.8,0.2],[125.2,1.4],[120.0,-0.5],[123.3,-0.6],[121.5,-1.9],[123.2,-5.3],[121.0,-2.6],[119.8,-5.7],[118.8,-2.8],[119.8,0.2]]],[[[120.3,-10.3],[119.0,-9.6],[119.9,-9.4],[120.3,-10.3]]],[[[119.9,-8.8],[122.0,-8.5],[122.9,-8.1],[122.8,-8.6],[119.9,-8.8]]],[[[117.9,-8.1],[119.1,-8.7],[116.7,-9.0],[117.9,-8.1]]],[[[105.4,-6.9],[112.6,-6.9],[115.7,-8.4],[105.4,-6.9]]],[[[97.5,5.2],[106.1,-3.1],[105.8,-5.9],[102.6,-4.2],[95.3,5.5],[97.5,5.2]]]]}},{"type":"Feature","properties":{},"geometry":{"type":"MultiPolygon","coordinates":[[[[-68.6,-52.6],[-67.8,-53.9],[-65.0,-54.7],[-68.6,-54.9],[-68.6,-52.6]]],[[[-57.6,-30.2],[-58.5,-34.4],[-56.8,-36.9],[-62.3,-38.8],[-62.7,-41.0],[-65.1,-41.1],[-63.5,-42.6],[-67.3,-45.6],[-65.6,-47.2],[-69.1,-50.7],[-68.1,-52.3],[-71.9,-52.0],[-73.4,-49.3],[-71.2,-44.8],[-72.1,-42.3],[-68.4,-24.5],[-66.3,-21.8],[-62.8,-22.0],[-57.8,-25.2],[-58.6,-27.1],[-55.7,-27.4],[-54.1,-25.5],[-53.6,-26.9],[-57.6,-30.2]]]]}},{"type":"Feature","properties":{},"geometry":{"type":"MultiPolygon","coordinates":[[[[-68.6,-52.6],[-68.6,-54.9],[-67.0,-54.9],[-68.1,-55.6],[-74.7,-52.8],[-71.1,-54.1],[-68.6,-52.6]]],[[[-69.6,-17.6],[-67.0,-23.0],[-70.5,-31.4],[-69.8,-34.2],[-72.1,-42.3],[-71.2,-44.8],[-73.4,-49.3],[-71.9,-52.0],[-68.6,-52.3],[-71.4,-53.9],[-74.9,-52.3],[-75.6,-48.7],[-74.1,-46.9],[-75.6,-46.6],[-72.7,-42.4],[-74.3,-43.2],[-69.6,-17.6]]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[29.3,-4.5],[30.7,-8.3],[28.7,-8.5],[28.4,-11.8],[29.7,-13.3],[22.2,-11.1],[21.7,-7.3],[17.5,-8.1],[16.3,-5.9],[12.2,-5.8],[16.0,-3.5],[19.5,5.0],[29.7,4.6],[31.2,2.2],[29.3,-4.5]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[41.6,-1.7],[41.0,2.8],[45.0,5.0],[48.9,9.5],[48.9,11.4],[51.1,12.0],[48.6,5.3],[41.6,-1.7]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[39.2,-4.7],[33.9,-0.9],[35.3,5.5],[38.1,3.6],[41.9,3.9],[41.6,-1.7],[39.2,-4.7]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[25.1,10.3],[23.8,8.7],[23.5,9.0],[21.9,12.6],[25.0,22.0],[36.9,22.0],[38.4,18.0],[34.0,8.7],[32.7,12.2],[31.4,9.8],[25.1,10.3]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[23.8,19.6],[23.9,15.6],[21.9,12.6],[22.9,11.1],[15.3,7.4],[13.5,14.4],[15.9,20.4],[14.9,22.9],[23.8,19.6]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[-71.7,19.7],[-71.7,18.0],[-74.5,18.3],[-72.3,18.7],[-73.2,19.9],[-71.7,19.7]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[-71.4,17.6],[-71.6,19.9],[-68.3,18.6],[-71.4,17.6]]]}},{"type":"Feature","properties":{},"geometry":{"type":"MultiPolygon","coordinates":[[[[178.7,71.1],[180.0,71.5],[180.0,70.8],[178.7,71.1]]],[[[49.1,46.4],[46.7,44.6],[47.8,41.2],[36.7,45.2],[40.1,49.6],[31.8,52.1],[32.7,53.4],[30.9,55.6],[27.3,57.5],[29.1,60.0],[28.1,60.5],[31.5,62.9],[30.0,63.6],[28.6,69.1],[32.1,69.9],[41.1,67.5],[38.4,66.0],[33.2,66.6],[37.0,63.8],[37.2,65.1],[43.9,66.1],[43.5,68.6],[46.2,68.2],[46.3,66.7],[53.7,68.9],[59.9,68.3],[60.5,69.8],[68.5,68.1],[66.7,71.0],[69.9,73.0],[72.8,72.2],[71.8,71.4],[73.7,68.4],[71.3,66.3],[72.4,66.2],[75.1,67.8],[73.1,71.4],[74.7,72.8],[76.4,71.2],[81.5,71.8],[80.5,73.6],[104.4,77.7],[114.1,75.8],[109.4,74.2],[127.0,73.6],[131.3,70.8],[139.9,71.5],[139.1,72.4],[140.5,72.8],[159.0,70.9],[160.9,69.4],[180.0,69.0],[180.0,65.0],[177.4,64.6],[179.2,62.3],[170.3,59.9],[163.5,59.9],[162.0,58.2],[163.2,57.6],[162.1,54.9],[156.8,51.0],[155.9,56.8],[164.5,62.6],[160.1,60.5],[156.7,61.4],[154.2,59.8],[155.0,59.1],[142.2,59.0],[135.1,54.7],[141.3,53.1],[140.1,48.4],[134.9,43.4],[130.8,42.2],[131.0,45.0],[133.1,45.1],[135.0,48.5],[131.0,47.8],[123.6,53.5],[120.2,52.8],[117.9,49.5],[108.5,49.3],[98.9,52.0],[97.3,49.7],[92.2,50.8],[87.4,49.2],[80.0,50.9],[76.9,54.5],[73.4,53.5],[69.1,55.4],[61.4,54.0],[60.0,52.0],[61.3,50.8],[50.8,51.7],[47.5,50.5],[46.5,48.4],[49.1,46.4]]],[[[91.2,80.3],[95.9,81.3],[100.2,79.8],[97.8,78.8],[91.2,80.3]]],[[[101.3,79.2],[105.4,78.7],[99.4,77.9],[101.3,79.2]]],[[[137.0,75.3],[141.5,76.1],[145.1,75.6],[137.0,75.3]]],[[[148.2,75.3],[150.7,75.1],[146.1,75.2],[148.2,75.3]]],[[[139.9,73.4],[142.1,73.9],[143.6,73.2],[142.1,73.2],[139.9,73.4]]],[[[44.8,80.6],[50.0,80.9],[51.5,80.7],[47.6,80.0],[44.8,80.6]]],[[[22.7,54.3],[20.9,54.3],[19.7,54.4],[21.3,55.2],[22.7,54.3]]],[[[53.5,73.7],[61.2,76.3],[68.9,76.5],[58.5,74.3],[55.4,72.4],[57.5,70.7],[51.6,71.5],[53.5,73.7]]],[[[142.9,53.7],[144.7,49.0],[143.2,49.3],[143.5,46.1],[142.1,46.0],[141.7,53.3],[142.9,53.7]]],[[[-180.0,69.0],[-169.9,66.0],[-173.0,64.3],[-178.7,66.1],[-180.0,65.0],[-180.0,69.0]]],[[[-177.6,71.3],[-180.0,70.8],[-180.0,71.5],[-177.6,71.3]]],[[[32.5,45.3],[33.7,46.2],[36.5,45.5],[33.9,44.4],[32.5,45.3]]]]}},{"type":"Feature","properties":{},"geometry":{"type":"MultiPolygon","coordinates":[[[[10.4,79.7],[17.0,80.1],[21.5,79.0],[15.9,76.8],[10.4,79.7]]],[[[31.1,69.6],[18.0,68.6],[12.6,64.1],[11.0,58.9],[5.7,58.6],[5.0,62.0],[19.2,69.8],[28.2,71.2],[31.1,69.6]]],[[[27.4,80.1],[23.0,79.4],[17.4,80.3],[22.9,80.7],[27.4,80.1]]],[[[24.7,77.9],[22.5,77.4],[20.7,77.7],[22.9,78.5],[24.7,77.9]]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[-46.8,82.6],[-27.1,83.5],[-20.8,82.7],[-31.9,82.2],[-12.2,81.3],[-20.0,80.2],[-17.7,80.1],[-19.7,78.8],[-18.5,77.0],[-21.7,76.6],[-19.4,74.3],[-24.8,72.3],[-21.8,70.7],[-25.5,71.4],[-26.4,70.2],[-22.3,70.1],[-39.8,65.5],[-43.4,60.1],[-48.3,60.9],[-51.6,63.6],[-54.0,67.2],[-50.9,69.9],[-54.7,69.6],[-54.4,70.8],[-51.4,70.6],[-55.8,71.7],[-54.7,72.6],[-58.6,75.5],[-68.5,76.1],[-71.4,77.0],[-66.8,77.4],[-73.3,78.0],[-65.7,79.4],[-68.0,80.1],[-62.7,81.8],[-44.5,81.7],[-46.8,82.6]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[16.3,-28.6],[19.9,-28.5],[19.9,-24.8],[21.6,-26.7],[25.7,-25.5],[29.4,-22.1],[31.2,-22.3],[31.9,-24.4],[30.7,-26.7],[32.8,-26.7],[28.2,-32.8],[20.1,-34.8],[18.4,-34.1],[16.3,-28.6]],[[28.1,-30.5],[28.1,-28.9],[27.0,-29.9],[28.1,-30.5]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[-117.1,32.5],[-106.5,31.8],[-103.9,29.3],[-101.7,29.8],[-97.1,25.9],[-97.9,22.4],[-95.9,18.8],[-91.4,18.9],[-90.3,21.0],[-87.1,21.5],[-87.8,18.3],[-91.0,17.8],[-90.5,16.1],[-92.2,14.5],[-103.5,18.3],[-113.1,31.2],[-114.9,31.4],[-109.9,22.8],[-115.1,27.7],[-114.2,28.6],[-117.1,32.5]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[-57.6,-30.2],[-53.8,-32.0],[-53.8,-34.4],[-58.4,-33.9],[-57.6,-30.2]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[-53.4,-33.8],[-53.8,-32.0],[-57.6,-30.2],[-53.6,-26.1],[-55.8,-22.4],[-57.9,-22.1],[-58.2,-16.3],[-60.2,-16.3],[-60.5,-13.8],[-65.4,-11.6],[-65.3,-9.8],[-70.5,-11.0],[-70.5,-9.5],[-72.2,-10.1],[-74.0,-7.5],[-72.9,-5.3],[-69.9,-4.3],[-69.8,1.7],[-65.5,0.8],[-63.4,2.2],[-64.8,4.1],[-60.7,5.2],[-59.0,1.3],[-52.9,2.1],[-51.3,4.2],[-50.4,-0.1],[-44.6,-2.7],[-40.0,-2.9],[-35.6,-5.1],[-34.7,-7.3],[-38.7,-13.1],[-40.9,-21.9],[-47.6,-24.9],[-48.9,-28.7],[-53.4,-33.8]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[-69.5,-11.0],[-65.3,-9.8],[-65.4,-11.6],[-60.5,-13.8],[-60.2,-16.3],[-58.2,-16.3],[-57.9,-20.0],[-61.8,-19.6],[-62.7,-22.2],[-67.8,-22.9],[-69.5,-11.0]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[-69.9,-4.3],[-72.9,-5.3],[-74.0,-7.5],[-68.7,-12.6],[-70.4,-18.3],[-76.0,-14.6],[-81.4,-4.7],[-80.3,-3.4],[-78.6,-4.5],[-75.1,-0.1],[-73.1,-2.3],[-70.0,-2.7],[-69.9,-4.3]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[-66.9,1.3],[-69.8,1.7],[-69.9,-4.3],[-70.0,-2.7],[-77.4,0.4],[-79.0,1.7],[-77.1,3.8],[-77.5,8.5],[-71.4,12.4],[-73.3,9.2],[-72.0,7.0],[-67.3,6.1],[-66.9,1.3]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[-77.4,8.7],[-77.9,7.2],[-79.1,9.0],[-80.9,7.2],[-82.9,9.5],[-79.0,9.6],[-77.4,8.7]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[-83.7,10.9],[-83.0,8.2],[-85.9,10.9],[-83.7,10.9]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[-83.7,10.9],[-85.7,11.1],[-87.7,12.9],[-83.1,15.0],[-83.7,10.9]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[-83.1,15.0],[-87.3,13.0],[-89.4,14.4],[-87.9,15.9],[-83.1,15.0]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[-92.2,14.5],[-90.5,16.1],[-91.0,17.8],[-89.1,17.8],[-88.2,15.7],[-89.4,14.4],[-92.2,14.5]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[-60.7,5.2],[-64.8,4.1],[-63.4,2.2],[-66.3,0.7],[-67.8,2.8],[-67.3,6.1],[-72.0,7.0],[-72.9,10.5],[-72.0,11.6],[-71.3,11.8],[-72.1,9.9],[-71.3,9.1],[-69.9,12.2],[-68.2,10.6],[-61.9,10.7],[-59.8,8.4],[-60.7,5.2]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[-56.5,1.9],[-59.6,1.8],[-61.4,6.0],[-59.8,8.4],[-57.1,6.0],[-58.0,4.1],[-56.5,1.9]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[-54.5,2.3],[-56.5,1.9],[-57.6,3.3],[-57.1,6.0],[-54.0,5.8],[-54.5,2.3]]]}},{"type":"Feature","properties":{},"geometry":{"type":"MultiPolygon","coordinates":[[[[-51.7,4.2],[-52.9,2.1],[-54.5,2.3],[-54.0,5.8],[-51.7,4.2]]],[[[2.5,51.1],[8.1,49.0],[6.0,46.7],[7.4,43.7],[1.8,42.3],[-1.9,43.4],[-1.2,46.0],[-4.6,48.7],[-1.6,48.6],[-1.9,49.8],[2.5,51.1]]],[[[8.8,41.6],[9.4,43.0],[9.2,41.4],[8.8,41.6]]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[-75.4,-0.2],[-78.6,-4.5],[-80.4,-4.4],[-80.1,0.8],[-75.4,-0.2]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[-82.3,23.2],[-78.3,22.5],[-74.2,20.3],[-77.8,19.9],[-81.8,22.6],[-85.0,21.9],[-82.3,23.2]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[31.2,-22.3],[28.0,-21.5],[25.3,-17.7],[30.3,-15.5],[32.8,-16.7],[31.2,-22.3]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[29.4,-22.1],[25.7,-25.5],[21.6,-26.7],[19.9,-24.8],[20.9,-18.3],[25.3,-17.7],[29.4,-22.1]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[20.9,-18.3],[19.9,-28.5],[16.3,-28.6],[11.7,-17.3],[25.1,-17.6],[20.9,-18.3]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[-13.8,13.5],[-17.6,14.7],[-14.6,16.6],[-11.5,12.4],[-16.7,12.4],[-13.8,13.5]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[-11.5,12.4],[-11.7,15.4],[-5.5,15.5],[-6.5,25.0],[4.3,19.2],[3.6,15.6],[-4.0,13.5],[-5.4,10.4],[-11.5,12.4]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[-17.1,21.0],[-12.9,21.3],[-12.0,25.9],[-8.7,25.9],[-8.7,27.4],[-4.9,25.0],[-6.5,25.0],[-5.5,15.5],[-12.2,14.6],[-14.6,16.6],[-16.5,16.1],[-17.1,21.0]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[2.7,6.3],[0.8,10.5],[2.8,12.2],[3.8,10.7],[2.7,6.3]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[14.9,22.9],[15.9,20.4],[13.5,14.4],[14.2,12.5],[5.4,13.9],[3.6,11.7],[1.0,12.9],[0.4,14.9],[3.6,15.6],[4.3,19.2],[12.0,23.5],[14.9,22.9]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[2.7,6.3],[4.4,13.7],[13.1,13.6],[14.6,12.1],[11.7,7.0],[8.5,4.8],[5.9,4.3],[2.7,6.3]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[14.5,12.9],[15.5,10.0],[14.0,9.5],[15.4,7.7],[14.5,4.7],[15.9,1.7],[9.6,2.3],[8.8,5.5],[11.7,7.0],[14.5,12.9]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[-0.0,10.7],[1.9,6.1],[1.1,5.9],[-0.0,10.7]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[0.0,11.0],[1.1,5.9],[-2.9,5.0],[-2.9,11.0],[0.0,11.0]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[-8.0,10.2],[-2.8,9.6],[-2.9,5.0],[-7.7,4.4],[-8.0,10.2]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[-13.7,12.6],[-9.1,12.3],[-8.3,7.7],[-11.1,10.0],[-13.2,8.9],[-15.1,11.0],[-13.7,12.6]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[-16.7,12.4],[-13.7,12.6],[-13.7,11.8],[-15.1,11.0],[-16.7,12.4]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[-10.2,8.4],[-7.6,5.7],[-7.7,4.4],[-11.4,6.8],[-10.2,8.4]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[-13.2,8.9],[-11.1,10.0],[-10.2,8.4],[-11.4,6.8],[-13.2,8.9]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[-5.4,10.4],[-4.3,13.2],[-1.1,15.0],[2.2,12.6],[0.9,11.0],[-2.9,11.0],[-2.8,9.6],[-5.4,10.4]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[27.4,5.2],[22.4,4.0],[19.5,5.0],[16.0,2.3],[14.5,5.5],[15.3,7.4],[22.9,11.1],[27.4,5.2]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[18.5,3.5],[16.0,-3.5],[11.9,-5.0],[11.5,-2.8],[14.4,-1.3],[13.1,2.3],[15.9,1.7],[18.5,3.5]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[11.3,2.3],[14.3,1.2],[14.4,-1.3],[11.1,-4.0],[8.8,-1.1],[11.3,2.3]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[30.7,-8.3],[33.2,-9.7],[33.2,-14.0],[27.0,-17.9],[23.2,-17.5],[21.9,-12.9],[24.0,-12.9],[23.9,-10.9],[29.7,-13.3],[28.4,-9.2],[30.7,-8.3]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[32.8,-9.2],[34.3,-10.2],[35.7,-14.6],[35.0,-16.8],[32.7,-13.7],[32.8,-9.2]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[34.6,-11.5],[40.3,-10.3],[40.8,-14.7],[34.8,-19.8],[35.5,-24.1],[32.1,-26.7],[31.2,-22.3],[32.8,-16.7],[30.2,-14.8],[33.2,-14.0],[35.0,-16.8],[34.6,-11.5]]]}},{"type":"Feature","properties":{},"geometry":{"type":"MultiPolygon","coordinates":[[[[11.9,-5.0],[12.6,-5.0],[12.2,-5.8],[11.9,-5.0]]],[[[12.3,-6.1],[16.3,-5.9],[17.5,-8.1],[21.7,-7.3],[22.2,-11.1],[24.0,-11.2],[24.0,-12.9],[21.9,-12.9],[23.2,-17.5],[11.7,-17.3],[13.7,-11.3],[12.3,-6.1]]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[49.5,-12.5],[50.4,-15.7],[47.1,-24.9],[45.4,-25.6],[43.3,-22.8],[44.0,-17.4],[49.5,-12.5]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[9.5,30.3],[7.5,34.1],[9.5,37.3],[11.0,37.1],[10.1,34.3],[11.5,33.1],[9.5,30.3]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[-8.7,27.4],[-8.7,28.8],[-1.3,32.3],[-1.2,35.7],[8.4,36.9],[7.5,34.1],[9.8,29.4],[9.3,26.1],[12.0,23.5],[3.2,19.1],[-8.7,27.4]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[35.5,32.4],[38.8,33.4],[39.2,32.2],[37.0,31.5],[38.0,30.5],[36.1,29.2],[34.9,29.5],[35.5,32.4]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[51.6,24.2],[54.0,24.1],[56.3,25.7],[55.0,22.5],[51.6,24.2]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[39.2,32.2],[41.3,36.4],[44.8,37.2],[48.6,29.9],[44.7,29.2],[39.2,32.2]]]}},{"type":"Feature","properties":{},"geometry":{"type":"MultiPolygon","coordinates":[[[[55.0,20.0],[56.4,24.9],[59.8,22.3],[57.7,18.9],[53.1,16.7],[52.0,19.0],[55.0,20.0]]],[[[56.5,26.3],[56.1,26.1],[56.4,26.4],[56.5,26.3]]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[103.5,10.6],[103.0,14.2],[107.6,13.5],[106.2,11.0],[103.5,10.6]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[105.2,14.3],[103.0,14.2],[102.6,12.2],[100.1,13.4],[99.2,9.2],[102.1,6.2],[101.2,5.7],[98.2,8.4],[99.6,11.9],[97.4,18.4],[100.1,20.4],[101.1,17.5],[104.7,17.4],[105.2,14.3]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[107.4,14.2],[105.2,14.3],[104.0,18.2],[101.1,17.5],[100.1,20.4],[101.7,22.3],[104.4,20.8],[103.9,19.3],[107.4,14.2]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[101.2,21.8],[97.4,18.4],[99.6,11.9],[98.6,9.9],[97.2,16.9],[94.2,16.0],[92.3,21.5],[97.3,28.3],[98.7,27.5],[97.6,23.9],[101.2,21.8]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[104.3,10.5],[107.5,12.3],[107.6,15.2],[102.2,22.5],[105.3,23.4],[108.1,21.6],[105.7,19.1],[108.9,15.3],[109.2,11.7],[105.2,8.6],[104.3,10.5]]]}},{"type":"Feature","properties":{},"geometry":{"type":"MultiPolygon","coordinates":[[[[130.8,42.2],[130.8,42.2],[130.8,42.2],[130.8,42.2]]],[[[130.6,42.4],[127.5,39.8],[128.2,38.4],[124.7,38.1],[125.1,40.6],[130.6,42.4]]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[126.2,37.7],[128.3,38.6],[129.1,35.1],[126.5,34.4],[126.2,37.7]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[87.8,49.3],[92.2,50.8],[97.3,49.7],[98.9,52.0],[108.5,49.3],[116.7,49.9],[115.7,47.7],[119.8,47.0],[105.0,41.6],[96.3,42.7],[90.9,45.3],[91.0,46.9],[87.8,49.3]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[97.3,28.3],[92.7,22.0],[91.2,23.5],[92.4,25.0],[88.6,26.4],[88.9,21.7],[80.3,15.9],[79.9,10.4],[77.5,8.0],[72.6,21.4],[70.5,20.9],[68.2,23.7],[71.0,24.4],[69.5,26.9],[75.3,32.3],[73.7,34.3],[77.8,35.5],[78.7,31.5],[81.1,30.2],[80.1,28.8],[83.3,27.4],[88.1,26.4],[88.7,28.1],[92.0,26.8],[96.1,29.5],[97.3,28.3]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[91.2,23.5],[92.4,20.7],[91.4,22.8],[89.0,22.1],[88.6,26.4],[92.4,25.0],[91.2,23.5]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[90.0,28.3],[92.0,26.8],[88.8,27.1],[90.0,28.3]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[88.1,27.9],[87.2,26.4],[80.1,28.8],[81.5,30.4],[88.1,27.9]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[77.8,35.5],[73.7,34.3],[75.3,32.3],[69.5,26.9],[71.0,24.4],[61.5,25.1],[63.3,26.8],[60.9,29.8],[66.3,29.9],[71.8,36.5],[75.2,37.1],[77.8,35.5]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[61.2,35.7],[70.8,38.5],[71.8,36.7],[75.2,37.1],[71.3,36.1],[69.3,31.9],[66.3,29.9],[60.9,29.8],[61.2,35.7]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[67.8,37.1],[67.7,39.6],[70.7,41.0],[69.5,39.5],[73.7,39.4],[75.0,37.4],[71.8,36.7],[70.8,38.5],[67.8,37.1]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[71.0,42.3],[74.2,43.3],[80.3,42.3],[73.7,39.4],[69.5,39.5],[73.1,40.9],[71.0,42.3]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[52.5,41.8],[54.1,42.3],[57.1,41.3],[58.6,42.8],[66.5,37.4],[62.2,35.3],[57.3,38.0],[53.9,37.2],[52.7,40.0],[54.7,41.0],[52.5,41.8]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[48.6,29.9],[45.4,34.0],[46.1,35.7],[44.1,39.4],[48.1,39.6],[50.8,36.9],[56.6,38.1],[61.1,36.5],[60.9,29.8],[63.3,26.8],[61.5,25.1],[57.4,25.7],[48.6,29.9]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[35.7,32.7],[36.7,36.8],[42.3,37.2],[41.0,34.4],[35.7,32.7]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[46.5,38.8],[43.7,40.3],[43.6,41.1],[45.6,40.8],[46.5,38.8]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[11.0,58.9],[12.6,61.3],[11.9,63.1],[16.8,68.0],[20.6,69.1],[23.5,67.9],[23.9,66.0],[17.8,62.7],[17.1,61.3],[18.8,60.1],[15.9,56.1],[12.9,55.4],[11.0,58.9]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[28.2,56.2],[30.9,55.6],[32.7,53.4],[31.8,52.1],[23.5,51.6],[23.5,53.9],[28.2,56.2]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[31.8,52.1],[40.1,49.6],[39.7,47.9],[35.0,45.7],[31.7,46.7],[28.7,45.3],[30.0,46.4],[28.7,48.1],[22.1,48.4],[23.5,51.6],[31.8,52.1]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[23.5,53.9],[24.0,50.7],[22.8,49.0],[16.2,50.4],[14.1,53.0],[17.6,54.9],[23.5,53.9]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[17.0,48.1],[14.6,46.4],[9.5,47.1],[12.9,47.5],[13.6,48.9],[17.0,48.1]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[22.1,48.4],[21.0,46.3],[16.2,46.9],[17.0,48.1],[22.1,48.4]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[26.6,48.2],[28.7,48.1],[30.0,46.4],[28.2,45.5],[26.6,48.2]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[26.6,48.2],[29.6,45.3],[28.6,43.7],[22.9,43.8],[20.2,46.1],[26.6,48.2]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[26.5,55.6],[23.5,53.9],[21.1,56.0],[24.9,56.4],[26.5,55.6]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[27.3,57.5],[28.2,56.2],[26.5,55.6],[21.1,56.0],[22.5,57.8],[27.3,57.5]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[28.0,59.5],[27.3,57.5],[23.3,59.2],[25.9,59.6],[28.0,59.5]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[14.1,53.8],[15.0,51.1],[12.2,50.3],[12.9,47.5],[7.5,47.6],[8.1,49.0],[6.0,50.1],[7.1,53.7],[9.9,55.0],[14.1,53.8]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[23.0,41.3],[22.9,43.8],[28.6,43.7],[28.0,42.0],[23.0,41.3]]]}},{"type":"Feature","properties":{},"geometry":{"type":"MultiPolygon","coordinates":[[[[26.3,35.3],[24.7,34.9],[23.5,35.3],[23.7,35.7],[26.3,35.3]]],[[[20.2,39.6],[26.6,41.6],[22.6,40.3],[24.0,37.7],[22.5,36.4],[20.2,39.6]]]]}},{"type":"Feature","properties":{},"geometry":{"type":"MultiPolygon","coordinates":[[[[44.8,37.2],[29.7,36.1],[27.6,36.7],[26.2,39.5],[33.5,42.0],[42.6,41.6],[44.8,39.7],[44.8,37.2]]],[[[26.1,41.8],[28.0,42.0],[29.0,41.3],[26.4,40.2],[26.1,41.8]]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[21.0,40.8],[19.4,40.3],[19.7,42.7],[20.5,42.2],[21.0,40.8]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[16.6,46.5],[19.4,45.2],[15.8,44.8],[18.5,42.5],[13.7,45.1],[16.6,46.5]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[6.7,47.5],[10.4,46.5],[6.0,46.3],[6.7,47.5]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[5.0,51.5],[5.7,49.5],[2.5,51.1],[5.0,51.5]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[6.9,53.5],[6.2,50.8],[3.3,51.3],[4.7,53.1],[6.9,53.5]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[-9.0,41.9],[-6.4,41.4],[-7.9,36.8],[-9.5,38.7],[-9.0,41.9]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[-7.5,37.1],[-6.4,41.4],[-9.4,43.0],[3.0,42.5],[-2.1,36.7],[-7.5,37.1]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[-7.6,55.1],[-6.8,52.3],[-10.0,51.8],[-7.6,55.1]]]}},{"type":"Feature","properties":{},"geometry":{"type":"MultiPolygon","coordinates":[[[[178.5,-37.7],[174.7,-41.3],[174.7,-37.4],[172.6,-34.5],[176.0,-37.6],[178.5,-37.7]]],[[[166.7,-46.2],[172.8,-40.5],[174.2,-41.3],[170.6,-45.9],[166.7,-46.2]]]]}},{"type":"Feature","properties":{},"geometry":{"type":"MultiPolygon","coordinates":[[[[147.7,-40.8],[147.9,-43.2],[146.0,-43.5],[144.7,-40.7],[147.7,-40.8]]],[[[131.3,-31.5],[118.0,-35.1],[115.0,-34.2],[113.7,-22.5],[120.9,-19.7],[125.7,-14.2],[129.6,-15.0],[132.4,-11.1],[136.5,-11.9],[135.5,-15.0],[140.2,-17.7],[142.5,-10.7],[146.4,-19.0],[150.7,-22.4],[153.6,-28.1],[150.0,-37.4],[146.3,-39.0],[140.6,-38.0],[138.2,-34.4],[136.8,-35.3],[137.8,-32.9],[136.0,-34.9],[131.3,-31.5]]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[81.8,7.5],[80.3,6.0],[80.1,9.8],[80.8,9.3],[81.8,7.5]]]}},{"type":"Feature","properties":{},"geometry":{"type":"MultiPolygon","coordinates":[[[[110.3,18.7],[108.6,19.4],[110.8,20.1],[110.3,18.7]]],[[[80.3,42.3],[80.0,44.9],[87.8,49.3],[91.0,46.9],[90.9,45.3],[96.3,42.7],[109.2,42.5],[111.9,45.1],[119.7,46.7],[115.5,48.1],[122.2,53.4],[125.9,52.8],[131.0,47.8],[135.0,48.5],[133.1,45.1],[131.0,45.0],[130.6,42.4],[121.1,38.9],[121.6,40.9],[117.5,38.7],[122.4,37.5],[119.2,34.9],[121.9,31.7],[121.7,28.2],[118.7,24.5],[110.4,20.3],[105.3,23.4],[101.7,22.3],[101.8,21.2],[99.2,22.1],[97.6,23.9],[98.7,27.5],[96.1,29.5],[88.8,27.3],[78.7,31.5],[78.9,34.3],[73.7,39.4],[80.3,42.3]]]]}},{"type":"Feature","properties":{},"geometry":{"type":"MultiPolygon","coordinates":[[[[6.8,46.0],[13.8,46.5],[12.6,44.1],[18.4,40.4],[18.3,39.8],[16.9,40.4],[15.7,37.9],[15.4,40.0],[10.2,43.9],[7.4,43.7],[6.8,46.0]]],[[[14.8,38.1],[15.1,36.6],[12.4,37.6],[12.6,38.1],[14.8,38.1]]],[[[8.2,41.0],[9.8,40.5],[8.8,38.9],[8.2,41.0]]]]}},{"type":"Feature","properties":{},"geometry":{"type":"MultiPolygon","coordinates":[[[[9.9,55.0],[8.1,56.5],[10.6,57.7],[10.9,56.5],[9.9,55.0]]],[[[12.4,56.1],[12.1,54.8],[11.0,55.4],[10.9,55.8],[12.4,56.1]]]]}},{"type":"Feature","properties":{},"geometry":{"type":"MultiPolygon","coordinates":[[[[-5.7,54.6],[-7.6,54.1],[-7.6,55.1],[-5.7,54.6]]],[[[-3.1,53.4],[-6.1,56.8],[-5.0,58.6],[-2.0,57.7],[-3.1,56.0],[1.7,52.7],[1.4,51.3],[-5.8,50.2],[-3.4,51.4],[-5.3,52.0],[-4.6,53.5],[-3.1,53.4]]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[-14.5,66.5],[-13.6,65.1],[-18.7,63.5],[-22.8,64.0],[-21.8,64.4],[-24.0,64.9],[-22.2,65.4],[-24.3,65.6],[-14.5,66.5]]]}},{"type":"Feature","properties":{},"geometry":{"type":"MultiPolygon","coordinates":[[[[45.0,41.2],[50.4,40.3],[48.9,38.3],[45.6,39.9],[45.0,41.2]]],[[[45.7,39.5],[45.5,38.9],[44.8,39.7],[45.7,39.5]]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[40.0,43.4],[45.5,42.5],[46.6,41.2],[41.6,41.5],[40.0,43.4]]]}},{"type":"Feature","properties":{},"geometry":{"type":"MultiPolygon","coordinates":[[[[120.8,12.7],[120.3,13.5],[121.5,13.1],[120.8,12.7]]],[[[123.0,9.0],[122.9,10.9],[124.1,11.2],[123.0,9.0]]],[[[125.4,9.8],[125.4,5.6],[123.6,7.8],[121.9,7.2],[125.4,9.8]]],[[[119.7,10.6],[117.2,8.4],[119.5,11.4],[119.7,10.6]]],[[[122.3,18.2],[121.7,14.3],[124.0,13.8],[124.1,12.5],[119.9,15.4],[120.7,18.5],[122.3,18.2]]],[[[122.0,10.4],[121.9,11.9],[123.1,11.6],[122.0,10.4]]],[[[124.3,12.6],[125.8,11.0],[124.8,10.1],[124.3,12.6]]]]}},{"type":"Feature","properties":{},"geometry":{"type":"MultiPolygon","coordinates":[[[[100.1,6.5],[103.0,5.5],[104.2,1.3],[101.4,2.8],[100.1,6.5]]],[[[119.2,5.4],[115.9,4.3],[114.6,1.4],[109.8,1.3],[115.3,4.3],[116.7,6.9],[119.2,5.4]]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[27.7,70.2],[31.1,62.4],[28.1,60.5],[21.3,60.7],[21.5,63.2],[25.4,65.1],[20.6,69.1],[24.7,68.6],[27.7,70.2]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[22.6,49.1],[17.9,47.8],[16.9,48.5],[18.6,49.5],[22.6,49.1]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[15.0,51.1],[17.6,50.4],[18.9,49.5],[12.5,49.5],[15.0,51.1]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[36.4,14.4],[38.4,18.0],[43.1,12.7],[40.0,14.5],[36.4,14.4]]]}},{"type":"Feature","properties":{},"geometry":{"type":"MultiPolygon","coordinates":[[[[141.9,39.2],[140.3,35.1],[135.8,33.5],[135.1,34.6],[131.0,33.9],[132.0,33.1],[130.2,31.4],[129.4,33.3],[139.4,38.2],[140.3,41.2],[141.9,39.2]]],[[[142.0,45.6],[145.5,43.3],[140.0,41.6],[142.0,45.6]]],[[[133.0,32.7],[133.9,34.4],[134.8,33.8],[133.0,32.7]]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[-58.2,-20.2],[-57.9,-22.1],[-54.3,-24.0],[-55.7,-27.4],[-58.6,-27.1],[-57.8,-25.2],[-62.7,-22.2],[-61.8,-19.6],[-58.2,-20.2]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[52.0,19.0],[52.2,15.6],[43.5,12.6],[43.4,17.6],[47.0,16.9],[52.0,19.0]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[35.0,29.4],[39.2,32.2],[47.5,29.0],[52.0,23.0],[55.2,22.7],[55.0,20.0],[47.0,16.9],[43.4,17.6],[42.8,16.3],[35.0,29.4]]]}},{"type":"Feature","properties":{},"geometry":{"type":"MultiPolygon","coordinates":[[[[-48.7,-78.0],[-43.9,-78.5],[-43.3,-80.0],[-54.2,-80.6],[-48.7,-78.0]]],[[[-66.3,-80.3],[-60.6,-79.6],[-59.6,-80.0],[-60.2,-81.0],[-66.3,-80.3]]],[[[-75.0,-72.1],[-70.3,-68.9],[-68.3,-71.4],[-75.0,-72.1]]],[[[-102.3,-71.9],[-96.8,-72.0],[-96.2,-72.5],[-100.8,-72.5],[-102.3,-71.9]]],[[[-120.2,-74.1],[-122.4,-73.3],[-118.7,-73.5],[-120.2,-74.1]]],[[[-125.9,-73.7],[-126.6,-73.2],[-124.0,-73.9],[-125.9,-73.7]]],[[[-163.7,-78.6],[-161.2,-78.4],[-159.2,-79.5],[-161.1,-79.6],[-163.7,-78.6]]],[[[180.0,-84.7],[180.0,-90.0],[-180.0,-90.0],[-179.1,-84.1],[-143.1,-85.0],[-153.6,-83.7],[-152.9,-82.0],[-156.8,-81.1],[-146.4,-80.3],[-155.3,-79.1],[-158.4,-76.9],[-151.3,-77.4],[-146.1,-76.5],[-146.2,-75.4],[-135.2,-74.3],[-100.1,-74.9],[-103.7,-72.6],[-74.9,-73.9],[-67.4,-72.5],[-67.7,-67.3],[-63.6,-64.9],[-57.8,-63.3],[-65.7,-68.0],[-61.8,-70.7],[-60.8,-73.7],[-70.6,-76.6],[-77.2,-76.7],[-73.7,-77.9],[-78.0,-79.2],[-58.2,-83.2],[-28.5,-80.3],[-35.6,-79.5],[-35.8,-78.3],[-17.5,-75.1],[-15.4,-73.1],[-6.9,-70.9],[27.1,-70.5],[33.9,-68.5],[38.6,-69.8],[54.5,-65.8],[61.4,-68.0],[68.9,-67.9],[69.7,-69.2],[67.9,-71.9],[69.9,-72.3],[73.9,-69.9],[88.0,-66.2],[95.8,-67.4],[102.8,-65.6],[106.2,-66.9],[113.6,-65.9],[119.8,-67.3],[135.1,-65.3],[137.5,-67.0],[145.5,-66.9],[171.2,-71.7],[163.6,-76.2],[167.0,-78.8],[161.8,-79.2],[159.8,-80.9],[169.4,-83.8],[180.0,-84.7]]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[-2.2,35.2],[-1.3,32.3],[-8.7,28.8],[-8.8,27.1],[-11.4,26.9],[-14.8,21.5],[-17.0,21.4],[-14.4,26.3],[-9.6,29.9],[-8.7,33.2],[-5.9,35.8],[-2.2,35.2]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[36.9,22.0],[25.0,22.0],[25.2,31.6],[34.3,31.2],[34.2,27.8],[32.3,29.8],[36.9,22.0]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[24.9,31.9],[23.8,19.6],[10.3,24.4],[10.0,31.4],[11.5,33.1],[19.1,30.3],[20.9,32.7],[24.9,31.9]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[47.8,8.0],[45.0,5.0],[39.6,3.4],[36.2,4.4],[33.0,7.8],[37.9,15.0],[41.6,13.5],[43.7,9.2],[47.8,8.0]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[48.9,11.4],[47.8,8.0],[42.6,10.6],[43.1,11.5],[44.1,10.4],[48.9,11.4]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[33.9,-0.9],[29.6,-1.3],[31.2,3.8],[34.5,3.6],[33.9,-0.9]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[18.6,42.6],[16.5,44.0],[16.0,45.2],[19.4,44.9],[18.6,42.6]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[18.8,45.9],[22.7,44.6],[22.5,42.5],[19.2,43.5],[18.8,45.9]]]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[30.8,3.5],[23.9,8.6],[25.8,10.4],[31.4,9.8],[33.2,12.2],[33.0,7.8],[35.3,5.5],[30.8,3.5]]]}}]};

      async function initRIU() {
        const wrap = document.getElementById('riu-amazon-canvas');
        const fallback = document.getElementById('riu-fallback');
        const yearEl = document.getElementById('riu-year');
        if (!wrap) return;

        try { await ensureThree(); }
        catch (e) { if (fallback) fallback.textContent = 'WebGL unavailable'; return; }

        const w = wrap.offsetWidth || 260;
        const h = wrap.offsetHeight || 208;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf0ebdb);

        const camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 200);
        camera.up.set(0, 0, 1);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        renderer.setSize(w, h);
        wrap.appendChild(renderer.domElement);

        scene.add(new THREE.AmbientLight(0xffffff, 0.85));
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.45);
        dirLight.position.set(3, 3, 10);
        scene.add(dirLight);

        // Coord conversion: lon/lat → local XY (centered on the Amazon)
        const CENTER_LON = -61.6, CENTER_LAT = -5.3, SCALE = 0.115;
        function toLocal(lon, lat) { return [(lon - CENTER_LON) * SCALE, (lat - CENTER_LAT) * SCALE]; }

        // ── Positron-style basemap: filled country polygons + borders ──
        // Land is a soft warm grey that reads clearly against the cream page,
        // borders a deeper taupe — echoing CARTO Positron's light land / grey lines.
        const LAND_Z = -0.02;    // sits below everything
        const landMat = new THREE.MeshBasicMaterial({ color: 0xcfc9b8, side: THREE.DoubleSide });
        const borderMat = new THREE.LineBasicMaterial({ color: 0x9a927e, transparent: true, opacity: 0.95 });

        function ringToShape(ring) {
          const shape = new THREE.Shape();
          var p0 = toLocal(ring[0][0], ring[0][1]);
          shape.moveTo(p0[0], p0[1]);
          for (var i = 1; i < ring.length; i++) {
            var p = toLocal(ring[i][0], ring[i][1]);
            shape.lineTo(p[0], p[1]);
          }
          return shape;
        }

        Object.keys(SA_COUNTRIES).forEach(function(name) {
          SA_COUNTRIES[name].forEach(function(ring) {
            // Filled land
            const shape = ringToShape(ring);
            const geom = new THREE.ShapeGeometry(shape);
            const mesh = new THREE.Mesh(geom, landMat);
            mesh.position.z = LAND_Z;
            scene.add(mesh);
            // Border line
            const pts = ring.map(function(c) {
              var p = toLocal(c[0], c[1]);
              return new THREE.Vector3(p[0], p[1], LAND_Z + 0.005);
            });
            const bgeom = new THREE.BufferGeometry().setFromPoints(pts);
            scene.add(new THREE.Line(bgeom, borderMat));
          });
        });

        // Country name labels (sprites) — Positron-like, subtle grey small caps
        function makeLabelSprite(text) {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const fs = 48;
          canvas.width = 512; canvas.height = 96;
          ctx.font = '600 ' + fs + 'px "IBM Plex Mono", monospace';
          ctx.fillStyle = 'rgba(90,92,78,0.92)';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(text.toUpperCase(), 256, 52);
          const tex = new THREE.CanvasTexture(canvas);
          tex.needsUpdate = true;
          const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
          const sprite = new THREE.Sprite(mat);
          sprite.scale.set(1.6, 0.3, 1);
          return sprite;
        }

        const labelSprites = [];
        Object.keys(SA_LABELS).forEach(function(name) {
          var pos = toLocal(SA_LABELS[name][0], SA_LABELS[name][1]);
          var sprite = makeLabelSprite(name);
          sprite.position.set(pos[0], pos[1], 0.02);
          scene.add(sprite);
          labelSprites.push(sprite);
        });

        // ── Amazon polygon (extruded, highlighted green) ──
        const shape = new THREE.Shape();
        var ap0 = toLocal(AMAZON_COORDS[0][0], AMAZON_COORDS[0][1]);
        shape.moveTo(ap0[0], ap0[1]);
        for (var i = 1; i < AMAZON_COORDS.length; i++) {
          var ap = toLocal(AMAZON_COORDS[i][0], AMAZON_COORDS[i][1]);
          shape.lineTo(ap[0], ap[1]);
        }
        const extrudeGeom = new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: false });
        extrudeGeom.translate(0, 0, 0.01);
        const amazonMat = new THREE.MeshStandardMaterial({
          color: 0x4a7a3a, roughness: 0.85, metalness: 0.03,
          transparent: true, opacity: 0.62
        });
        scene.add(new THREE.Mesh(extrudeGeom, amazonMat));
        const edges = new THREE.EdgesGeometry(extrudeGeom);
        scene.add(new THREE.LineSegments(edges, new THREE.LineBasicMaterial({
          color: 0x2a6b23, opacity: 0.7, transparent: true
        })));

        // ── Towers ──
        const colorMap = { growth: 0x871626, stable: 0xb18c35, volatile: 0x4c0e69, scatter: 0x3f7a8f };
        const towerGeom = new THREE.BoxGeometry(0.05, 0.05, 1);
        towerGeom.translate(0, 0, 0.5);
        const towers = TOWER_DATA.towers.map(function(t) {
          var pos = toLocal(t.lon, t.lat);
          var mat = new THREE.MeshStandardMaterial({
            color: colorMap[t.pattern] || 0x3f7a8f, roughness: 0.5, metalness: 0.15
          });
          var mesh = new THREE.Mesh(towerGeom, mat);
          mesh.position.set(pos[0], pos[1], 0.07);
          mesh.scale.z = t.heights[0];
          scene.add(mesh);
          return { mesh: mesh, heights: t.heights };
        });

        const YEARS = TOWER_DATA.years;
        if (yearEl) yearEl.textContent = YEARS[0];

        // ── Camera choreography ──
        // Two framings that the camera eases between on a loop:
        //   WIDE  = pulled back, whole South America visible
        //   CLOSE = zoomed into the Amazon
        // Amazon center is at local (0,0). South America centroid is further south.
        // WIDE frames the whole continent (centered a bit south of the Amazon,
        // since the landmass extends far south); CLOSE frames just the Amazon.
        const WIDE  = { tx: 0.15, ty: -1.7, r: 10.5, elev: 8.5 };
        const CLOSE = { tx: 0, ty: 0, r: 5.2, elev: 3.8 };

        let yearIdx = 0;
        let lastYearChange = performance.now();
        const yearInterval = 2200;

        // Zoom cycle: dwell mostly in the Amazon close-up (~75%), briefly pull
        // out to the whole continent (~25%). Same slow easing as before.
        const zoomPeriod = 20000; // full close→wide→close loop in ms
        const wideFraction = 0.25; // portion of the loop spent pulled out
        const startTime = Date.now();
        // Base viewing angle (azimuth). Instead of a full 360° spin we sway
        // gently around this heading so the map stays upright and readable.
        const baseAngle = -Math.PI / 2.35;

        function easeInOut(t) { return t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2)/2; }
        function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
        function lerp(a, b, t) { return a + (b - a) * t; }

        function animate(now) {
          requestAnimationFrame(animate);

          // Year cycling (towers)
          if (now - lastYearChange > yearInterval) {
            yearIdx = (yearIdx + 1) % YEARS.length;
            lastYearChange = now;
            if (yearEl) yearEl.textContent = YEARS[yearIdx];
          }
          var rawT = Math.min(1, (now - lastYearChange) / (yearInterval * 0.7));
          var eased = easeOutCubic(rawT);
          var prevIdx = (yearIdx - 1 + YEARS.length) % YEARS.length;
          for (var k = 0; k < towers.length; k++) {
            var st = towers[k].heights[prevIdx], en = towers[k].heights[yearIdx];
            towers[k].mesh.scale.z = st + (en - st) * eased;
          }

          // Zoom: asymmetric loop. Stay CLOSE for (1 - wideFraction) of the
          // period, spend the middle wideFraction pulled out to WIDE, easing
          // both directions. zt = 0 → CLOSE, zt = 1 → WIDE.
          var phase = ((Date.now() - startTime) % zoomPeriod) / zoomPeriod; // 0..1
          var zt;
          if (phase < 0.5 - wideFraction / 2) {
            zt = 0;                                  // holding on the Amazon
          } else if (phase < 0.5 + wideFraction / 2) {
            // within the "pull out and back" window
            var local = (phase - (0.5 - wideFraction / 2)) / wideFraction; // 0..1
            var tri = local < 0.5 ? (local * 2) : (2 - local * 2);          // 0..1..0
            zt = easeInOut(tri);
          } else {
            zt = 0;                                  // back on the Amazon
          }

          var tx = lerp(CLOSE.tx, WIDE.tx, zt);
          var ty = lerp(CLOSE.ty, WIDE.ty, zt);
          var r  = lerp(CLOSE.r,  WIDE.r,  zt);
          var elev = lerp(CLOSE.elev, WIDE.elev, zt);

          // Gentle sway (not a full spin): oscillate the azimuth by a few
          // degrees so the scene has life while staying upright.
          var swayAmpl = reducedMotion ? 0 : 0.16; // radians (~9°)
          var camAngle = baseAngle + (reducedMotion ? 0 : Math.sin(now * 0.00018) * swayAmpl);

          camera.position.x = tx + r * Math.cos(camAngle);
          camera.position.y = ty + r * Math.sin(camAngle);
          camera.position.z = elev;
          camera.lookAt(tx, ty, 0);

          // Labels scale a touch with zoom and fade out when fully zoomed in
          // (so they anchor the wide continental view without cluttering the Amazon).
          var labelScale = lerp(1.0, 1.7, zt);
          var labelOpacity = lerp(0.12, 1.0, zt);
          for (var li = 0; li < labelSprites.length; li++) {
            labelSprites[li].scale.set(1.6 * labelScale, 0.3 * labelScale, 1);
            labelSprites[li].material.opacity = labelOpacity;
          }

          renderer.render(scene, camera);
        }
        requestAnimationFrame(animate);
        wrap.classList.add('viz-loaded');

        window.addEventListener('resize', function() {
          var nw = wrap.offsetWidth, nh = wrap.offsetHeight;
          if (nw > 0 && nh > 0) {
            renderer.setSize(nw, nh);
            camera.aspect = nw / nh;
            camera.updateProjectionMatrix();
          }
        });
      }

      // ═════════ 2. PTI: three-globe (shared THREE) ═════════
      async function initPTI() {
        const container = document.getElementById('pti-globe-canvas');
        const fallback = document.getElementById('pti-fallback');
        if (!container) return;

        try { await ensureThree(); }
        catch (e) { if (fallback) fallback.textContent = 'Globe unavailable'; return; }

        if (typeof ThreeGlobe === 'undefined') {
          if (fallback) fallback.textContent = 'Globe unavailable';
          return;
        }

        const cities = [
          { name: 'New York',    lat: 40.7,  lng: -74.0 },
          { name: 'London',      lat: 51.5,  lng: -0.1  },
          { name: 'Frankfurt',   lat: 50.1,  lng:  8.7  },
          { name: 'Moscow',      lat: 55.8,  lng: 37.6  },
          { name: 'Dubai',       lat: 25.2,  lng: 55.3  },
          { name: 'Mumbai',      lat: 19.1,  lng: 72.9  },
          { name: 'Shanghai',    lat: 31.2,  lng: 121.5 },
          { name: 'Tokyo',       lat: 35.7,  lng: 139.7 },
          { name: 'Sydney',      lat: -33.9, lng: 151.2 },
          { name: 'São Paulo',   lat: -23.5, lng: -46.6 },
          { name: 'Cape Town',   lat: -33.9, lng:  18.4 },
          { name: 'Lagos',       lat:  6.5,  lng:  3.4  },
          { name: 'Los Angeles', lat: 34.0,  lng:-118.2 },
          { name: 'Mexico City', lat: 19.4,  lng: -99.1 },
          { name: 'Singapore',   lat:  1.4,  lng: 103.8 }
        ];
        const colors = ['#c93346', '#7d2da8', '#2e8aa3', '#daad48'];

        const arcs = [];
        let rs = 42;
        function rand() { rs = (rs * 9301 + 49297) % 233280; return rs / 233280; }
        for (let i = 0; i < cities.length; i++) {
          for (let j = i + 1; j < cities.length; j++) {
            if (rand() < 0.22) {
              arcs.push({
                startLat: cities[i].lat, startLng: cities[i].lng,
                endLat: cities[j].lat, endLng: cities[j].lng,
                color: colors[Math.floor(rand() * colors.length)]
              });
            }
          }
        }
        const points = cities.map(function(c) { return { lat: c.lat, lng: c.lng }; });

        const globe = new ThreeGlobe({ animateIn: false })
          .showGlobe(true)
          .showAtmosphere(true)
          .atmosphereColor('#9bb0c4')
          .atmosphereAltitude(0.18)
          // Continents drawn as vector polygons — no external texture needed,
          // so the globe can't be blanked by a CDN/image failure and it matches
          // the site's palette.
          .polygonsData(WORLD_COUNTRIES.features)
          .polygonCapColor(function() { return 'rgba(74,122,90,0.9)'; })
          .polygonSideColor(function() { return 'rgba(74,122,90,0.15)'; })
          .polygonStrokeColor(function() { return '#3a5f4a'; })
          .polygonAltitude(0.008)
          .arcColor('color')
          .arcStroke(0.5)
          .arcAltitudeAutoScale(0.4)
          .arcDashLength(0.4)
          .arcDashGap(1.4)
          .arcDashAnimateTime(2600)
          .pointColor(function() { return '#c96a2b'; })
          .pointAltitude(0.012)
          .pointRadius(0.38)
          .arcsData(arcs)
          .pointsData(points);

        // Tint the globe sphere itself a soft ocean blue-grey.
        const globeMat = globe.globeMaterial();
        globeMat.color = new THREE.Color('#dbe3ea');
        globeMat.emissive = new THREE.Color('#c6d2dc');
        globeMat.emissiveIntensity = 0.12;
        if ('shininess' in globeMat) globeMat.shininess = 0.4;

        const w = container.offsetWidth || 260;
        const h = container.offsetHeight || 208;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf0ebdb);
        scene.add(globe);
        scene.add(new THREE.AmbientLight(0xffffff, 0.65));
        const dir = new THREE.DirectionalLight(0xffffff, 0.9);
        dir.position.set(1, 1, 1);
        scene.add(dir);

        const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 2000);
        camera.position.z = 290;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        renderer.setSize(w, h);
        container.appendChild(renderer.domElement);

        const spinSpeed = reducedMotion ? 0 : 0.0035;
        function animate() {
          requestAnimationFrame(animate);
          globe.rotation.y += spinSpeed;
          renderer.render(scene, camera);
        }
        animate();
        container.classList.add('viz-loaded');

        window.addEventListener('resize', function() {
          var nw = container.offsetWidth, nh = container.offsetHeight;
          if (nw > 0 && nh > 0) {
            renderer.setSize(nw, nh);
            camera.aspect = nw / nh;
            camera.updateProjectionMatrix();
          }
        });
      }

      // ═════════ 3. Voxmapp: cycling dashboard (unchanged logic) ═════════
      function initVoxmapp() {
        const dash = document.getElementById('vox-dash');
        if (!dash) return;

        const allCards = Array.from(dash.querySelectorAll('.dash-card'));
        const initialVisible = new Set(['records', 'ontime', 'partners', 'bars', 'spark']);
        allCards.forEach(function(card) {
          if (!initialVisible.has(card.getAttribute('data-card'))) card.classList.add('dash-hidden');
        });

        const accents = ['#c93346', '#7d2da8', '#daad48', '#2e8aa3', '#3f7a8f'];
        const donutColors = ['var(--line-purple)', 'var(--line-blue)', 'var(--line-red)', 'var(--line-yellow)'];

        function isVisible(id) {
          var c = dash.querySelector('[data-card="' + id + '"]');
          return c && !c.classList.contains('dash-hidden');
        }
        function tickRecords() {
          if (!isVisible('records')) return;
          var el = document.getElementById('vox-records');
          var delta = document.getElementById('vox-records-delta');
          var base = parseFloat(el.textContent) || 12.4;
          var v = Math.max(9, Math.min(18, base + (Math.random() - 0.35) * 0.4));
          el.textContent = v.toFixed(1) + 'M';
          if (Math.random() < 0.4) {
            var pcts = ['↑ 12%', '↑ 18%', '↑ 24%', '↑ 15%', '↑ 21%', '↑ 9%'];
            delta.textContent = pcts[Math.floor(Math.random() * pcts.length)];
            delta.style.color = accents[Math.floor(Math.random() * accents.length)];
          }
        }
        function tickPipelines() {
          if (!isVisible('pipelines')) return;
          var el = document.getElementById('vox-pipelines');
          var delta = document.getElementById('vox-pipelines-delta');
          var current = parseInt(el.textContent) || 42;
          var next = Math.max(28, Math.min(58, current + Math.round((Math.random() - 0.4) * 4)));
          el.textContent = String(next);
          if (Math.random() < 0.5) {
            var options = ['↑ 4 today', '↑ 2 today', '↑ 6 today', '→ steady', '↑ 3 today'];
            delta.textContent = options[Math.floor(Math.random() * options.length)];
            delta.style.color = accents[Math.floor(Math.random() * accents.length)];
          }
        }
        function tickOntime() {
          if (!isVisible('ontime')) return;
          var pct = 55 + Math.random() * 40;
          var arc = document.getElementById('vox-ontime-arc');
          var label = document.getElementById('vox-ontime-label');
          arc.setAttribute('stroke-dashoffset', (138.2 * (1 - pct / 100)).toFixed(1));
          arc.setAttribute('stroke', donutColors[Math.floor(Math.random() * donutColors.length)]);
          if (label) label.textContent = Math.round(pct) + '%';
        }
        function tickQuality() {
          if (!isVisible('quality')) return;
          var pct = 72 + Math.random() * 24;
          var arc = document.getElementById('vox-quality-arc');
          var label = document.getElementById('vox-quality-label');
          arc.setAttribute('stroke-dashoffset', (138.2 * (1 - pct / 100)).toFixed(1));
          arc.setAttribute('stroke', donutColors[Math.floor(Math.random() * donutColors.length)]);
          if (label) label.textContent = Math.round(pct) + '%';
        }
        function tickPartners() {
          if (!isVisible('partners')) return;
          var cnt = document.getElementById('vox-partners-count');
          if (cnt) cnt.textContent = 6 + Math.floor(Math.random() * 4);
          var dots = dash.querySelectorAll('.map-dot');
          dots.forEach(function(d) {
            if (Math.random() < 0.3) d.setAttribute('fill', accents[Math.floor(Math.random() * accents.length)]);
          });
        }
        function tickSpark() {
          if (!isVisible('spark')) return;
          var N = 12, W = 100, H = 24, PAD = 3;
          var vals = [];
          for (var i = 0; i < N; i++) vals.push(5 + Math.random() * 15);
          var d = '', fillD = '';
          for (var i2 = 0; i2 < N; i2++) {
            var x = PAD + (W - 2 * PAD) * (i2 / (N - 1));
            var y = H - PAD - vals[i2];
            d += (i2 === 0 ? 'M ' : 'L ') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
            fillD += (i2 === 0 ? 'M ' + x.toFixed(1) + ' ' + y.toFixed(1) : 'L ' + x.toFixed(1) + ' ' + y.toFixed(1)) + ' ';
          }
          var lastX = PAD + (W - 2 * PAD);
          fillD += 'L ' + lastX.toFixed(1) + ' ' + H + ' L ' + PAD + ' ' + H + ' Z';
          var path = document.getElementById('vox-spark-path');
          var fill = document.getElementById('vox-spark-fill');
          var val = document.getElementById('vox-spark-val');
          if (path) path.setAttribute('d', d);
          if (fill) fill.setAttribute('d', fillD);
          if (val) {
            var pct = (Math.random() * 30 - 5);
            val.textContent = (pct >= 0 ? '+ ' : '– ') + Math.abs(pct).toFixed(1) + '%';
            val.style.color = pct >= 0 ? accents[0] : accents[2];
          }
          var color = accents[Math.floor(Math.random() * accents.length)];
          if (path) path.setAttribute('stroke', color);
          if (fill) fill.setAttribute('fill', color);
        }
        var NBARS = 30, CHART_W = 260, CHART_H = 40;
        var barW = CHART_W / NBARS;
        var barsG = document.getElementById('vox-bars');
        if (barsG) {
          for (var b = 0; b < NBARS; b++) {
            var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            var v = 6 + Math.random() * 28;
            rect.setAttribute('x', (b * barW).toFixed(1));
            rect.setAttribute('y', (CHART_H - v).toFixed(1));
            rect.setAttribute('width', (barW - 1.2).toFixed(1));
            rect.setAttribute('height', v.toFixed(1));
            rect.setAttribute('fill', '#3f7a8f');
            rect.setAttribute('opacity', '0.55');
            barsG.appendChild(rect);
          }
        }
        function tickBars() {
          if (!isVisible('bars')) return;
          var bars = barsG.querySelectorAll('rect');
          bars.forEach(function(bar) {
            var v = 5 + Math.random() * 30;
            bar.setAttribute('y', (CHART_H - v).toFixed(1));
            bar.setAttribute('height', v.toFixed(1));
            if (Math.random() < 0.18) { bar.setAttribute('fill', '#871626'); bar.setAttribute('opacity', '0.85'); }
            else { bar.setAttribute('fill', '#3f7a8f'); bar.setAttribute('opacity', '0.55'); }
          });
        }
        function tickNGOs() {
          if (!isVisible('ngos')) return;
          var fills = dash.querySelectorAll('#vox-progress-list .progress-fill');
          fills.forEach(function(el) {
            el.style.width = (30 + Math.random() * 65) + '%';
            el.style.background = donutColors[Math.floor(Math.random() * donutColors.length)];
          });
        }

        if (!reducedMotion) {
          setInterval(tickRecords, 1200);
          setInterval(tickPipelines, 1600);
          setInterval(tickOntime, 3400);
          setInterval(tickQuality, 3600);
          setInterval(tickPartners, 2800);
          setInterval(tickSpark, 2400);
          setInterval(tickBars, 2000);
          setInterval(tickNGOs, 3200);
          function cycleCards() {
            var visible = allCards.filter(function(c) { return !c.classList.contains('dash-hidden'); });
            var hidden = allCards.filter(function(c) { return c.classList.contains('dash-hidden'); });
            var n = visible.length, action;
            if (n <= 4) action = 'add';
            else if (n >= 7) action = 'remove';
            else action = Math.random() < 0.5 ? 'add' : 'remove';
            if (action === 'add' && hidden.length) {
              hidden[Math.floor(Math.random() * hidden.length)].classList.remove('dash-hidden');
            } else if (action === 'remove' && visible.length > 4) {
              visible[Math.floor(Math.random() * visible.length)].classList.add('dash-hidden');
            }
          }
          setInterval(cycleCards, 4500);
        } else {
          tickBars(); tickSpark();
        }
      }

      function boot() {
        initRIU();
        initPTI();
        initVoxmapp();
      }
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
      } else {
        boot();
      }
    })();
  

/* ===== script block 3 of 5 ===== */
  (function () {
    const phrases = [
      "the Brazilian Amazon.",
      "International trade (re)structuring.",
      "ML and forestry inventories.",
      "AI supply chains."
    ];
    
    let currentIndex = 0;
    const cycler = document.getElementById('focus-cycler');
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (cycler && !prefersReducedMotion) {
      
      // 1. Wait exactly 1 second (1000ms) before sliding the first phrase in
      setTimeout(() => {
        cycler.classList.remove('slot-prepare-bottom');
        
        // 2. Start the continuous loop AFTER the first phrase has appeared
        setInterval(() => {
          cycler.classList.add('slot-slide-up');
          
          setTimeout(() => {
            currentIndex = (currentIndex + 1) % phrases.length;
            cycler.textContent = phrases[currentIndex];
            
            cycler.classList.remove('slot-slide-up');
            cycler.classList.add('slot-prepare-bottom');
            
            void cycler.offsetWidth; // Force the browser to register the bottom position
            
            cycler.classList.remove('slot-prepare-bottom');
          }, 400); 
          
        }, 4500); // Continues to change every 3.5 seconds
        
      }, 750); // The 1-second initial delay
      
    } else if (cycler && prefersReducedMotion) {
      // Accessibility fallback: if user prefers no animation, make it instantly visible
      cycler.classList.remove('slot-prepare-bottom');
    }
  })();

/* ===== script block 4 of 5 ===== */
  (function() {
    const trigger = document.getElementById('alive-trigger');
    if (!trigger) return;

    const overlay = document.createElement('div');
    overlay.id = 'data-matrix';
    document.body.appendChild(overlay);

    let isAnimating = false;

    function triggerDataFlood() {
      if (isAnimating) return;
      isAnimating = true;
      
      overlay.innerHTML = '';
      overlay.style.display = 'block';
      overlay.classList.remove('flush');

      const colors = [
        'var(--line-red)', 
        'var(--line-purple)', 
        'var(--line-blue)', 
        'var(--ochre)', 
        'var(--ink)'
      ];

      let ticks = 0;
      const maxTicks = 100; // About 4 seconds to gracefully fill the screen
      
      const spawnTimer = setInterval(() => {
        ticks++;
        
        const progress = ticks / maxTicks; 
        
        let barsThisTick = 0;
        
        // --- THE FIX: Spacing out the bars ---
        // At the start, wait ~10 ticks between spawning bars.
        // As progress nears 1.0, the gap shrinks to just 2 ticks.
        const tickGap = Math.max(2, Math.floor(10 * (1 - progress)));
        
        // Only spawn a bar if we've hit the required gap
        if (ticks % tickGap === 0) {
          barsThisTick = 2;
        }
        
        // Add a tiny final burst right at the end (85% progress) to ensure 100% coverage
        if (progress > 0.85 && ticks % 2 === 0) {
            barsThisTick = 2;
        }

        for (let i = 0; i < barsThisTick; i++) {
          
          const bar = document.createElement('div');
          bar.className = 'data-bar';
          bar.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
          
          const isVertical = Math.random() > 0.5;
          const isReversed = Math.random() > 0.5;
          
          const animDuration = 800 + (Math.random() * 1200);

          if (isVertical) {
            const vWidth = 10 + (Math.random() * 15);
            bar.style.width = vWidth + 'vw';
            bar.style.height = '100vh';
            bar.style.left = (Math.random() * 100) + 'vw';
            bar.style.top = '0';
            bar.style.transformOrigin = isReversed ? 'top' : 'bottom';
            
            overlay.appendChild(bar);
            
            bar.animate([
              { transform: 'scaleY(0)' },
              { transform: 'scaleY(1)' }
            ], {
              duration: animDuration,
              easing: 'cubic-bezier(0.4, 0, 0.2, 1)', 
              fill: 'forwards'
            });

          } else {
            const hHeight = 10 + (Math.random() * 15);
            bar.style.height = hHeight + 'vh';
            bar.style.width = '100vw';
            bar.style.top = (Math.random() * 100) + 'vh';
            bar.style.left = '0';
            bar.style.transformOrigin = isReversed ? 'right' : 'left';
            
            overlay.appendChild(bar);
            
            bar.animate([
              { transform: 'scaleX(0)' },
              { transform: 'scaleX(1)' }
            ], {
              duration: animDuration,
              easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
              fill: 'forwards'
            });
          }
        }

        if (ticks >= maxTicks) {
          clearInterval(spawnTimer);
          flushAndScroll();
        }
      }, 40); 

      function flushAndScroll() {
        // Wait 1 second for the final bars to cross the screen
        setTimeout(() => {
          
          // 1. Instantly snap the page down to the work section (hidden behind the matrix)
          const workSection = document.getElementById('work');
          if (workSection) {
             workSection.scrollIntoView({ behavior: 'instant' });
          }

          // 2. Trigger the CSS fade-out to reveal the new section
          overlay.classList.add('flush');

          // 3. Clean up the DOM after the 1.5-second fade is completely finished
          setTimeout(() => {
            overlay.style.display = 'none';
            overlay.innerHTML = '';
            overlay.classList.remove('flush');
            isAnimating = false;
          }, 1600); 

        }, 1000); 
      }
    }

    trigger.addEventListener('click', triggerDataFlood);
    trigger.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        triggerDataFlood();
      }
    });
  })();

/* ===== script block 5 of 5 ===== */
    (function() {
      const cycler = document.querySelector('.cycler-viz');
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      
      if (!cycler || prefersReducedMotion) return;
      
      const slides = cycler.querySelectorAll('.slide');
      let currentIndex = 0;
      
      setInterval(() => {
        // Fade out current slide
        slides[currentIndex].classList.remove('active');
        
        // Move to the next slide (and loop back to 0 at the end)
        currentIndex = (currentIndex + 1) % slides.length;
        
        // Fade in new slide
        slides[currentIndex].classList.add('active');
      }, 3500); // Changes every 3.5 seconds
    })();
  

