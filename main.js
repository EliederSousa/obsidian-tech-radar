const { Plugin, PluginSettingTab, Setting, MarkdownRenderChild, getIcon } = require('obsidian');

// ---------------------------------------------------------------------------
// Padrões (radar Thoughtworks)
// ---------------------------------------------------------------------------
const DEFAULT_RINGS = ['Adote', 'Experimente', 'Avalie', 'Cautela']; // do centro para fora
const DEFAULT_QUADRANTS = ['Técnicas', 'Linguagens e Frameworks', 'Ferramentas', 'Plataformas']; // sentido horário a partir do topo
const MAX_RINGS = 5;
const MAX_QUADRANTS = 8;

const DEFAULT_SETTINGS = {
  // Rings
  ringWeights: [1, 1, 1, 1, 1],        // pesos (área) dos 4 rings padrão (o 5º é reserva)
  ringColors: ['#ffefd4', '#f6e7c6', '#eee0b9', '#e6d1ad', '#dcc59b'], // do centro para fora
  ringBorderColor: '#a38f72',
  ringBorderTransparent: false,
  ringLabelSize: 11,
  ringLabelColor: '#2a2d41',
  // Blips
  blipColors: ['#2f855a', '#2b6cb0', '#d97706', '#c53030', '#6b46c1'], // por ring (do centro para fora)
  blipMaxChars: 15,
  blipTextSize: 8,
  blipTextColor: '#8b834d',
  minDistance: 26,
  // Legendas
  legendSize: 12,
  legendColor: '',                     // vazio = cor do tema
  legendDistance: 410
};

// Os blips têm rótulo embaixo (largo e baixo): a distância horizontal exigida é maior
const LABEL_STRETCH = 2;
const SVG_NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag) => document.createElementNS(SVG_NS, tag);

// ---------------------------------------------------------------------------
// Página de configurações
// ---------------------------------------------------------------------------
class TechRadarSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  get s() { return this.plugin.settings; }

  heading(el, text) {
    new Setting(el).setName(text).setHeading();
  }

  slider(el, name, key, min, max, step, desc, idx) {
    const get = () => (idx === undefined ? this.s[key] : this.s[key][idx]);
    const set = (v) => { if (idx === undefined) this.s[key] = v; else this.s[key][idx] = v; };
    const setting = new Setting(el).setName(name);
    if (desc) setting.setDesc(desc);
    setting.addSlider(sl => sl
    .setLimits(min, max, step)
    .setValue(get())
    .setDynamicTooltip()
    .onChange(async v => { set(v); await this.plugin.saveSettings(); }));
  }

  color(el, name, key, idx, desc) {
    const get = () => (idx === undefined ? this.s[key] : this.s[key][idx]);
    const set = (v) => { if (idx === undefined) this.s[key] = v; else this.s[key][idx] = v; };
    const def = idx === undefined ? DEFAULT_SETTINGS[key] : DEFAULT_SETTINGS[key][idx];
    const setting = new Setting(el).setName(name);
    if (desc) setting.setDesc(desc);
    let picker;
    setting.addColorPicker(c => {
      picker = c;
      c.setValue(get() || '#888888').onChange(async v => { set(v); await this.plugin.saveSettings(); });
    });
    setting.addExtraButton(b => b
    .setIcon('rotate-ccw')
    .setTooltip('Restaurar padrão')
    .onClick(async () => {
      set(def);
      await this.plugin.saveSettings();
      picker.setValue(def || '#888888');
    }));
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    // ---------------- Rings ----------------
    this.heading(containerEl, 'Rings');

    containerEl.createEl('p', {
      cls: 'setting-item-description',
      text: 'Pesos dos rings padrão (área relativa). Só valem quando o bloco não declara "rings:". Se declarar, o peso vem do próprio bloco.'
    });
    DEFAULT_RINGS.forEach((name, i) => {
      this.slider(containerEl, `Peso: ${name}`, 'ringWeights', 0.5, 4, 0.1, null, i);
    });

    for (let i = 0; i < MAX_RINGS; i++) {
      this.color(containerEl, `Cor do ring ${i + 1}${i === 0 ? ' (mais interno)' : ''}`, 'ringColors', i);
    }

    new Setting(containerEl)
    .setName('Borda transparente')
    .setDesc('Remove a borda dos rings.')
    .addToggle(t => t.setValue(this.s.ringBorderTransparent).onChange(async v => {
      this.s.ringBorderTransparent = v;
      await this.plugin.saveSettings();
    }));
    this.color(containerEl, 'Cor da borda dos rings', 'ringBorderColor');
    this.slider(containerEl, 'Tamanho do texto dos rings', 'ringLabelSize', 8, 24, 1);
    this.color(containerEl, 'Cor do texto dos rings', 'ringLabelColor');

    // ---------------- Blips ----------------
    this.heading(containerEl, 'Blips');
    for (let i = 0; i < MAX_RINGS; i++) {
      this.color(containerEl, `Cor do blip no ring ${i + 1}${i === 0 ? ' (mais interno)' : ''}`, 'blipColors', i);
    }
    this.slider(containerEl, 'Tamanho máximo do texto', 'blipMaxChars', 5, 60, 1, 'Acima disso o nome é cortado com "…".');
    this.slider(containerEl, 'Tamanho do texto', 'blipTextSize', 6, 16, 1);
    this.color(containerEl, 'Cor do texto', 'blipTextColor');
    this.slider(containerEl, 'Distância mínima entre blips', 'minDistance', 10, 60, 1,
                'Se não couber, usa a melhor posição possível.');

    // ---------------- Legendas ----------------
    this.heading(containerEl, 'Legendas');
    this.slider(containerEl, 'Tamanho do texto', 'legendSize', 8, 28, 1);
    this.color(containerEl, 'Cor do texto', 'legendColor', undefined, 'O botão de restaurar volta para a cor do tema.');
    this.slider(containerEl, 'Distância a partir do centro', 'legendDistance', 300, 700, 5);

    new Setting(containerEl).addButton(b => b
    .setButtonText('Restaurar tudo')
    .onClick(async () => {
      this.plugin.settings = this.plugin.cloneDefaults();
      await this.plugin.saveSettings();
      this.display();
    }));
  }
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------
module.exports = class TechRadarPlugin extends Plugin {
  async onload() {
    this.radars = new Set();
    this.refreshTimer = null;

    await this.loadSettings();
    this.addSettingTab(new TechRadarSettingTab(this.app, this));

    this.registerMarkdownCodeBlockProcessor('tech-radar', (source, el, ctx) => {
      const entry = { el, source, sourcePath: ctx.sourcePath };
      this.radars.add(entry);

      const child = new MarkdownRenderChild(el);
      child.onunload = () => this.radars.delete(entry);
      ctx.addChild(child);

      this.renderRadar(entry);
    });
  }

  onunload() {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
  }

  cloneDefaults() {
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  }

  async loadSettings() {
    const saved = (await this.loadData()) || {};
    const s = Object.assign(this.cloneDefaults(), saved);
    ['ringWeights', 'ringColors', 'blipColors'].forEach(k => {
      s[k] = DEFAULT_SETTINGS[k].map((d, i) =>
      Array.isArray(saved[k]) && saved[k][i] !== undefined ? saved[k][i] : d);
    });
    this.settings = s;
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.scheduleRefresh();
  }

  // Redesenha todos os radares abertos (com debounce para os sliders)
  scheduleRefresh() {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => {
      this.radars.forEach(entry => {
        if (!entry.el.isConnected) { this.radars.delete(entry); return; }
        this.renderRadar(entry);
      });
    }, 120);
  }

  // -------------------------------------------------------------------------
  // Parsing do bloco
  // -------------------------------------------------------------------------
  splitRow(line) {
    const s = line.trim();
    const cells = [];
    let cur = '';
    let depth = 0;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === '\\' && s[i + 1] === '|') { cur += '|'; i++; continue; }
      if (ch === '[' && s[i + 1] === '[') { depth++; cur += '[['; i++; continue; }
      if (ch === ']' && s[i + 1] === ']' && depth > 0) { depth--; cur += ']]'; i++; continue; }
      if (ch === '|' && depth === 0) { cells.push(cur); cur = ''; continue; }
      cur += ch;
    }
    cells.push(cur);
    if (s.startsWith('|')) cells.shift();
    if (s.endsWith('|') && !s.endsWith('\\|')) cells.pop();
    return cells.map(c => c.trim());
  }

  parseNameList(str, max, withWeight) {
    const out = [];
    const seen = new Set();
    for (const part of str.split(',')) {
      const t = part.trim();
      if (!t) continue;
      let name = t;
      let weight = 1;
      if (withWeight) {
        const eq = t.lastIndexOf('=');
        if (eq > 0) {
          name = t.slice(0, eq).trim();
          const n = parseFloat(t.slice(eq + 1));
          if (isFinite(n) && n > 0) weight = n;
        }
      }
      const key = name.toLowerCase();
      if (!name || seen.has(key)) continue;
      seen.add(key);
      out.push({ name, weight: Math.max(0.1, weight) });
    }
    return out.slice(0, max);
  }

  parseBlock(source) {
    let ringDecl = null;
    let quadDecl = null;
    const tableLines = [];

    for (const raw of source.split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      if (line.includes('|')) { tableLines.push(line); continue; }
      const m = line.match(/^(rings?|an[eé]is|quadrants?|quadrantes?)\s*:\s*(.*)$/i);
      if (!m) continue;
      if (/^(r|an)/i.test(m[1])) ringDecl = m[2]; else quadDecl = m[2];
    }

    // Rings
    let rings = ringDecl ? this.parseNameList(ringDecl, MAX_RINGS, true) : [];
    if (rings.length === 0) {
      rings = DEFAULT_RINGS.map((name, i) => ({ name, weight: Math.max(0.1, Number(this.settings.ringWeights[i]) || 1) }));
    }

    // Quadrantes
    let quadrants = quadDecl ? this.parseNameList(quadDecl, MAX_QUADRANTS, false).map(q => q.name) : [];
    if (quadrants.length === 0) quadrants = [...DEFAULT_QUADRANTS];

    // Tabela
    const aliases = {
      name: ['name', 'nome'],
      category: ['category', 'categoria'],
      ring: ['ring', 'anel'],
      quadrant: ['quadrant', 'quadrante'],
      description: ['description', 'descricao', 'descrição']
    };
    const items = [];
    let headerOk = true;

    if (tableLines.length > 0) {
      const header = this.splitRow(tableLines[0]).map(h => h.toLowerCase());
      const col = {};
      Object.entries(aliases).forEach(([k, names]) => {
        col[k] = header.findIndex(h => names.includes(h));
      });
      headerOk = col.name >= 0 && col.ring >= 0 && col.quadrant >= 0;

      if (headerOk) {
        tableLines.slice(1).forEach(line => {
          const cells = this.splitRow(line);
          if (cells.every(c => /^:?-+:?$/.test(c))) return; // linha separadora
          const get = (k) => (col[k] >= 0 ? (cells[col[k]] || '') : '');
          const name = get('name');
          if (!name) return;
          items.push({
            nome: name,
            category: get('category'),
                     ring: get('ring'),
                     quadrante: get('quadrant'),
                     descricao: get('description')
          });
        });
      }
    }

    return { rings, quadrants, items, headerOk };
  }

  parseLink(desc) {
    const d = (desc || '').trim();
    if (!d) return null;
    let m;
    if ((m = d.match(/^\[\[([^\]]+)\]\]$/))) {
      const parts = m[1].split('|');
      const target = parts[0].trim();
      return { type: 'note', target, label: (parts[1] || target).trim() };
    }
    if ((m = d.match(/^\[([^\]]*)\]\(([^)]+)\)$/))) {
      const url = m[2].trim();
      if (/^https?:\/\//i.test(url)) return { type: 'url', target: url, label: m[1] || url };
        let target = url;
        try { target = decodeURIComponent(url); } catch (e) { /* mantém */ }
        return { type: 'note', target: target.replace(/\.md$/i, ''), label: m[1] || target };
    }
    if (/^https?:\/\/\S+$/i.test(d)) return { type: 'url', target: d, label: d };
    return null;
  }

  firstGrapheme(str) {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      const it = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(str)[Symbol.iterator]().next();
      return it.value ? it.value.segment : '';
    }
    return Array.from(str)[0] || '';
  }

  // -------------------------------------------------------------------------
  // Geometria e layout
  // -------------------------------------------------------------------------
  // Raios interno/externo de cada ring, com áreas proporcionais aos pesos
  getRingBounds(rings, maxR) {
    const total = rings.reduce((a, r) => a + r.weight, 0);
    let cum = 0;
    let prev = 0;
    return rings.map(r => {
      cum += r.weight;
      const outer = maxR * Math.sqrt(cum / total);
      const b = { inner: prev, outer };
      prev = outer;
      return b;
    });
  }

  hashString(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // PRNG com seed: posições "aleatórias", porém estáveis a cada renderização
  mulberry32(a) {
    return () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Candidatos aleatórios (uniformes por área) dentro do setor; aceita o primeiro que
  // respeite a distância mínima, senão fica com o mais afastado dos já posicionados.
  layoutBlips(items, rings, quadrants, maxR) {
    const bounds = this.getRingBounds(rings, maxR);
    const minDist = this.settings.minDistance;
    const MAX_TRIES = 300;
    const n = quadrants.length;
    const span = (2 * Math.PI) / n;

    const buckets = {};
    items.forEach(item => {
      const key = `${item.qIdx}_${item.rIdx}`;
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(item);
    });

    const coordsMap = new Map();

    Object.values(buckets).forEach(list => {
      const { qIdx, rIdx } = list[0];
      const rand = this.mulberry32(this.hashString(`${quadrants[qIdx]}_${rings[rIdx].name}`));
      const placed = [];

      const aStart = -Math.PI / 2 + qIdx * span;
      const aEnd = aStart + span;
      const { inner, outer } = bounds[rIdx];
      const pad = Math.min(12, (outer - inner) / 4);
      const r0 = inner + pad;
      const r1 = outer - pad;

      list.forEach(item => {
        let best = null;
        let bestScore = -1;

        for (let t = 0; t < MAX_TRIES; t++) {
          const r = Math.sqrt(r0 * r0 + rand() * (r1 * r1 - r0 * r0));
          const angPad = Math.min(Math.asin(Math.min(1, 14 / r)), span * 0.35); // folga dos eixos
          const a0 = aStart + angPad;
          const a1 = aEnd - angPad;
          if (a1 <= a0) continue;

          const a = a0 + rand() * (a1 - a0);
          const x = r * Math.cos(a);
          const y = r * Math.sin(a);

          let score = Infinity;
          for (const p of placed) {
            const d = Math.hypot((x - p.x) / LABEL_STRETCH, y - p.y);
            if (d < score) score = d;
          }

          if (score > bestScore) { bestScore = score; best = { x, y }; }
          if (score >= minDist) break;
        }

        if (!best) {
          const rm = (r0 + r1) / 2;
          const am = (aStart + aEnd) / 2;
          best = { x: rm * Math.cos(am), y: rm * Math.sin(am) };
        }

        placed.push(best);
        coordsMap.set(item, best);
      });
    });

    return coordsMap;
  }

  // -------------------------------------------------------------------------
  // Renderização
  // -------------------------------------------------------------------------
  renderRadar(entry) {
    const { el, source, sourcePath } = entry;
    const s = this.settings;
    const { rings, quadrants, items: rawItems, headerOk } = this.parseBlock(source);

    el.empty();

    if (!headerOk) {
      el.createEl('p', { text: 'tech-radar: a tabela precisa das colunas name, ring e quadrant.' });
    }

    // Resolve ring/quadrante (sem diferenciar maiúsculas); ignora blips inválidos
    const ringIdx = new Map(rings.map((r, i) => [r.name.toLowerCase(), i]));
    const quadIdx = new Map(quadrants.map((q, i) => [q.toLowerCase(), i]));
    const items = [];
    rawItems.forEach(it => {
      const rIdx = ringIdx.get(it.ring.trim().toLowerCase());
      const qIdx = quadIdx.get(it.quadrante.trim().toLowerCase());
      if (rIdx === undefined || qIdx === undefined) return;
      items.push(Object.assign({}, it, { rIdx, qIdx }));
    });

    const container = el.createDiv({ cls: 'tech-radar-container' });
    container.setAttribute('style', 'position: relative;');

    // Escala base
    const maxR = 360;
    const nQ = quadrants.length;
    const span = (2 * Math.PI) / nQ;

    // Posição das legendas (e quanto espaço elas exigem na viewBox)
    const legends = quadrants.map((name, i) => {
      const mid = -Math.PI / 2 + i * span + span / 2;
      const cosA = Math.cos(mid);
      const w = name.length * s.legendSize * 0.6;
      const anchor = cosA > 0.25 ? 'start' : cosA < -0.25 ? 'end' : 'middle';
      return {
        name, anchor,
        x: s.legendDistance * cosA,
        y: s.legendDistance * Math.sin(mid),
                                  w
      };
    });
    let half = 400;
    legends.forEach(l => {
      const ex = Math.abs(l.x) + (l.anchor === 'middle' ? l.w / 2 : l.w);
      const ey = Math.abs(l.y) + s.legendSize;
      half = Math.max(half, ex + 12, ey + 12);
    });
    const size = half * 2;

    const svg = svgEl('svg');
    let viewBox = { x: -half, y: -half, w: size, h: size };
    const applyViewBox = () => svg.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
    applyViewBox();
    svg.setAttribute('style', `width: 100%; max-width: ${size}px; display: block; margin: 0 auto;`);

    // Zoom focado no cursor
    svg.addEventListener('wheel', (e) => {
      e.preventDefault();

      const rect = svg.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const mouseXRel = (e.clientX - rect.left) / rect.width;
      const mouseYRel = (e.clientY - rect.top) / rect.height;

      const cursorSvgX = viewBox.x + mouseXRel * viewBox.w;
      const cursorSvgY = viewBox.y + mouseYRel * viewBox.h;

      const zoomFactor = e.deltaY < 0 ? 0.85 : 1.15;
      let newW = viewBox.w * zoomFactor;
      const minW = size / 2.5;
      const maxW = size / 0.4;
      if (newW < minW) newW = minW;
      if (newW > maxW) newW = maxW;

      viewBox = {
        x: cursorSvgX - mouseXRel * newW,
        y: cursorSvgY - mouseYRel * newW,
        w: newW,
        h: newW
      };
      applyViewBox();
    }, { passive: false });

    // Botão de reset do zoom
    const resetBtn = container.createEl('button', { text: '🔄 Resetar Zoom' });
    resetBtn.setAttribute('style', `
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 10;
    cursor: pointer;
    padding: 6px 12px;
    border-radius: 6px;
    border: 1px solid var(--border-color, #a38f72);
    background: var(--background-primary, #ffffff);
    color: var(--text-normal, #2b231d);
    font-size: 12px;
    font-weight: bold;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    `);
    resetBtn.addEventListener('click', () => {
      viewBox = { x: -half, y: -half, w: size, h: size };
      applyViewBox();
    });

    // Rings (do externo para o interno)
    const ringBounds = this.getRingBounds(rings, maxR);
    for (let i = ringBounds.length - 1; i >= 0; i--) {
      const circle = svgEl('circle');
      circle.setAttribute('cx', '0');
      circle.setAttribute('cy', '0');
      circle.setAttribute('r', ringBounds[i].outer.toString());
      circle.setAttribute('fill', s.ringColors[i]);
      circle.setAttribute('stroke', s.ringBorderTransparent ? 'none' : s.ringBorderColor);
      circle.setAttribute('stroke-width', '1.5');
      svg.appendChild(circle);
    }

    // Eixos (limites dos setores)
    for (let i = 0; i < nQ; i++) {
      const a = -Math.PI / 2 + i * span;
      const line = svgEl('line');
      line.setAttribute('x1', '0');
      line.setAttribute('y1', '0');
      line.setAttribute('x2', (maxR * Math.cos(a)).toString());
      line.setAttribute('y2', (maxR * Math.sin(a)).toString());
      line.setAttribute('stroke', '#8c7d6c');
      line.setAttribute('stroke-width', '2');
      svg.appendChild(line);
    }

    // Nomes dos rings (centralizados na faixa de cada um, sobre o eixo superior)
    ringBounds.forEach((b, idx) => {
      const name = rings[idx].name;
      const fs = s.ringLabelSize;
      const mid = (b.inner + b.outer) / 2;
      const boxW = name.length * fs * 0.6 + 10;
      const boxH = fs * 1.6;

      const rect = svgEl('rect');
      rect.setAttribute('x', (-boxW / 2).toString());
      rect.setAttribute('y', (-mid - boxH / 2).toString());
      rect.setAttribute('width', boxW.toString());
      rect.setAttribute('height', boxH.toString());
      rect.setAttribute('rx', '4');
      rect.setAttribute('fill', s.ringColors[idx]);

      const label = svgEl('text');
      label.setAttribute('x', '0');
      label.setAttribute('y', (-mid).toString());
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('dominant-baseline', 'central');
      label.setAttribute('fill', s.ringLabelColor);
      label.setAttribute('font-size', fs.toString());
      label.setAttribute('font-weight', 'bold');
      label.textContent = name;

      svg.appendChild(rect);
      svg.appendChild(label);
    });

    // Legendas dos setores
    legends.forEach(l => {
      const t = svgEl('text');
      t.setAttribute('x', l.x.toString());
      t.setAttribute('y', l.y.toString());
      t.setAttribute('text-anchor', l.anchor);
      t.setAttribute('dominant-baseline', 'central');
      t.setAttribute('fill', s.legendColor || 'var(--text-normal)');
      t.setAttribute('font-weight', 'bold');
      t.setAttribute('font-size', s.legendSize.toString());
      t.textContent = l.name;
      svg.appendChild(t);
    });

    // Blips
    const coordsMap = this.layoutBlips(items, rings, quadrants, maxR);

    items.forEach(item => {
      const coords = coordsMap.get(item);
      if (!coords) return;

      const color = s.blipColors[item.rIdx];
      const link = this.parseLink(item.descricao);

      const g = svgEl('g');
      g.setAttribute('style', `cursor: ${link ? 'pointer' : 'default'};`);

      // Tooltip
      let tip = item.nome;
      if (link) tip += `\n${link.label}`;
      else if (item.descricao) tip += `\n${item.descricao}`;
      const title = svgEl('title');
      title.textContent = tip;
      g.appendChild(title);

      // Área de clique/hover maior que o shape
      const hit = svgEl('circle');
      hit.setAttribute('cx', coords.x.toString());
      hit.setAttribute('cy', coords.y.toString());
      hit.setAttribute('r', '9');
      hit.setAttribute('fill', 'transparent');
      g.appendChild(hit);

      // Shape: ícone (icon:nome), emoji/caractere, ou círculo
      const cat = (item.category || '').trim();
      const isIconSpec = /^icon:/i.test(cat);
      let applyColor = null;

      if (isIconSpec && typeof getIcon === 'function') {
        const icon = getIcon(cat.slice(5).trim());
        if (icon) {
          icon.setAttribute('x', (coords.x - 7).toString());
          icon.setAttribute('y', (coords.y - 7).toString());
          icon.setAttribute('width', '14');
          icon.setAttribute('height', '14');
          icon.style.width = '14px';
          icon.style.height = '14px';
          icon.style.strokeWidth = '2';
          applyColor = (c) => { icon.style.stroke = c; };
          g.appendChild(icon);
        }
      }

      if (!applyColor && cat && !isIconSpec) {
        const glyph = svgEl('text');
        glyph.setAttribute('x', coords.x.toString());
        glyph.setAttribute('y', coords.y.toString());
        glyph.setAttribute('text-anchor', 'middle');
        glyph.setAttribute('dominant-baseline', 'central');
        glyph.setAttribute('font-size', '14');
        glyph.setAttribute('font-weight', 'bold');
        glyph.textContent = this.firstGrapheme(cat);
        applyColor = (c) => glyph.setAttribute('fill', c);
        g.appendChild(glyph);
      }

      if (!applyColor) {
        const circle = svgEl('circle');
        circle.setAttribute('cx', coords.x.toString());
        circle.setAttribute('cy', coords.y.toString());
        circle.setAttribute('r', '5');
        applyColor = (c) => circle.setAttribute('fill', c);
        g.appendChild(circle);
      }
      applyColor(color);

      // Nome abaixo do blip
      const max = Math.max(1, s.blipMaxChars);
      const displayName = item.nome.length > max ? item.nome.slice(0, max) + '…' : item.nome;

      const text = svgEl('text');
      text.setAttribute('x', coords.x.toString());
      text.setAttribute('y', (coords.y + 17).toString());
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('fill', s.blipTextColor);
      text.setAttribute('font-size', s.blipTextSize.toString());
      text.textContent = displayName;
      g.appendChild(text);

      g.addEventListener('mouseenter', () => {
        text.textContent = item.nome;
        text.setAttribute('fill', '#000000');
        text.setAttribute('font-weight', 'bold');
        applyColor('#000000');
      });

      g.addEventListener('mouseleave', () => {
        text.textContent = displayName;
        text.setAttribute('fill', s.blipTextColor);
        text.setAttribute('font-weight', 'normal');
        applyColor(color);
      });

      if (link) {
        g.addEventListener('click', (e) => {
          if (link.type === 'url') {
            window.open(link.target, '_blank');
          } else {
            this.app.workspace.openLinkText(link.target, sourcePath, e.ctrlKey || e.metaKey);
          }
        });
      }

      svg.appendChild(g);
    });

    container.appendChild(svg);
  }
};
