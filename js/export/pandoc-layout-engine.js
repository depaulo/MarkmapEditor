/**
 * Pandoc Layout Transformation Engine
 *
 * Handles conversion of Markdown with layout directives into Pandoc-compatible Markdown
 * for PowerPoint slide generation.
 *
 * Supported layouts:
 * - title: Title slide with metadata
 * - agenda: Agenda slide
 * - content: Plain content slide
 * - twocols: Two-column layout
 * - image-text: Image + text layout
 * - text-image: Text + image layout
 * - image-caption: Image with caption
 * - bullets-2: Bullets in two columns
 * - threecols: Three-column layout (table fallback)
 * - grid2: 2x2 grid layout (table fallback)
 * - section: Section divider
 * - highlight: Highlighted content
 * - big: Large number/metric
 * - kpi: KPI slide
 * - table: Table content
 */

/**
 * Main entry point: Transform Markdown with layout directives into Pandoc Markdown
 * @param {string} mdText - Markdown text with layout directives
 * @returns {string} Pandoc-compatible Markdown
 */
function transformLayouts(mdText) {
  const blocks = splitSlidesForPandoc(mdText);
  const output = [];

  let titleMeta = null;

  for (const rawBlock of blocks) {
    if (rawBlock === undefined) continue;
    const block = String(rawBlock).trim();

    if (!block) continue;

    const lines = block.split('\n');

    let layout = 'content';
    let startIndex = 0;

    if (lines[0] && lines[0].trim().toLowerCase().startsWith('layout:')) {
      layout = lines[0]
        .replace(/^layout:/i, '')
        .trim()
        .toLowerCase();
      startIndex = 1;
    }

    const content = lines.slice(startIndex).join('\n').trim();

    switch (layout) {
      case 'title':
        if (!titleMeta) {
          titleMeta = transformTitleMetadata(content);
        } else {
          output.push(transformSection(content));
        }
        break;

      case 'twocols':
        output.push(transformTwoCols(content));
        break;

      case 'image-text':
        output.push(transformImageText(content, true));
        break;

      case 'text-image':
        output.push(transformImageText(content, false));
        break;

      case 'image-caption':
        output.push(transformImageCaption(content));
        break;

      case 'agenda':
        output.push(cleanPandocContent(content));
        break;

      case 'kpi':
        output.push(transformKpi(content));
        break;

      case 'bullets-2':
        output.push(transformBulletsTwoCols(content));
        break;

      case 'threecols':
        output.push(transformThreeCols(content));
        break;

      case 'grid2':
        output.push(transformGrid2(content));
        break;

      case 'section':
        output.push(transformSection(content));
        break;

      case 'highlight':
        output.push(transformHighlight(content));
        break;

      case 'big':
        output.push(transformBigNumber(content));
        break;

      case 'table':
      case 'content':
      default:
        output.push(cleanPandocContent(content));
        break;
    }
  }

  const body = output
    .map((s) => s.trim())
    .filter(Boolean)
    .join('\n\n---\n\n');

  if (titleMeta) {
    return titleMeta + '\n\n' + body;
  }

  return body;
}

/**
 * Split Markdown by --- into separate slides
 * @param {string} mdText - Raw Markdown text
 * @returns {Array<string>} Array of slide blocks
 */
function splitSlidesForPandoc(mdText) {
  return String(mdText || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split(/\n---\n/g);
}

/**
 * Clean Pandoc content: trim lines and remove extra whitespace
 * @param {string} content - Raw content
 * @returns {string} Cleaned content
 */
function cleanPandocContent(content) {
  return String(content || '')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}

/**
 * Transform title slide metadata
 * @param {string} content - Title slide content
 * @returns {string} YAML frontmatter for Pandoc
 */
function transformTitleMetadata(content) {
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  let title = '';
  let subtitle = '';
  let author = '';
  let date = '';

  const line0 = lines[0] ?? '';
  const line1 = lines[1] ?? '';
  const line2 = lines[2] ?? '';
  const line3 = lines[3] ?? '';

  if (lines.length > 0 && line0.startsWith('# ')) {
    title = line0.replace(/^#\s+/, '').trim();
    subtitle = line1;
    author = line2;
    date = line3;
  } else {
    title = line0;
    subtitle = line1;
    author = line2;
    date = line3;
  }

  const meta = ['---', `title: "${escapeYamlString(title)}"`];

  if (subtitle) {
    meta.push(`subtitle: "${escapeYamlString(subtitle)}"`);
  }

  if (author) {
    meta.push(`author: "${escapeYamlString(author)}"`);
  }

  if (date) {
    meta.push(`date: "${escapeYamlString(date)}"`);
  }

  meta.push('---');

  return meta.join('\n');
}

/**
 * Escape YAML string values
 * @param {string} value - String to escape
 * @returns {string} Escaped string
 */
function escapeYamlString(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .trim();
}

/**
 * Transform two-column layout
 * @param {string} content - Slide content
 * @returns {string} Pandoc column syntax
 */
function transformTwoCols(content) {
  const lines = content.split('\n');

  let title = '';
  const left = [];
  const right = [];
  let current = 'left';

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) continue;

    if (line.startsWith('# ')) {
      title = line;
      continue;
    }

    if (line.startsWith('## ')) {
      const section = line.toLowerCase();

      if (
        section.includes('column 2') ||
        section.includes('col 2') ||
        section.includes('[2]') ||
        section.includes('right') ||
        section.includes('option b')
      ) {
        current = 'right';
      } else {
        current = 'left';
      }

      continue;
    }

    if (current === 'left') {
      left.push(line.replace(/^- /, '').trim());
    } else {
      right.push(line.replace(/^- /, '').trim());
    }
  }

  return [
    title,
    '',
    '::: columns',
    '::: column',
    left.join('\n'),
    ':::',
    '',
    '::: column',
    right.join('\n'),
    ':::',
    ':::',
  ]
    .join('\n')
    .trim();
}

/**
 * Transform image + text layout
 * @param {string} content - Slide content
 * @param {boolean} imageFirst - If true, image on left; otherwise text on left
 * @returns {string} Pandoc column syntax
 */
function transformImageText(content, imageFirst = true) {
  const lines = content.split('\n');

  let title = '';
  const imageLines = [];
  const textLines = [];
  let current = 'text';

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) continue;

    if (line.startsWith('# ')) {
      title = line;
      continue;
    }

    if (line.startsWith('## ')) {
      const section = line.toLowerCase();

      if (
        section.includes('image') ||
        section.includes('visual') ||
        section.includes('figure') ||
        section.includes('chart')
      ) {
        current = 'image';
      } else {
        current = 'text';
      }

      continue;
    }

    if (current === 'image' || isImageLine(line)) {
      imageLines.push(formatPandocImage(line));
    } else {
      textLines.push(line);
    }
  }

  const imageBlock = imageLines.filter(Boolean).join('\n');
  const textBlock = textLines.join('\n');

  const firstBlock = imageFirst ? imageBlock : textBlock;
  const secondBlock = imageFirst ? textBlock : imageBlock;

  return [
    title,
    '',
    '::: columns',
    '::: column',
    firstBlock,
    ':::',
    '',
    '::: column',
    secondBlock,
    ':::',
    ':::',
  ]
    .join('\n')
    .trim();
}

/**
 * Transform image + caption layout
 * @param {string} content - Slide content
 * @returns {string} Image with caption
 */
function transformImageCaption(content) {
  const lines = content.split('\n');

  let title = '';
  const captionLines = [];
  let imageLine = '';

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) continue;

    if (line.startsWith('# ')) {
      title = line;
      continue;
    }

    if (isImageLine(line)) {
      imageLine = formatPandocImage(line);
      continue;
    }

    if (!line.startsWith('## ')) {
      captionLines.push(line);
    }
  }

  return [title, '', imageLine, '', captionLines.join('\n')].join('\n').trim();
}

/**
 * Transform KPI (key performance indicator) slide
 * @param {string} content - Slide content
 * @returns {string} Formatted KPI slide
 */
function transformKpi(content) {
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  let title = '';
  let metric = '';
  const body = [];

  for (const line of lines) {
    if (line.startsWith('# ')) {
      title = line;
      continue;
    }

    if (line.startsWith('## ') && !metric) {
      metric = line.replace(/^##\s+/, '').trim();
      continue;
    }

    if (!line.startsWith('## ')) {
      body.push(line);
    }
  }

  return [title, '', metric ? `# ${metric}` : '', '', body.join('\n')].join('\n').trim();
}

/**
 * Transform bullets in two columns
 * @param {string} content - Slide content
 * @returns {string} Pandoc column syntax
 */
function transformBulletsTwoCols(content) {
  const lines = content.split('\n');

  let title = '';
  const bullets = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) continue;

    if (line.startsWith('# ')) {
      title = line;
      continue;
    }

    if (line.startsWith('- ')) {
      bullets.push(line);
    }
  }

  const mid = Math.ceil(bullets.length / 2);
  const left = bullets.slice(0, mid);
  const right = bullets.slice(mid);

  return [
    title,
    '',
    '::: columns',
    '::: column',
    left.join('\n'),
    ':::',
    '',
    '::: column',
    right.join('\n'),
    ':::',
    ':::',
  ]
    .join('\n')
    .trim();
}

/**
 * Transform three-column layout (uses table fallback for PowerPoint compatibility)
 * @param {string} content - Slide content
 * @returns {string} Pandoc table syntax
 */
function transformThreeCols(content) {
  const lines = content.split('\n');

  let title = '';
  /** @type {Array<{ heading: string; body: string[] }>} */
  const cols = [
    { heading: '', body: [] },
    { heading: '', body: [] },
    { heading: '', body: [] },
  ];

  let current = 0;

  const getCol = () => {
    return cols[current] ?? cols[0] ?? { heading: '', body: [] };
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) continue;

    if (line.startsWith('# ')) {
      title = line;
      continue;
    }

    if (line.startsWith('## ')) {
      const sectionTitle = line.replace(/^##\s+/, '').trim();
      const section = sectionTitle.toLowerCase();

      if (
        section.includes('column 3') ||
        section.includes('col 3') ||
        section.includes('[3]') ||
        section.includes('right') ||
        section.includes('option c')
      ) {
        current = 2;
      } else if (
        section.includes('column 2') ||
        section.includes('col 2') ||
        section.includes('[2]') ||
        section.includes('middle') ||
        section.includes('center') ||
        section.includes('option b')
      ) {
        current = 1;
      } else {
        current = 0;
      }

      getCol().heading = sectionTitle;
      continue;
    }

    getCol().body.push(line.replace(/^- /, '').trim());
  }

  const cellHeading = (col) => {
    return col.heading ? `**${escapePandocTableCell(col.heading)}**` : ' ';
  };

  const cellBody = (col) => {
    const body = col.body.map(escapePandocTableCell).join(' — ');

    return body || ' ';
  };

  return [
    title,
    '',
    `| ${cellHeading(cols[0] ?? { heading: '', body: [] })} | ${cellHeading(cols[1] ?? { heading: '', body: [] })} | ${cellHeading(cols[2] ?? { heading: '', body: [] })} |`,
    '|---|---|---|',
    `| ${cellBody(cols[0] ?? { heading: '', body: [] })} | ${cellBody(cols[1] ?? { heading: '', body: [] })} | ${cellBody(cols[2] ?? { heading: '', body: [] })} |`,
  ]
    .join('\n')
    .trim();
}

/**
 * Transform 2x2 grid layout (uses table fallback)
 * @param {string} content - Slide content
 * @returns {string} Pandoc table syntax
 */
function transformGrid2(content) {
  const lines = content.split('\n');

  let title = '';
  const blocks = [];
  /** @type {{ heading: string; body: string[] } | null} */
  let currentBlock = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) continue;

    if (line.startsWith('# ')) {
      title = line;
      continue;
    }

    if (line.startsWith('## ')) {
      currentBlock = {
        heading: line.replace(/^##\s+/, '').trim(),
        body: [],
      };
      blocks.push(currentBlock);
      continue;
    }

    if (currentBlock) {
      currentBlock.body.push(line);
    }
  }

  while (blocks.length < 4) {
    blocks.push({ heading: '', body: [] });
  }

  const cell = (block) => {
    const safeBlock = block ?? { heading: '', body: [] };

    const heading = escapePandocTableCell(safeBlock.heading);
    const body = safeBlock.body.map(escapePandocTableCell).join(' ');

    if (heading && body) return `**${heading}** — ${body}`;
    if (heading) return `**${heading}**`;
    if (body) return body;

    return ' ';
  };

  return [
    title,
    '',
    `| ${cell(blocks[0])} | ${cell(blocks[1])} |`,
    '|---|---|',
    `| ${cell(blocks[2])} | ${cell(blocks[3])} |`,
  ]
    .join('\n')
    .trim();
}

/**
 * Transform section divider slide
 * @param {string} content - Slide content
 * @returns {string} Cleaned content
 */
function transformSection(content) {
  return cleanPandocContent(content);
}

/**
 * Transform highlight slide
 * @param {string} content - Slide content
 * @returns {string} Cleaned content
 */
function transformHighlight(content) {
  return cleanPandocContent(content);
}

/**
 * Transform big number slide
 * @param {string} content - Slide content
 * @returns {string} Cleaned content
 */
function transformBigNumber(content) {
  return cleanPandocContent(content);
}

/**
 * Escape pipe characters in table cells
 * @param {string} text - Cell text
 * @returns {string} Escaped text
 */
function escapePandocTableCell(text) {
  return String(text || '')
    .replace(/\|/g, '\\|')
    .trim();
}

/**
 * Check if a line is an image reference
 * @param {string} value - Line content
 * @returns {boolean} True if line contains image
 */
function isImageLine(value) {
  return /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(value);
}

/**
 * Format a line as a Pandoc image reference
 * @param {string} line - Line content
 * @returns {string} Formatted Pandoc image syntax
 */
function formatPandocImage(line) {
  // Intentionally left as function declaration for CJS compatibility.

  const value = String(line || '').trim();

  if (!value) return '';
  if (/^!\[.*\]\(.+\)$/.test(value)) return value;

  const alt =
    (value
      .split('/')
      .pop() ?? '')
      .replace(/\.[^.]+$/, '')
      .replace(/[-_]+/g, ' ')
      .trim() || 'image';

  return `![${alt}](${value})`;
}

export { transformLayouts };
/*
// CJS/ESM compatibility for usage elsewhere in the codebase.
// eslint-disable-next-line no-undef
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    transformLayouts,
  };
}
*/
