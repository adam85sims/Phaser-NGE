/**
 * Godot 4 Adapter for Layouteer
 * Converts Layouteer export JSON into a Godot 4 .tscn scene file.
 *
 * Pure function — runs in Node.js or browser.
 *
 * The .tscn format uses Godot's text scene format:
 *   [gd_scene format=3]
 *   [node name="..." type="..." parent="."]
 *   property = value
 *
 * Control nodes use anchor/offset for responsive positioning:
 *   anchor_left/top/right/bottom (0-1, relative to parent)
 *   offset_left/top/right/bottom (pixels from anchor)
 */

export function adaptToGodot(exportJson) {
  const layout = exportJson.layout;
  if (!layout) return { error: 'No layout data' };

  const elements = flattenElements(layout);
  const byRole = groupByRole(elements);
  const lines = [];
  const resources = [];
  let resourceId = 1;
  const resourceMap = {};

  lines.push('[gd_scene format=3]');
  lines.push('');

  // Helper: map Layouteer anchor to Godot anchor values
  // Returns [anchor_left, anchor_top, anchor_right, anchor_bottom]
  function anchorToGodot(anchor, x, y, w, h, parentW, parentH) {
    switch (anchor || 'top-left') {
      case 'top-left':      return { a: [0, 0, 0, 0], o: [x, y, x + w, y + h] };
      case 'top-center':    return { a: [0.5, 0, 0.5, 0], o: [x - w / 2, y, x + w / 2, y + h] };
      case 'top-right':     return { a: [1, 0, 1, 0], o: [x - w, y, x, y + h] };
      case 'center-left':   return { a: [0, 0.5, 0, 0.5], o: [x, y - h / 2, x + w, y + h / 2] };
      case 'center':        return { a: [0.5, 0.5, 0.5, 0.5], o: [x - w / 2, y - h / 2, x + w / 2, y + h / 2] };
      case 'center-right':  return { a: [1, 0.5, 1, 0.5], o: [x - w, y - h / 2, x, y + h / 2] };
      case 'bottom-left':   return { a: [0, 1, 0, 1], o: [x, y - h, x + w, y] };
      case 'bottom-center': return { a: [0.5, 1, 0.5, 1], o: [x - w / 2, y - h, x + w / 2, y] };
      case 'bottom-right':  return { a: [1, 1, 1, 1], o: [x - w, y - h, x, y] };
      default:              return { a: [0, 0, 0, 0], o: [x, y, x + w, y + h] };
    }
  }

  // Helper: resolve asset:// URIs to Godot res:// paths
  function resolveAsset(src) {
    if (!src) return null;
    return src.replace(/^asset:\/\//, 'res://assets/');
  }

  // Helper: map Layouteer type to Godot Control type
  function typeToGodot(type, role) {
    if (role === 'menu_background') return 'TextureRect';
    if (role === 'portrait_left' || role === 'portrait_right') return 'TextureRect';
    if (role === 'menu_title' || role === 'speaker_name' || role === 'dialogue_text') return 'Label';
    if (role === 'menu_button' || role === 'choice_button') return 'Button';
    if (role === 'dialogue_box' || role === 'choice_container') return 'PanelContainer';
    if (role === 'hud_bar') return 'ProgressBar';

    switch (type) {
      case 'canvas': return 'Control';
      case 'panel': return 'PanelContainer';
      case 'text': return 'Label';
      case 'image': return 'TextureRect';
      case 'button': return 'Button';
      case 'scroll': return 'ScrollContainer';
      default: return 'Control';
    }
  }

  // Build parent tree for proper .tscn parent paths
  const parentMap = buildParentMap(layout);

  // Write a node entry
  function writeNode(el, parentPath) {
    const godotType = typeToGodot(el.type, el.role);
    const nodeName = el.name.replace(/[^a-zA-Z0-9_]/g, '_');
    const currentPath = parentPath ? parentPath + '/' + nodeName : nodeName;

    lines.push(`[node name="${nodeName}" type="${godotType}" parent="${parentPath || '.'}"]`);

    // Size flags
    lines.push('size_flags_horizontal = 0');
    lines.push('size_flags_vertical = 0');

    // Layout mode: 0 = anchored, 1 = container (for root control)
    if (el.type === 'canvas') {
      lines.push('layout_mode = 1');
      lines.push(`size = Vector2i(${el.props.width}, ${el.props.height})`);
      lines.push('anchors_preset = 0');
    } else {
      lines.push('layout_mode = 0');

      // Convert position/size + anchor to Godot anchor/offset
      const pW = el.props.width || 0;
      const pH = el.props.height || 0;
      const anchorData = anchorToGodot(el.anchor, el.props.x || 0, el.props.y || 0, pW, pH);
      const [al, at, ar, ab] = anchorData.a;
      const [ol, ot, orr, ob] = anchorData.o;

      lines.push(`anchors_preset = 0`);
      lines.push(`anchor_left = ${al.toFixed(4)}f`);
      lines.push(`anchor_top = ${at.toFixed(4)}f`);
      lines.push(`anchor_right = ${ar.toFixed(4)}f`);
      lines.push(`anchor_bottom = ${ab.toFixed(4)}f`);
      lines.push(`offset_left = ${Math.round(ol)}`);
      lines.push(`offset_top = ${Math.round(ot)}`);
      lines.push(`offset_right = ${Math.round(orr)}`);
      lines.push(`offset_bottom = ${Math.round(ob)}`);

      // Rotation
      if (el.props.rotation) {
        lines.push(`rotation = ${el.props.rotation}`);
      }

      // Visibility
      if (el.visible === false) {
        lines.push('visible = false');
      }
    }

    // Type-specific properties
    if (godotType === 'Label') {
      if (el.props.text) {
        // Escape quotes for Godot string
        const text = el.props.text.replace(/"/g, '\\"');
        lines.push(`text = "${text}"`);
      }
      if (el.props.fontSize) {
        lines.push(`theme_override_font_sizes/font_size = ${el.props.fontSize}`);
      }
      if (el.props.color) {
        const col = hexToGodotColor(el.props.color);
        // Need a font_color theme override
        lines.push(`theme_override_colors/font_color = Color(${col.r}, ${col.g}, ${col.b}, ${col.a})`);
      }
      if (el.props.fontFamily) {
        // Godot uses theme fonts; we can hint at it
        lines.push(`# font_family: ${el.props.fontFamily} (set in theme)`);
      }
      if (el.props.textAlign === 'center') {
        lines.push('horizontal_alignment = 1'); // CENTER
      } else if (el.props.textAlign === 'right') {
        lines.push('horizontal_alignment = 2'); // RIGHT
      }
    }

    if (godotType === 'Button') {
      const label = el.props.label || el.props.text || '';
      const text = label.replace(/"/g, '\\"');
      lines.push(`text = "${text}"`);
      if (el.props.backgroundColor) {
        const col = hexToGodotColor(el.props.backgroundColor);
        lines.push(`theme_override_colors/button_normal_bg = Color(${col.r}, ${col.g}, ${col.b}, ${col.a})`);
      }
      if (el.props.color) {
        const col = hexToGodotColor(el.props.color);
        lines.push(`theme_override_colors/font_color = Color(${col.r}, ${col.g}, ${col.b}, ${col.a})`);
      }
      if (el.props.fontSize) {
        lines.push(`theme_override_font_sizes/font_size = ${el.props.fontSize}`);
      }
    }

    if (godotType === 'TextureRect') {
      const src = resolveAsset(el.props.src);
      if (src) {
        // Register as external resource
        let rid = resourceMap[src];
        if (!rid) {
          rid = resourceId++;
          resourceMap[src] = rid;
          resources.push({ id: rid, path: src });
        }
        lines.push(`texture = ExtResource("${rid}")`);
      }
      if (el.props.objectFit === 'cover') {
        lines.push('stretch_mode = 1'); // KEEP_ASPECT_COVERED
      } else if (el.props.objectFit === 'fill') {
        lines.push('stretch_mode = 5'); // STRETCH
      } else {
        lines.push('stretch_mode = 0'); // SCALE_ON_EXPAND (contain default)
      }
      if (el.props.opacity !== undefined) {
        lines.push(`modulate = Color(1, 1, 1, ${el.props.opacity})`);
      }
    }

    if (godotType === 'PanelContainer') {
      if (el.props.backgroundColor) {
        const col = hexToGodotColor(el.props.backgroundColor);
        lines.push(`theme_override_styles/panel = StyleBoxFlat`);
        // Sub-resource for the style
        const subId = resourceId++;
        lines.push(`__sub_res_${subId} = {
"type": "StyleBoxFlat",
"resource_name": "",
"bg_color": Color(${col.r}, ${col.g}, ${col.b}, ${col.a}),
"corner_radius_top_left": ${el.props.borderRadius || 0},
"corner_radius_top_right": ${el.props.borderRadius || 0},
"corner_radius_bottom_left": ${el.props.borderRadius || 0},
"corner_radius_bottom_right": ${el.props.borderRadius || 0}
}`);
        lines.push(`theme_override_styles/panel = SubResource("${subId}")`);
      }
    }

    if (godotType === 'ProgressBar') {
      if (el.props.backgroundColor) {
        const col = hexToGodotColor(el.props.backgroundColor);
        lines.push(`theme_override_colors/progress_bar_background = Color(${col.r}, ${col.g}, ${col.b}, ${col.a})`);
      }
    }

    if (el.props.opacity !== undefined && godotType !== 'TextureRect') {
      lines.push(`modulate = Color(1, 1, 1, ${el.props.opacity})`);
    }

    lines.push('');
  }

  // Walk the tree and write nodes
  function walkTree(node, parentPath, depth) {
    if (node.id !== 'root') {
      writeNode(node, parentPath);
    }

    if (node.children) {
      const nodePath = node.id === 'root' ? node.name.replace(/[^a-zA-Z0-9_]/g, '_') : parentPath 
        ? parentPath + '/' + node.name.replace(/[^a-zA-Z0-9_]/g, '_') 
        : node.name.replace(/[^a-zA-Z0-9_]/g, '_');
      const childParent = node.id === 'root' ? '.' : nodePath;

      for (const child of node.children) {
        if (typeof child === 'object') {
          walkTree(child, childParent, depth + 1);
        }
      }
    }
  }

  walkTree(layout, null, 0);

  // Prepend resource declarations
  let output = '';
  if (resources.length > 0) {
    output += `[gd_scene format=3 load_steps=${resources.length + 1}]\n\n`;
    for (const res of resources) {
      output += `[ext_resource type="Texture2D" path="${res.path}" id="${res.id}"]\n`;
    }
    output += '\n';
  }

  output += lines.join('\n');

  return output;
}

function flattenElements(node) {
  const result = [];
  if (!node) return result;
  result.push(node);
  if (node.children) {
    for (const child of node.children) {
      if (typeof child === 'object') {
        result.push(...flattenElements(child));
      }
    }
  }
  return result;
}

function groupByRole(elements) {
  const map = {};
  for (const el of elements) {
    if (el.role) {
      if (!map[el.role]) map[el.role] = [];
      map[el.role].push(el);
    }
  }
  return map;
}

function buildParentMap(rootNode) {
  const map = {};
  function walk(node, parentPath) {
    const path = node.id === 'root' ? '' : (parentPath ? parentPath + '/' + node.name : node.name);
    if (node.id !== 'root') {
      map[node.id] = path;
    }
    if (node.children) {
      for (const child of node.children) {
        if (typeof child === 'object') {
          walk(child, path);
        }
      }
    }
  }
  walk(rootNode, null);
  return map;
}

function hexToGodotColor(hex) {
  if (!hex || hex === 'transparent') return { r: 1, g: 1, b: 1, a: 0 };
  let h = hex.replace('#', '');
  let r, g, b, a = 1;
  if (h.length === 8) {
    r = parseInt(h.slice(0, 2), 16) / 255;
    g = parseInt(h.slice(2, 4), 16) / 255;
    b = parseInt(h.slice(4, 6), 16) / 255;
    a = parseInt(h.slice(6, 8), 16) / 255;
  } else if (h.length === 6) {
    r = parseInt(h.slice(0, 2), 16) / 255;
    g = parseInt(h.slice(2, 4), 16) / 255;
    b = parseInt(h.slice(4, 6), 16) / 255;
  } else {
    return { r: 1, g: 1, b: 1, a: 1 };
  }
  return { r: r.toFixed(4), g: g.toFixed(4), b: b.toFixed(4), a: a.toFixed(4) };
}

/**
 * Public API: returns the Godot .tscn scene as a string.
 */
export function exportToGodot(exportJson) {
  return adaptToGodot(exportJson);
}
