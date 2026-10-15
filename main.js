const { Plugin } = require('obsidian');

module.exports = class TechRadarPlugin extends Plugin {
  async onload() {
    this.registerMarkdownCodeBlockProcessor('tech-radar', (source, el) => {
      const items = this.parseMarkdownTable(source);
      this.renderRadar(el, items);
    });
  }

  parseMarkdownTable(source) {
    const lines = source.trim().split('\n').filter(line => line.includes('|'));
    if (lines.length < 3) return [];

    return lines.slice(2).map(line => {
      const cols = line.split('|').slice(1, -1).map(c => c.trim());
      return {
        nome: cols[0] || '',
        ring: cols[1] || '',
        quadrante: cols[2] || '',
        novo: (cols[3] || '').toLowerCase() === 'sim',
                              descricao: cols[4] || ''
      };
    });
  }

  renderRadar(el, items) {
    el.empty();
    const container = el.createDiv({ cls: 'tech-radar-container' });

    // Escala base do radar
    const size = 800;
    const radius = size / 2;
    const maxR = radius * 0.9;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

    // Estado inicial do ViewBox para controle de zoom no cursor
    let viewBox = { x: -radius, y: -radius, w: size, h: size };
    svg.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
    svg.setAttribute('style', `width: 100%; max-width: ${size}px; display: block; margin: 0 auto;`);

    // Zoom interativo focado na posição do cursor do mouse
    svg.addEventListener('wheel', (e) => {
      e.preventDefault();

      const rect = svg.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      // Posição relativa do mouse dentro do elemento SVG (0 a 1)
      const mouseXRel = (e.clientX - rect.left) / rect.width;
      const mouseYRel = (e.clientY - rect.top) / rect.height;

      // Posição equivalente no sistema de coordenadas do ViewBox atual
      const cursorSvgX = viewBox.x + mouseXRel * viewBox.w;
      const cursorSvgY = viewBox.y + mouseYRel * viewBox.h;

      // Fator de escala do zoom
      const zoomFactor = e.deltaY < 0 ? 0.85 : 1.15;

      let newW = viewBox.w * zoomFactor;
      let newH = viewBox.h * zoomFactor;

      // Limites de zoom (Mínimo: 0.4x do tamanho, Máximo: 2.5x)
      const minW = size / 2.5;
      const maxW = size / 0.4;

      if (newW < minW) { newW = minW; newH = minW; }
      if (newW > maxW) { newW = maxW; newH = maxW; }

      // Recalcula o canto superior esquerdo para manter o ponto do mouse fixo
      const newX = cursorSvgX - mouseXRel * newW;
      const newY = cursorSvgY - mouseYRel * newH;

      viewBox = { x: newX, y: newY, w: newW, h: newH };
      svg.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
    }, { passive: false });

    // Anéis Dinâmicos (Gradiente suave de #e6d1ad até #ffefd4 do externo ao interno)
    const ringStep = maxR / 4;
    const ringRadii = [4, 3, 2, 1].map(i => ringStep * i);
    const ringFills = ['#e6d1ad', '#eee0b9', '#f6e7c6', '#ffefd4'];

    ringRadii.forEach((r, idx) => {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', '0');
      circle.setAttribute('cy', '0');
      circle.setAttribute('r', r.toString());
      circle.setAttribute('fill', ringFills[idx]);
      circle.setAttribute('stroke', '#a38f72');
      circle.setAttribute('stroke-width', '1.5');
      svg.appendChild(circle);
    });

    // Eixos Dinâmicos
    [0, 90, 180, 270].forEach(deg => {
      const rad = (deg * Math.PI) / 180;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', '0');
      line.setAttribute('y1', '0');
      line.setAttribute('x2', (maxR * Math.cos(rad)).toString());
      line.setAttribute('y2', (maxR * Math.sin(rad)).toString());
      line.setAttribute('stroke', '#8c7d6c');
      line.setAttribute('stroke-width', '2');
      svg.appendChild(line);
    });

    // Rótulos dos Anéis
    const ringNames = ['Adote', 'Experimente', 'Avalie', 'Cautela'];
    [1, 2, 3, 4].map(i => ringStep * i).forEach((r, idx) => {
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', '0');
      label.setAttribute('y', (-r + ringStep - 75).toString());
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('fill', '#2a2d41');
      label.setAttribute('font-size', '11');
      label.setAttribute('font-weight', 'bold');
      label.setAttribute('opacity', '0.75');
      label.textContent = ringNames[idx];
      svg.appendChild(label);
    });

    // Rótulos dos Quadrantes
    const labelR = maxR + 50;
    const quadrantLabels = [
      { name: 'Técnicas', angle: -Math.PI / 4 },
      { name: 'Plataformas', angle: (-3 * Math.PI) / 4 },
      { name: 'Ferramentas', angle: (3 * Math.PI) / 4 },
      { name: 'Ling. e Frameworks', angle: Math.PI / 4 }
    ];

    quadrantLabels.forEach(q => {
      const x = labelR * Math.cos(q.angle);
      const y = labelR * Math.sin(q.angle);

      const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t.setAttribute('x', x.toString());
      t.setAttribute('y', y.toString());
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('dominant-baseline', 'central');
      t.setAttribute('fill', 'var(--text-normal)');
      t.setAttribute('font-weight', 'bold');
      t.setAttribute('font-size', '12');
      t.textContent = q.name;
      svg.appendChild(t);
    });

    // Cores dos Blips por Quadrante
    const pastelColors = {
      'Técnicas': '#2b6cb0',
      'Plataformas': '#2f855a',
      'Ferramentas': '#d97706',
      'Linguagens e Frameworks': '#6b46c1'
    };

    // Agrupamento dos itens por (quadrante + ring) para cálculo de distribuição ideal
    const buckets = {};
    items.forEach(item => {
      const key = `${item.quadrante}_${item.ring}`;
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(item);
    });

    const itemMetaMap = new Map();
    Object.values(buckets).forEach(bucketList => {
      bucketList.forEach((item, indexInBucket) => {
        itemMetaMap.set(item, { indexInBucket, totalInBucket: bucketList.length });
      });
    });

    // Renderização dos Blips
    items.forEach(item => {
      const meta = itemMetaMap.get(item) || { indexInBucket: 0, totalInBucket: 1 };
      const coords = this.getCoordinates(item, meta.indexInBucket, meta.totalInBucket, size);
      if (!coords) return;

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('style', 'cursor: pointer;');

      const pastelColor = pastelColors[item.quadrante] || '#2b6cb0';

      let point;
      if (item.novo) {
        point = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        const p1 = `${coords.x},${coords.y - 6}`;
        const p2 = `${coords.x - 5},${coords.y + 4}`;
        const p3 = `${coords.x + 5},${coords.y + 4}`;
        point.setAttribute('points', `${p1} ${p2} ${p3}`);
      } else {
        point = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        point.setAttribute('cx', coords.x.toString());
        point.setAttribute('cy', coords.y.toString());
        point.setAttribute('r', '5');
      }
      point.setAttribute('fill', pastelColor);

      // Truncar nomes com mais de 20 caracteres
      const displayName = item.nome.length > 20 ? item.nome.slice(0, 20) + '...' : item.nome;

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', coords.x.toString());
      text.setAttribute('y', (coords.y + 16).toString());
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('fill', '#2b231d');
      text.setAttribute('font-size', '12');
      text.textContent = displayName;

      // Tooltip com nome completo e descrição
      const titleText = item.descricao ? `${item.nome}\n${item.descricao}` : item.nome;
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = titleText;
      g.appendChild(title);

      // Evento de hover: destaca o ponto e expande o nome completo
      g.addEventListener('mouseenter', () => {
        text.textContent = item.nome;
        text.setAttribute('fill', '#000000');
        text.setAttribute('font-weight', 'bold');
        point.setAttribute('fill', '#000000');
      });

      g.addEventListener('mouseleave', () => {
        text.textContent = displayName;
        text.setAttribute('fill', '#2b231d');
        text.setAttribute('font-weight', 'normal');
        point.setAttribute('fill', pastelColor);
      });

      g.appendChild(point);
      g.appendChild(text);
      svg.appendChild(g);
    });

    container.appendChild(svg);
  }

  getCoordinates(item, itemIndexInBucket, totalInBucket, size = 800) {
    const quadrantAngles = {
      'Técnicas': [-Math.PI / 2, 0],
      'Plataformas': [-Math.PI, -Math.PI / 2],
      'Ferramentas': [Math.PI / 2, Math.PI],
      'Linguagens e Frameworks': [0, Math.PI / 2]
    };

    const maxR = (size / 2) * 0.9;
    const step = maxR / 4;

    const ringRanges = {
      'Adote': [step * 0.2, step * 0.85],
      'Experimente': [step * 1.2, step * 1.85],
      'Avalie': [step * 2.2, step * 2.85],
      'Cautela': [step * 3.2, step * 3.85]
    };

    const angleRange = quadrantAngles[item.quadrante];
    const radiusRange = ringRanges[item.ring];
    if (!angleRange || !radiusRange) return null;

    // Margem de segurança em relação aos eixos (~14 graus)
    const anglePadding = 0.25;
    const startAngle = angleRange[0] + anglePadding;
    const endAngle = angleRange[1] - anglePadding;
    const angleSpan = endAngle - startAngle;

    let angle, radius;
    if (totalInBucket <= 1) {
      angle = (startAngle + endAngle) / 2;
      radius = (radiusRange[0] + radiusRange[1]) / 2;
    } else {
      // Distribui igualmente no setor angular
      const angleStep = angleSpan / totalInBucket;
      angle = startAngle + (itemIndexInBucket + 0.5) * angleStep;

      // Alterna o raio para impedir alinhamento direto entre blips adjacentes
      const radiusFactors = [0.5, 0.25, 0.75, 0.35, 0.65];
      const rFactor = radiusFactors[itemIndexInBucket % radiusFactors.length];
      radius = radiusRange[0] + rFactor * (radiusRange[1] - radiusRange[0]);
    }

    return {
      x: radius * Math.cos(angle),
      y: radius * Math.sin(angle)
    };
  }
};
