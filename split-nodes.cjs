const fs = require('fs');

const input = fs.readFileSync('src/nodes/CoreNodes.js', 'utf8');

let runtimeCode = `import { Registry } from '../systems/Registry.js';\n\n`;
let editorCode = `import { Registry } from '../../src/systems/Registry.js';\n\n`;

// Match blocks: Registry.registerNodeType('typeId', { ... });
const blocks = input.split(/Registry\.registerNodeType\(/);

for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    
    // Find the end of the config object (simple heuristic: look for last }); before another // --- or end of string)
    let endIdx = block.lastIndexOf('});');
    if (endIdx === -1) endIdx = block.length;
    
    let fullBlock = block.substring(0, endIdx);
    
    // Extract typeId
    const typeIdMatch = fullBlock.match(/^'([^']+)'/);
    if (!typeIdMatch) continue;
    const typeId = typeIdMatch[1];
    
    // We will do a simple regex extraction for each property, but because they are functions with nested blocks, regex is hard.
    // Instead of parsing, let's just make the script write the files by splitting on keys.
}
