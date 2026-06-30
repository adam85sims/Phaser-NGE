// Helper to parse text with rich tags into a sequence of characters and HTML tags.
// Also extracts engine tags [show/hide/anim], control tags [speed/delay],
// and resolves conditional text {if}...{/if}.
export function parseRichText(text, vars = null) {
  // Step 1: Resolve conditional text first
  const resolved = resolveConditionals(text, vars);

  // Step 2: Parse tags
  const tokens = [];
  const engineTags = [];
  const controlTags = [];

  let i = 0;
  let visibleCharCount = 0;

  // Regex to match all tag types:
  // Engine: [show:target], [hide:target], [anim:target:key]
  // Control: [speed=X], [delay=X] (must be before generic tags to avoid matching as generic)
  // Special: [playername]
  // Generic: [tagname] or [tagname=value] or [/tagname]
  const tagRegex = /\[(show|hide|anim):([^\]]+)\]|\[speed=(\d+)\]|\[delay=(\d+)\]|\[playername\]|\[\/?([a-z_]+(?:=[^\]]+)?)\]/gi;

  let lastIdx = 0;
  let match;

  while ((match = tagRegex.exec(resolved)) !== null) {
    // Add text before the tag as visible character tokens
    const textBefore = resolved.slice(lastIdx, match.index);
    for (const char of textBefore) {
      tokens.push({ type: 'char', char });
      visibleCharCount++;
    }

    const fullMatch = match[0];

    if (match[1]) {
      // Engine tag (show/hide/anim)
      const action = match[1].toLowerCase();
      let target = match[2].trim();
      let animKey = null;
      if (action === 'anim') {
        const parts = target.split(':');
        if (parts.length >= 2) {
          target = parts[0].trim();
          animKey = parts[1].trim();
        }
      }
      engineTags.push({ index: visibleCharCount, action, target, animKey });
    } else if (match[3] !== undefined) {
      // [speed=X] control tag
      controlTags.push({ index: visibleCharCount, action: 'speed', value: Number(match[3]) });
    } else if (match[4] !== undefined) {
      // [delay=X] control tag
      controlTags.push({ index: visibleCharCount, action: 'delay', value: Number(match[4]) });
    } else if (fullMatch.toLowerCase() === '[playername]') {
      // Player name — emit as a special token resolved at render time
      tokens.push({ type: 'playername' });
    } else {
      // Rich text / display tag
      const raw = fullMatch.toLowerCase();
      let html = '';

      if (raw === '[b]') html = '<b>';
      else if (raw === '[/b]') html = '</b>';
      else if (raw === '[i]') html = '<i>';
      else if (raw === '[/i]') html = '</i>';
      else if (raw.startsWith('[color=')) {
        const color = fullMatch.slice(7, -1);
        html = `<span style="color:${color}">`;
      }
      else if (raw === '[/color]') html = '</span>';
      else if (raw.startsWith('[size=')) {
        const sizeVal = fullMatch.slice(6, -1);
        const isRelative = sizeVal.startsWith('+') || sizeVal.startsWith('-');
        if (isRelative) {
          html = `<span class="nge-size-rel" data-size-delta="${sizeVal}">`;
        } else {
          const numVal = parseInt(sizeVal, 10);
          html = `<span style="font-size:${numVal}px">`;
        }
      }
      else if (raw === '[/size]') html = '</span>';
      else if (raw.startsWith('[font=')) {
        const fontFamily = fullMatch.slice(6, -1);
        html = `<span style="font-family:${fontFamily}">`;
      }
      else if (raw === '[/font]') html = '</span>';
      else if (raw === '[wave]') html = '<span class="nge-wave">';
      else if (raw === '[/wave]') html = '</span>';
      else if (raw === '[shake]') html = '<span class="nge-shake">';
      else if (raw === '[/shake]') html = '</span>';

      if (html) {
        const isClose = raw.startsWith('[/');
        const tagType = raw.replace(/\[\/?|=.*/g, '').replace(/\]/g, '');
        tokens.push({ type: 'html', html, isClose, tagType });
      }
    }

    lastIdx = tagRegex.lastIndex;
  }

  // Add remaining text
  const textAfter = resolved.slice(lastIdx);
  for (const char of textAfter) {
    tokens.push({ type: 'char', char });
    visibleCharCount++;
  }

  return { tokens, engineTags, controlTags, totalChars: visibleCharCount };
}

/**
 * Resolve conditional text blocks: {if condition}text{/if} or {if condition}A{else}B{/if}
 * Uses VariableSystem.evaluate() if vars is provided, otherwise strips conditionals.
 */
export function resolveConditionals(text, vars = null) {
  if (!text || typeof text !== 'string') return text || '';

  // Match {if condition}...{/if} and {if condition}...{else}...{/if}
  const condRegex = /\{if\s+([^}]+)\}(.*?)\{\/if\}/gs;

  return text.replace(condRegex, (fullMatch, condition, body) => {
    // Split on {else}
    const elseSplit = body.split('{else}');
    const trueText = elseSplit[0] || '';
    const falseText = elseSplit.length > 1 ? elseSplit.slice(1).join('{else}') : '';

    if (vars) {
      try {
        return vars.evaluate(condition.trim()) ? trueText : falseText;
      } catch {
        return trueText;
      }
    }
    // No vars available — show true text as default
    return trueText;
  });
}

/**
 * Resolve [playername] tags using a variable lookup function.
 */
export function resolvePlayerName(text, getPlayerName) {
  if (!text || typeof text !== 'string') return text || '';
  return text.replace(/\[playername\]/gi, () => {
    const name = getPlayerName ? getPlayerName() : '';
    return name || 'Adventurer';
  });
}

// Helper to generate the HTML string up to a specific visible character count
export function renderRichTextUpTo(tokens, maxChars, playername = '') {
  let html = '';
  let charCount = 0;
  const openTags = [];

  for (const token of tokens) {
    if (charCount >= maxChars && token.type === 'char') break;

    if (token.type === 'html') {
      html += token.html;
      if (!token.isClose) {
        openTags.push(token.tagType);
      } else {
        for (let i = openTags.length - 1; i >= 0; i--) {
          if (openTags[i] === token.tagType) {
            openTags.splice(i, 1);
            break;
          }
        }
      }
    } else if (token.type === 'char') {
      const c = token.char;
      if (c === '<') html += '&lt;';
      else if (c === '>') html += '&gt;';
      else if (c === '&') html += '&amp;';
      else html += c;
      charCount++;
    } else if (token.type === 'playername') {
      html += escapeHtml(playername || 'Adventurer');
    }
  }

  // Auto-close unclosed tags
  for (let i = openTags.length - 1; i >= 0; i--) {
    const t = openTags[i];
    if (t === 'b') html += '</b>';
    else if (t === 'i') html += '</i>';
    else if (t === 'color') html += '</span>';
    else if (t === 'size') html += '</span>';
    else if (t === 'font') html += '</span>';
    else if (t === 'wave') html += '</span>';
    else if (t === 'shake') html += '</span>';
  }

  return html;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
