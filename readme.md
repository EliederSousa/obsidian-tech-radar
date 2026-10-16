# Tech Radar

Plugin do Obsidian que desenha um radar de tecnologias (estilo Thoughtworks) a partir de uma tabela Markdown dentro de um bloco de código.

- Rings (1 a 5) e quadrantes (1 a 8) configuráveis por bloco
- Blips posicionados automaticamente, sem sobreposição
- Shape do blip: círculo, emoji, caractere ou ícone do Obsidian
- Blips clicáveis (link para nota ou site)
- Zoom com o scroll do mouse
- Aparência ajustável na página de configurações, com atualização ao vivo

## Instalação

1. Crie a pasta `.obsidian/plugins/tech-radar/` dentro do seu vault.
2. Copie `main.js` e `manifest.json` para ela.
3. Em **Configurações → Plugins da comunidade**, ative o **Tech Radar**.

## Uso rápido

Sem declarar nada, o radar usa o padrão Thoughtworks:

- **Rings** (do centro para fora): Adote, Experimente, Avalie, Cautela
- **Quadrantes** (sentido horário, a partir do topo): Técnicas, Linguagens e Frameworks, Ferramentas, Plataformas

````markdown
```tech-radar
| name   | category | ring        | quadrant    | description           |
|--------|----------|-------------|-------------|-----------------------|
| Docker | 🐳       | Adote       | Plataformas | [[Nota Docker]]       |
| Rust   |          | Experimente | Técnicas    | https://rust-lang.org |
| Vim    | V        | Avalie      | Ferramentas | Editor modal          |
```
````

## Rings e quadrantes personalizados

Declare-os antes da tabela. Cada declaração é independente: você pode personalizar só os rings, só os quadrantes, ou ambos.

````markdown
```tech-radar
rings: Adote=1, Experimente=1.5, Avalie=1, Cautela=2
quadrants: Frontend, Backend, Dados, Infra

| name  | ring    | quadrant |
|-------|---------|----------|
| React | Adote   | Frontend |
| Kafka | Avalie  | Dados    |
```
````

| Declaração | Quantidade | Detalhes |
|---|---|---|
| `rings:` | 1 a 5 | Separados por vírgula, do centro para fora. `=peso` é opcional (padrão `1`) e define a **área** relativa do ring |
| `quadrants:` | 1 a 8 | Separados por vírgula, em sentido horário a partir do topo |

Nomes repetidos são ignorados e o que passar do limite é descartado.

> Os pesos dos rings padrão (quando você não declara `rings:`) ficam nas configurações do plugin.

## A tabela

As colunas são identificadas pelo cabeçalho, em qualquer ordem. Nomes em português também são aceitos (`nome`, `categoria`, `anel`, `quadrante`, `descricao`).

| Coluna | Obrigatória | Descrição |
|---|---|---|
| `name` | Sim | Nome do blip |
| `ring` | Sim | Um dos rings (padrão ou declarados) |
| `quadrant` | Sim | Um dos quadrantes (padrão ou declarados) |
| `category` | Não | Define o shape do blip (veja abaixo) |
| `description` | Não | Texto (tooltip) ou link (blip clicável) |

Regras:

- `ring` e `quadrant` não diferenciam maiúsculas de minúsculas.
- Blips com ring ou quadrant inexistente são **ignorados**.
- Se faltar `name`, `ring` ou `quadrant` no cabeçalho, o plugin mostra um aviso no lugar dos blips.

### Shape do blip (`category`)

| Valor | Resultado |
|---|---|
| vazio | Círculo |
| emoji ou caractere (`🐳`, `V`) | Usa o caractere. Se houver mais de um, só o primeiro é usado |
| `icon:nome` (ex.: `icon:server`) | Ícone do Obsidian (Lucide). Se o nome não existir, vira círculo |

### Descrição (`description`)

| Valor | Resultado |
|---|---|
| `[[Nota]]`, `[[Nota\|alias]]`, `[[Nota#Seção]]` | Clique abre a nota. Ctrl/Cmd + clique abre em nova aba |
| `https://exemplo.com` | Clique abre no navegador |
| `[texto](https://exemplo.com)` | Clique abre o link |
| `[texto](Nota.md)` | Clique abre a nota |
| qualquer outro texto | Aparece no tooltip ao passar o mouse |

Dentro de uma tabela, o `|` do alias de um wikilink pode ser escrito normalmente (`[[Nota|alias]]`) ou escapado (`[[Nota\|alias]]`).

## Interação

- **Scroll do mouse:** zoom focado no cursor
- **Botão "Resetar Zoom":** volta ao enquadramento inicial
- **Passar o mouse sobre um blip:** mostra o nome completo e a descrição

## Configurações

Todas as opções cosméticas ficam em **Configurações → Tech Radar**. Qualquer mudança redesenha os radares abertos na hora (o zoom volta ao início). Cada cor tem um botão para restaurar o padrão, e há um "Restaurar tudo" no final.

**Rings**
- Pesos (área) dos rings padrão
- Cor de cada ring (1 = mais interno)
- Borda: cor, ou transparente
- Tamanho e cor do texto dos nomes dos rings

**Blips**
- Cor do blip em cada ring
- Tamanho máximo do texto antes de cortar com `…`
- Tamanho e cor do texto
- Distância mínima entre blips

**Legendas**
- Tamanho e cor do texto (por padrão usa a cor do tema)
- Distância a partir do centro

> As cores de ring e de blip seguem a **posição** do ring (1 a 5), não o nome. Isso vale também para rings declarados por você.

## Como os blips são posicionados

Dentro do setor de cada quadrante e ring, o plugin sorteia posições candidatas e escolhe a primeira que respeita a distância mínima configurada. O sorteio usa uma seed fixa, então o layout é **estável**: o mesmo radar sempre é desenhado do mesmo jeito.

A área de cada ring é proporcional ao seu peso, e não a largura. Com pesos iguais, todos os rings têm a mesma área.

Se um setor tiver blips demais para o espaço, a distância mínima não é garantida e o plugin usa a melhor posição possível. Nesse caso, aumente o peso do ring, reduza a distância mínima ou use menos quadrantes.

## Limitações

- O limite é de 5 rings e 8 quadrantes por radar.
- Wikilinks com `|` só são tratados corretamente dentro de `[[ ]]` ou com `\|`.
- Os eixos que separam os quadrantes têm cor fixa.
