/**
 * RichTextHelper unit tests.
 *
 * Tests tag parsing, conditional text, and player name resolution.
 * Pure logic — no Phaser or DOM dependencies.
 */
import { describe, it, expect } from 'vitest';
import { parseRichText, resolveConditionals, renderRichTextUpTo } from '../../src/systems/RichTextHelper.js';

/* ── Helpers ─────────────────────────────── */

/** Stub VariableSystem for conditional tests */
function mockVars(defs) {
  return {
    get(name) { return defs[name]; },
    evaluate(cond) {
      // Simple evaluator for test conditions
      const m = cond.match(/^(\w+)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
      if (!m) return false;
      const [, varName, op, rawVal] = m;
      const current = this.get(varName);
      let val = rawVal.trim();
      if (val === 'true') val = true;
      else if (val === 'false') val = false;
      else if (!isNaN(Number(val))) val = Number(val);
      switch (op) {
        case '==': return current == val;
        case '!=': return current != val;
        case '>=': return current >= val;
        case '<=': return current <= val;
        case '>': return current > val;
        case '<': return current < val;
        default: return false;
      }
    }
  };
}

/* ── Tests ───────────────────────────────── */

describe('RichTextHelper', () => {

  /* ── Basic tag parsing ─────── */

  describe('parseRichText — basic tags', () => {
    it('parses plain text with no tags', () => {
      const result = parseRichText('Hello world');
      expect(result.totalChars).toBe(11);
      expect(result.tokens.filter(t => t.type === 'char')).toHaveLength(11);
      expect(result.engineTags).toHaveLength(0);
    });

    it('parses [b] and [/b] tags', () => {
      const result = parseRichText('[b]bold[/b] text');
      expect(result.totalChars).toBe(9); // "bold text"
      const htmlTokens = result.tokens.filter(t => t.type === 'html');
      expect(htmlTokens[0].html).toBe('<b>');
      expect(htmlTokens[1].html).toBe('</b>');
    });

    it('parses [color=#ff0000] tags', () => {
      const result = parseRichText('[color=#ff0000]red[/color]');
      expect(result.totalChars).toBe(3);
      const htmlTokens = result.tokens.filter(t => t.type === 'html');
      expect(htmlTokens[0].html).toContain('color:#ff0000');
    });
  });

  /* ── New display tags ──────── */

  describe('parseRichText — size tags', () => {
    it('parses [size=24] absolute size', () => {
      const result = parseRichText('[size=24]big text[/size]');
      expect(result.totalChars).toBe(8);
      const htmlTokens = result.tokens.filter(t => t.type === 'html');
      expect(htmlTokens[0].html).toContain('font-size:24px');
      expect(htmlTokens[1].html).toBe('</span>');
    });

    it('parses [size=+4] relative size', () => {
      const result = parseRichText('[size=+4]bigger[/size]');
      const htmlTokens = result.tokens.filter(t => t.type === 'html');
      expect(htmlTokens[0].html).toContain('nge-size-rel');
      expect(htmlTokens[0].html).toContain('data-size-delta="+4"');
    });

    it('parses [size=-2] relative size', () => {
      const result = parseRichText('[size=-2]smaller[/size]');
      const htmlTokens = result.tokens.filter(t => t.type === 'html');
      expect(htmlTokens[0].html).toContain('data-size-delta="-2"');
    });
  });

  describe('parseRichText — font tags', () => {
    it('parses [font=serif] tags', () => {
      const result = parseRichText('[font=serif]fancy text[/font]');
      expect(result.totalChars).toBe(10);
      const htmlTokens = result.tokens.filter(t => t.type === 'html');
      expect(htmlTokens[0].html).toContain('font-family:serif');
    });
  });

  describe('parseRichText — wave/shake tags', () => {
    it('parses [wave] tags', () => {
      const result = parseRichText('[wave]wavy text[/wave]');
      expect(result.totalChars).toBe(9); // "wavy text"
      const htmlTokens = result.tokens.filter(t => t.type === 'html');
      expect(htmlTokens[0].html).toBe('<span class="nge-wave">');
      expect(htmlTokens[1].html).toBe('</span>');
    });

    it('parses [shake] tags', () => {
      const result = parseRichText('[shake]shaking[/shake]');
      const htmlTokens = result.tokens.filter(t => t.type === 'html');
      expect(htmlTokens[0].html).toBe('<span class="nge-shake">');
    });
  });

  /* ── Control tags ──────────── */

  describe('parseRichText — control tags', () => {
    it('parses [speed=80] tag', () => {
      const result = parseRichText('Hello [speed=80]world');
      expect(result.totalChars).toBe(11);
      expect(result.controlTags).toHaveLength(1);
      expect(result.controlTags[0].action).toBe('speed');
      expect(result.controlTags[0].value).toBe(80);
      expect(result.controlTags[0].index).toBe(6); // after "Hello "
    });

    it('parses [delay=500] tag', () => {
      const result = parseRichText('Hello [delay=500]world');
      expect(result.controlTags).toHaveLength(1);
      expect(result.controlTags[0].action).toBe('delay');
      expect(result.controlTags[0].value).toBe(500);
    });

    it('multiple control tags at different positions', () => {
      const result = parseRichText('[speed=120]fast [delay=300]slow [speed=40]very slow');
      expect(result.controlTags).toHaveLength(3);
      expect(result.controlTags[0].action).toBe('speed');
      expect(result.controlTags[1].action).toBe('delay');
      expect(result.controlTags[2].action).toBe('speed');
    });
  });

  /* ── Player name ───────────── */

  describe('parseRichText — playername', () => {
    it('parses [playername] tag', () => {
      const result = parseRichText('Hello [playername]!');
      expect(result.totalChars).toBe(7); // "Hello !"
      const pnTokens = result.tokens.filter(t => t.type === 'playername');
      expect(pnTokens).toHaveLength(1);
    });

    it('parses multiple [playername] tags', () => {
      const result = parseRichText('[playername] met [playername]');
      const pnTokens = result.tokens.filter(t => t.type === 'playername');
      expect(pnTokens).toHaveLength(2);
    });
  });

  /* ── Engine tags (existing) ── */

  describe('parseRichText — engine tags', () => {
    it('parses [show:target] tag', () => {
      const result = parseRichText('Text [show:layer1] more');
      expect(result.engineTags).toHaveLength(1);
      expect(result.engineTags[0].action).toBe('show');
      expect(result.engineTags[0].target).toBe('layer1');
    });

    it('parses [anim:target:key] tag', () => {
      const result = parseRichText('[anim:elena:pulse] Hello');
      expect(result.engineTags).toHaveLength(1);
      expect(result.engineTags[0].action).toBe('anim');
      expect(result.engineTags[0].target).toBe('elena');
      expect(result.engineTags[0].animKey).toBe('pulse');
    });
  });

  /* ── Combined tags ─────────── */

  describe('parseRichText — combined tags', () => {
    it('handles mixed formatting and control tags', () => {
      const result = parseRichText('[b]Hello[/b] [speed=80]world [delay=200]!');
      expect(result.totalChars).toBe(13); // "Hello world !"
      expect(result.controlTags).toHaveLength(2);
      const htmlTokens = result.tokens.filter(t => t.type === 'html');
      expect(htmlTokens[0].html).toBe('<b>');
    });

    it('handles nested tags (auto-close on partial render)', () => {
      const result = parseRichText('[b][i]both[/i][/b]');
      expect(result.totalChars).toBe(4); // "both"
    });
  });

  /* ── Conditional text ──────── */

  describe('resolveConditionals', () => {
    it('resolves true condition', () => {
      const vars = mockVars({ has_key: true });
      const result = resolveConditionals('{if has_key == true}You have the key.{/if}', vars);
      expect(result).toBe('You have the key.');
    });

    it('resolves false condition', () => {
      const vars = mockVars({ has_key: false });
      const result = resolveConditionals('{if has_key == true}Locked.{/if}', vars);
      expect(result).toBe('');
    });

    it('resolves {else} branch', () => {
      const vars = mockVars({ has_key: false });
      const result = resolveConditionals('{if has_key == true}Open!{else}Locked.{/if}', vars);
      expect(result).toBe('Locked.');
    });

    it('resolves true {else} branch', () => {
      const vars = mockVars({ has_key: true });
      const result = resolveConditionals('{if has_key == true}Open!{else}Locked.{/if}', vars);
      expect(result).toBe('Open!');
    });

    it('handles multiple conditionals in one string', () => {
      const vars = mockVars({ has_key: true, has_sword: false });
      const result = resolveConditionals(
        '{if has_key == true}Key!{/if} and {if has_sword == true}Sword!{else}No sword.{/if}',
        vars
      );
      expect(result).toBe('Key! and No sword.');
    });

    it('handles nested conditions (non-nested syntax)', () => {
      const vars = mockVars({ a: true });
      const result = resolveConditionals('{if a == true}yes{/if}', vars);
      expect(result).toBe('yes');
    });

    it('no vars — shows true text as default', () => {
      const result = resolveConditionals('{if x == true}shown{/if}', null);
      expect(result).toBe('shown');
    });

    it('no conditionals — returns text unchanged', () => {
      const result = resolveConditionals('Plain text', null);
      expect(result).toBe('Plain text');
    });

    it('empty text — returns empty', () => {
      const result = resolveConditionals('', null);
      expect(result).toBe('');
    });
  });

  /* ── renderRichTextUpTo ────── */

  describe('renderRichTextUpTo', () => {
    it('renders plain text up to char count', () => {
      const { tokens } = parseRichText('Hello world');
      const html = renderRichTextUpTo(tokens, 5, '');
      expect(html).toBe('Hello');
    });

    it('renders with HTML tags', () => {
      const { tokens } = parseRichText('[b]bold[/b] text');
      const html = renderRichTextUpTo(tokens, 4, '');
      expect(html).toBe('<b>bold</b>');
    });

    it('renders playername tokens', () => {
      const { tokens } = parseRichText('Hello [playername]!');
      const html = renderRichTextUpTo(tokens, 8, 'Alice');
      expect(html).toBe('Hello Alice!');
    });

    it('renders default playername when empty', () => {
      const { tokens } = parseRichText('Hello [playername]!');
      const html = renderRichTextUpTo(tokens, 8, '');
      expect(html).toBe('Hello Adventurer!');
    });

    it('auto-closes unclosed tags at max chars', () => {
      const { tokens } = parseRichText('[b]bold text[/b]');
      const html = renderRichTextUpTo(tokens, 4, '');
      expect(html).toBe('<b>bold</b>');
    });

    it('handles wave/shake classes', () => {
      const { tokens } = parseRichText('[wave]wavy[/wave]');
      const html = renderRichTextUpTo(tokens, 5, '');
      expect(html).toContain('nge-wave');
      expect(html).toContain('wavy');
    });
  });
});
