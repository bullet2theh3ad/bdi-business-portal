'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SemanticBDIIcon } from '@/components/BDIIcon';

interface Organization {
  id: string;
  name: string;
  code: string;
}

interface DirectionalConnection {
  id: string;
  sourceOrganizationId: string;
  targetOrganizationId: string;
  sourceOrganizationName: string;
  targetOrganizationName: string;
  sourceOrganizationCode: string;
  targetOrganizationCode: string;
  connectionType: 'messaging' | 'file_share' | 'full_collaboration';
  status: string;
  permissions: any;
  allowedDataCategories: ('public' | 'partner' | 'confidential' | 'internal')[];
  description?: string;
  tags: string[];
}

interface NetworkNode {
  id: string;
  name: string;
  code: string;
  x: number;
  y: number;
  isBDI: boolean;
  connectionCount: number;
}

interface NetworkEdge {
  id: string;
  source: string;
  target: string;
  connectionType: 'messaging' | 'file_share' | 'full_collaboration';
  dataCategories: string[];
  permissions: any;
  isReverse?: boolean;
}

interface NetworkDiagramProps {
  organizations: Organization[];
  connections: DirectionalConnection[];
  onNodeClick?: (node: NetworkNode) => void;
  onEdgeClick?: (edge: NetworkEdge) => void;
}

const CONNECTION_COLORS = {
  messaging: '#3B82F6', // Blue
  file_share: '#F59E0B', // Orange  
  full_collaboration: '#10B981', // Green
};

const DATA_CATEGORY_COLORS = {
  public: '#10B981',
  partner: '#3B82F6', 
  confidential: '#F59E0B',
  internal: '#EF4444',
};

export function NetworkDiagram({ organizations, connections, onNodeClick, onEdgeClick }: NetworkDiagramProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<NetworkEdge | null>(null);
  const [showLabels, setShowLabels] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'messaging' | 'file_share' | 'full_collaboration'>('all');
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Create network nodes and edges
  const nodes: NetworkNode[] = organizations.map((org, index) => {
    const angle = (index / organizations.length) * 2 * Math.PI;
    const radius = Math.min(dimensions.width, dimensions.height) * 0.35;
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;
    
    // Place BDI in the center if it exists, others in a circle
    const isBDI = org.code === 'BDI';
    let x, y;
    
    if (isBDI) {
      x = centerX;
      y = centerY;
    } else {
      // Adjust angle to account for BDI being in center
      const nonBDIOrgs = organizations.filter(o => o.code !== 'BDI');
      const adjustedIndex = nonBDIOrgs.findIndex(o => o.id === org.id);
      const adjustedAngle = (adjustedIndex / nonBDIOrgs.length) * 2 * Math.PI;
      x = centerX + Math.cos(adjustedAngle) * radius;
      y = centerY + Math.sin(adjustedAngle) * radius;
    }
    
    const connectionCount = connections.filter(c => 
      c.sourceOrganizationId === org.id || c.targetOrganizationId === org.id
    ).length;

    return {
      id: org.id,
      name: org.name,
      code: org.code,
      x,
      y,
      isBDI,
      connectionCount,
    };
  });

  const edges: NetworkEdge[] = connections
    .filter(conn => filterType === 'all' || conn.connectionType === filterType)
    .map(conn => {
      const sourceNode = nodes.find(n => n.id === conn.sourceOrganizationId);
      const targetNode = nodes.find(n => n.id === conn.targetOrganizationId);
      
      if (!sourceNode || !targetNode) return null;

      // Check if there's a reverse connection
      const reverseConnection = connections.find(c => 
        c.sourceOrganizationId === conn.targetOrganizationId && 
        c.targetOrganizationId === conn.sourceOrganizationId
      );

      return {
        id: conn.id,
        source: conn.sourceOrganizationId,
        target: conn.targetOrganizationId,
        connectionType: conn.connectionType,
        dataCategories: conn.allowedDataCategories,
        permissions: conn.permissions,
        isReverse: false,
      };
    })
    .filter(Boolean) as NetworkEdge[];

  // Calculate arrow path for directional connections
  const getArrowPath = (sourceNode: NetworkNode, targetNode: NetworkNode, offset = 0) => {
    const dx = targetNode.x - sourceNode.x;
    const dy = targetNode.y - sourceNode.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Normalize direction
    const unitX = dx / distance;
    const unitY = dy / distance;
    
    // Node radius (approximate)
    const nodeRadius = 30;
    
    // Calculate start and end points (outside node circles)
    const startX = sourceNode.x + unitX * nodeRadius;
    const startY = sourceNode.y + unitY * nodeRadius;
    const endX = targetNode.x - unitX * (nodeRadius + 10); // Leave space for arrowhead
    const endY = targetNode.y - unitY * (nodeRadius + 10);
    
    // Apply offset for multiple connections between same nodes
    const perpX = -unitY * offset;
    const perpY = unitX * offset;
    
    return {
      startX: startX + perpX,
      startY: startY + perpY,
      endX: endX + perpX,
      endY: endY + perpY,
      unitX,
      unitY,
    };
  };

  const handleNodeClick = (node: NetworkNode) => {
    setSelectedNode(selectedNode?.id === node.id ? null : node);
    setSelectedEdge(null);
    onNodeClick?.(node);
  };

  const handleEdgeClick = (edge: NetworkEdge) => {
    setSelectedEdge(selectedEdge?.id === edge.id ? null : edge);
    setSelectedNode(null);
    onEdgeClick?.(edge);
  };

  // Update dimensions on window resize
  useEffect(() => {
    const updateDimensions = () => {
      if (svgRef.current) {
        const container = svgRef.current.parentElement;
        if (container) {
          setDimensions({
            width: container.clientWidth,
            height: Math.max(600, container.clientWidth * 0.6),
          });
        }
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-gray-50 rounded-lg">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <span className="text-sm font-medium text-gray-700">Filter:</span>
          <div className="flex flex-wrap gap-1">
            {(['all', 'messaging', 'file_share', 'full_collaboration'] as const).map(type => (
              <Button
                key={type}
                variant={filterType === type ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterType(type)}
                className={`text-xs px-2 py-1 ${
                  filterType === type ? 'bg-bdi-green-1 hover:bg-bdi-green-2 text-white' : 'hover:bg-white'
                }`}
              >
                {type === 'all' ? 'All' : 
                 type === 'messaging' ? 'MSG' : 
                 type === 'file_share' ? 'FILE' : 'FULL'}
              </Button>
            ))}
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showLabels}
              onChange={(e) => setShowLabels(e.target.checked)}
              className="rounded text-bdi-green-1 focus:ring-bdi-green-1"
            />
            <span className="text-gray-700">Show Labels</span>
          </label>
          
          <div className="text-xs text-gray-600 bg-white px-2 py-1 rounded">
            {nodes.length} orgs • {edges.length} connections
          </div>
        </div>
      </div>

      {/* Network Diagram */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SemanticBDIIcon semantic="collaboration" className="w-5 h-5 text-bdi-green-1" />
            Organization Network Map
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <svg
              ref={svgRef}
              width={dimensions.width}
              height={dimensions.height}
              viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
              className="border border-gray-200 rounded-lg bg-white"
            >
              {/* Define arrow markers */}
              <defs>
                {Object.entries(CONNECTION_COLORS).map(([type, color]) => (
                  <marker
                    key={type}
                    id={`arrow-${type}`}
                    markerWidth="10"
                    markerHeight="10"
                    refX="8"
                    refY="3"
                    orient="auto"
                    markerUnits="strokeWidth"
                  >
                    <polygon
                      points="0,0 0,6 9,3"
                      fill={color}
                    />
                  </marker>
                ))}
              </defs>

              {/* Draw edges (connections) */}
              {edges.map((edge, index) => {
                const sourceNode = nodes.find(n => n.id === edge.source);
                const targetNode = nodes.find(n => n.id === edge.target);
                
                if (!sourceNode || !targetNode) return null;

                const { startX, startY, endX, endY } = getArrowPath(sourceNode, targetNode, 0);
                const color = CONNECTION_COLORS[edge.connectionType];
                const isSelected = selectedEdge?.id === edge.id;

                return (
                  <g key={edge.id}>
                    <line
                      x1={startX}
                      y1={startY}
                      x2={endX}
                      y2={endY}
                      stroke={color}
                      strokeWidth={isSelected ? 4 : 2}
                      markerEnd={`url(#arrow-${edge.connectionType})`}
                      className="cursor-pointer hover:stroke-width-3 transition-all"
                      onClick={() => handleEdgeClick(edge)}
                      opacity={isSelected ? 1 : 0.8}
                    />
                    
                    {/* Data category indicators */}
                    <g>
                      {edge.dataCategories.map((category, catIndex) => {
                        const midX = (startX + endX) / 2 + (catIndex - edge.dataCategories.length / 2) * 8;
                        const midY = (startY + endY) / 2;
                        
                        return (
                          <circle
                            key={category}
                            cx={midX}
                            cy={midY - 10}
                            r="3"
                            fill={DATA_CATEGORY_COLORS[category as keyof typeof DATA_CATEGORY_COLORS]}
                            className="cursor-pointer"
                            onClick={() => handleEdgeClick(edge)}
                          />
                        );
                      })}
                    </g>
                  </g>
                );
              })}

              {/* Draw nodes (organizations) */}
              {nodes.map((node) => {
                const isSelected = selectedNode?.id === node.id;
                const isHighlighted = selectedEdge && (selectedEdge.source === node.id || selectedEdge.target === node.id);
                
                return (
                  <g key={node.id}>
                    {/* Node circle */}
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={node.isBDI ? 35 : 25}
                      fill={node.isBDI ? '#1D897A' : '#3B82F6'}
                      stroke={isSelected || isHighlighted ? '#F59E0B' : '#ffffff'}
                      strokeWidth={isSelected || isHighlighted ? 3 : 2}
                      className="cursor-pointer hover:stroke-yellow-500 transition-all"
                      onClick={() => handleNodeClick(node)}
                      opacity={isSelected || isHighlighted ? 1 : 0.9}
                    />
                    
                    {/* Node label */}
                    {showLabels && (
                      <g>
                        <text
                          x={node.x}
                          y={node.y + 2}
                          textAnchor="middle"
                          className="fill-white font-bold text-sm pointer-events-none"
                        >
                          {node.code}
                        </text>
                        <text
                          x={node.x}
                          y={node.y + (node.isBDI ? 50 : 40)}
                          textAnchor="middle"
                          className="fill-gray-700 text-xs font-medium pointer-events-none"
                          style={{ maxWidth: '80px' }}
                        >
                          {node.name.length > 15 ? node.name.substring(0, 13) + '...' : node.name}
                        </text>
                        
                        {/* Connection count badge */}
                        {node.connectionCount > 0 && (
                          <>
                            <circle
                              cx={node.x + (node.isBDI ? 25 : 18)}
                              cy={node.y - (node.isBDI ? 25 : 18)}
                              r="10"
                              fill="#EF4444"
                              className="pointer-events-none"
                            />
                            <text
                              x={node.x + (node.isBDI ? 25 : 18)}
                              y={node.y - (node.isBDI ? 25 : 18) + 4}
                              textAnchor="middle"
                              className="fill-white text-xs font-bold pointer-events-none"
                            >
                              {node.connectionCount}
                            </text>
                          </>
                        )}
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Connection Types Legend */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-900">Connection Types</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {Object.entries(CONNECTION_COLORS).map(([type, color]) => (
                <div key={type} className="flex items-center gap-3">
                  <div className="w-6 h-1 rounded-full" style={{ backgroundColor: color }}></div>
                  <span className="text-sm text-gray-700 capitalize">{type.replace('_', ' ')}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Data Categories Legend */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-900">Data Categories</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {Object.entries(DATA_CATEGORY_COLORS).map(([category, color]) => (
                <div key={category} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }}></div>
                  <span className="text-sm text-gray-700 capitalize">{category}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Selection Details */}
      {selectedNode && (
        <Card className="border-2 border-bdi-green-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SemanticBDIIcon semantic="collaboration" className="w-5 h-5 text-bdi-green-1" />
              {selectedNode.name} ({selectedNode.code})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Type:</span> {selectedNode.isBDI ? 'Internal (BDI)' : 'External Partner'}
              </div>
              <div>
                <span className="font-medium">Connections:</span> {selectedNode.connectionCount}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedEdge && (
        <Card className="border-2 border-orange-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SemanticBDIIcon semantic="connect" className="w-5 h-5 text-orange-500" />
              Connection Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {nodes.find(n => n.id === selectedEdge.source)?.code}
                </Badge>
                <SemanticBDIIcon semantic="arrow-right" className="w-4 h-4 text-gray-400" />
                <Badge variant="outline">
                  {nodes.find(n => n.id === selectedEdge.target)?.code}
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Type:</span> {selectedEdge.connectionType.replace('_', ' ')}
                </div>
                <div>
                  <span className="font-medium">Data Access:</span>
                  <div className="flex gap-1 mt-1">
                    {selectedEdge.dataCategories.map(cat => (
                      <Badge key={cat} variant="secondary" className="text-xs">
                        {cat}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
