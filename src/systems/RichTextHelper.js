// Helper to parse text with rich tags into a sequence of characters and HTML tags.
// Also extracts our custom engine tags [show/hide/anim].
export function parseRichText(text) {
  const tokens = [];
  const engineTags = [];
  
  let i = 0;
  let visibleCharCount = 0;
  
  // Regex to match engine tags AND bbcode-style rich tags
  // Engine: [show:target], [hide:target], [anim:target:key]
  // BBCode: [b], [/b], [i], [/i], [color=red], [/color]
  const tagRegex = /\[(show|hide|anim):([^\]]+)\]|\[\/?(b|i|color(?:=[^\]]+)?)\]/gi;
  
  let lastIdx = 0;
  let match;
  
  while ((match = tagRegex.exec(text)) !== null) {
    // Add text before the tag as visible character tokens
    const textBefore = text.slice(lastIdx, match.index);
    for (const char of textBefore) {
      tokens.push({ type: 'char', char });
      visibleCharCount++;
    }
    
    // Process the match
    if (match[1]) {
      // It's an engine tag (match[1] is show|hide|anim)
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
      engineTags.push({
        index: visibleCharCount,
        action,
        target,
        animKey
      });
    } else {
      // It's a rich text tag
      const rawTag = match[0].toLowerCase();
      let htmlTag = '';
      if (rawTag === '[b]') htmlTag = '<b>';
      else if (rawTag === '[/b]') htmlTag = '</b>';
      else if (rawTag === '[i]') htmlTag = '<i>';
      else if (rawTag === '[/i]') htmlTag = '</i>';
      else if (rawTag.startsWith('[color=')) {
        const color = match[0].slice(7, -1);
        htmlTag = `<span style="color:${color}">`;
      }
      else if (rawTag === '[/color]') htmlTag = '</span>';
      
      if (htmlTag) {
        tokens.push({ type: 'html', html: htmlTag, isClose: rawTag.startsWith('[/'), tagType: rawTag.replace(/\[\/?|=.*/g, '') });
      }
    }
    lastIdx = tagRegex.lastIndex;
  }
  
  // Add remaining text
  const textAfter = text.slice(lastIdx);
  for (const char of textAfter) {
    tokens.push({ type: 'char', char });
    visibleCharCount++;
  }
  
  return { tokens, engineTags, totalChars: visibleCharCount };
}

// Helper to generate the HTML string up to a specific visible character count
export function renderRichTextUpTo(tokens, maxChars) {
  let html = '';
  let charCount = 0;
  const openTags = []; // Stack of unclosed tags to auto-close
  
  for (const token of tokens) {
    if (charCount >= maxChars && token.type === 'char') {
      break;
    }
    
    if (token.type === 'html') {
      html += token.html;
      if (!token.isClose) {
        openTags.push(token.tagType);
      } else {
        // Pop the last matching tag
        for (let i = openTags.length - 1; i >= 0; i--) {
          if (openTags[i] === token.tagType) {
            openTags.splice(i, 1);
            break;
          }
        }
      }
    } else if (token.type === 'char') {
      // Escape HTML entities to prevent injection/broken rendering
      const c = token.char;
      if (c === '<') html += '&lt;';
      else if (c === '>') html += '&gt;';
      else if (c === '&') html += '&amp;';
      else html += c;
      
      charCount++;
    }
  }
  
  // Auto-close any unclosed tags
  for (let i = openTags.length - 1; i >= 0; i--) {
    const t = openTags[i];
    if (t === 'b') html += '</b>';
    else if (t === 'i') html += '</i>';
    else if (t === 'color') html += '</span>';
  }
  
  return html;
}
