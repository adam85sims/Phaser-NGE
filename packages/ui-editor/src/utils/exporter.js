/**
 * Serializes the Zustand layout store into a clean JSON structure
 * suitable for consumption by external game engines.
 */
export const exportLayoutToJSON = (nodes) => {
  const rootNode = nodes['root'];
  
  const normalizeSrc = (src) => {
    if (!src || src.startsWith('asset://')) return src;
    return `asset://${src}`;
  };
  
  const buildTree = (nodeId) => {
    const node = nodes[nodeId];
    if (!node) return null;

    const props = { ...node.props };
    
    // Normalize image src to asset:// URI
    if (node.type === 'image' && props.src) {
      props.src = normalizeSrc(props.src);
    }

    const exportNode = {
      id: node.id,
      name: node.name,
      type: node.type,
      role: node.role !== 'none' ? node.role : undefined,
      anchor: node.anchor !== 'top-left' ? node.anchor : undefined,
      props
    };

    if (node.children && node.children.length > 0) {
      exportNode.children = node.children.map(buildTree).filter(Boolean);
    }

    return exportNode;
  };

  const exportedTree = buildTree('root');

  return JSON.stringify({
    schemaVersion: '1.0',
    exportType: 'layouteer-ui',
    layout: exportedTree
  }, null, 2);
};
