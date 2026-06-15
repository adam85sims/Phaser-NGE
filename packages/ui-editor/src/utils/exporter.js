/**
 * Serializes the Zustand layout store into a clean JSON structure
 * suitable for consumption by external game engines.
 */
export const exportLayoutToJSON = (nodes) => {
  const rootNode = nodes['root'];
  
  const buildTree = (nodeId) => {
    const node = nodes[nodeId];
    if (!node) return null;

    const exportNode = {
      id: node.id,
      name: node.name,
      type: node.type,
      role: node.role !== 'none' ? node.role : undefined,
      props: { ...node.props }
    };

    if (node.children && node.children.length > 0) {
      exportNode.children = node.children.map(buildTree).filter(Boolean);
    }

    return exportNode;
  };

  const exportedTree = buildTree('root');

  return JSON.stringify({
    schemaVersion: '1.0',
    exportType: 'engine-agnostic-ui',
    layout: exportedTree
  }, null, 2);
};
