
import { ModelData, PrimitiveType, Primitive } from '../types';

/**
 * Converts a Hex color string to a 24-bit integer for DXF TrueColor (code 420).
 */
function hexToTrueColor(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 0;
  const b = parseInt(hex.slice(5, 7), 16) || 0;
  return (r << 16) | (g << 8) | b;
}

/**
 * Simple Hex to ACI (AutoCAD Color Index) for fallback.
 */
function hexToACI(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 0;
  const b = parseInt(hex.slice(5, 7), 16) || 0;
  
  if (r > 200 && g < 100 && b < 100) return 1; // Red
  if (g > 200 && r < 100 && b < 100) return 3; // Green
  if (b > 200 && r < 100 && g < 100) return 5; // Blue
  return 7; // White/Default
}

/**
 * Applies transformation (scale, rotation, position) to a vertex.
 */
function transformVertex(v: number[], p: Primitive): [number, number, number] {
  const [px, py, pz] = p.position;
  const [sx, sy, sz] = p.scale;
  const [rx, ry, rz] = p.rotation;

  let x = v[0] * sx;
  let y = v[1] * sy;
  let z = v[2] * sz;

  // Rotation X
  let y1 = y * Math.cos(rx) - z * Math.sin(rx);
  let z1 = y * Math.sin(rx) + z * Math.cos(rx);
  y = y1; z = z1;

  // Rotation Y
  let x2 = x * Math.cos(ry) + z * Math.sin(ry);
  let z2 = -x * Math.sin(ry) + z * Math.cos(ry);
  x = x2; z = z2;

  // Rotation Z
  let x3 = x * Math.cos(rz) - y * Math.sin(rz);
  let y3 = x * Math.sin(rz) + y * Math.cos(rz);
  x = x3; y = y3;

  return [x + px, y + py, z + pz];
}

/**
 * Generates a 3DFACE entity string for DXF.
 * Uses code 420 for TrueColor support.
 */
function create3DFace(v1: number[], v2: number[], v3: number[], v4: number[], layer: string, trueColor: number): string {
  return `0\n3DFACE\n8\n${layer}\n62\n7\n420\n${trueColor}\n` +
         `10\n${v1[0]}\n20\n${v1[1]}\n30\n${v1[2]}\n` +
         `11\n${v2[0]}\n21\n${v2[1]}\n31\n${v2[2]}\n` +
         `12\n${v3[0]}\n22\n${v3[1]}\n32\n${v3[2]}\n` +
         `13\n${v4[0]}\n23\n${v4[1]}\n33\n${v4[2]}\n`;
}

/**
 * Generates an OBJ file string.
 */
export function exportToOBJ(model: ModelData): string {
  let objContent = "# GeoImage Export\n";
  let vertexOffset = 1;

  model.primitives.forEach((p, idx) => {
    objContent += `g Primitive_${idx + 1}_${p.type}\n`;
    
    const verts = [
        [-0.5,-0.5,-0.5], [0.5,-0.5,-0.5], [0.5, 0.5,-0.5], [-0.5, 0.5,-0.5],
        [-0.5,-0.5, 0.5], [0.5,-0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]
    ].map(v => transformVertex(v, p));

    verts.forEach(v => {
      objContent += `v ${v[0]} ${v[1]} ${v[2]}\n`;
    });

    const faces = [
      [1, 2, 3, 4], [5, 8, 7, 6], [1, 5, 6, 2], 
      [2, 6, 7, 3], [3, 7, 8, 4], [4, 8, 5, 1]
    ];

    faces.forEach(f => {
      objContent += `f ${f[0] + vertexOffset - 1} ${f[1] + vertexOffset - 1} ${f[2] + vertexOffset - 1} ${f[3] + vertexOffset - 1}\n`;
    });
    
    vertexOffset += 8;
  });
  return objContent;
}

/**
 * Generates a high-quality DXF file for BIM/AutoCAD.
 * Implements independent layers and TrueColor RGB matching.
 */
export function exportToDXF(model: ModelData): string {
  // DXF Header
  let dxf = "0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1015\n0\nENDSEC\n";
  
  // TABLES Section (Define Layers with Colors)
  dxf += "0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLTYPE\n70\n1\n0\nLTYPE\n2\nCONTINUOUS\n70\n0\n3\nSolid line\n72\n65\n73\n0\n40\n0.0\n0\nENDTAB\n";
  dxf += "0\nTABLE\n2\nLAYER\n70\n" + model.primitives.length + "\n";
  
  model.primitives.forEach((p, idx) => {
    const layerName = `GEO_PIEZA_${idx + 1}`;
    const trueColor = hexToTrueColor(p.color);
    dxf += `0\nLAYER\n2\n${layerName}\n70\n0\n62\n7\n420\n${trueColor}\n6\nCONTINUOUS\n`;
  });
  
  dxf += "0\nENDTAB\n0\nENDSEC\n";

  // ENTITIES Section
  dxf += "0\nSECTION\n2\nENTITIES\n";

  model.primitives.forEach((p, idx) => {
    const layerName = `GEO_PIEZA_${idx + 1}`;
    const trueColor = hexToTrueColor(p.color);

    if (p.type === PrimitiveType.BOX) {
      const v = [
        [-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5],
        [-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]
      ].map(vert => transformVertex(vert, p));

      dxf += create3DFace(v[0], v[1], v[2], v[3], layerName, trueColor);
      dxf += create3DFace(v[4], v[7], v[6], v[5], layerName, trueColor);
      dxf += create3DFace(v[0], v[4], v[5], v[1], layerName, trueColor);
      dxf += create3DFace(v[1], v[5], v[6], v[2], layerName, trueColor);
      dxf += create3DFace(v[2], v[6], v[7], v[3], layerName, trueColor);
      dxf += create3DFace(v[3], v[7], v[4], v[0], layerName, trueColor);
    } 
    else if (p.type === PrimitiveType.PYRAMID) {
      const v = [
        [-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5],
        [0, 0, 0.5]
      ].map(vert => transformVertex(vert, p));

      dxf += create3DFace(v[0], v[1], v[2], v[3], layerName, trueColor);
      dxf += create3DFace(v[0], v[1], v[4], v[4], layerName, trueColor);
      dxf += create3DFace(v[1], v[2], v[4], v[4], layerName, trueColor);
      dxf += create3DFace(v[2], v[3], v[4], v[4], layerName, trueColor);
      dxf += create3DFace(v[3], v[0], v[4], v[4], layerName, trueColor);
    }
    else if (p.type === PrimitiveType.CYLINDER) {
      const segments = 16;
      const bottomCircle: number[][] = [];
      const topCircle: number[][] = [];
      
      for(let i=0; i<segments; i++) {
        const ang = (i / segments) * Math.PI * 2;
        bottomCircle.push(transformVertex([0.5 * Math.cos(ang), 0.5 * Math.sin(ang), -0.5], p));
        topCircle.push(transformVertex([0.5 * Math.cos(ang), 0.5 * Math.sin(ang), 0.5], p));
      }

      for(let i=0; i<segments; i++) {
        const next = (i + 1) % segments;
        dxf += create3DFace(bottomCircle[i], bottomCircle[next], topCircle[next], topCircle[i], layerName, trueColor);
        dxf += create3DFace(topCircle[i], topCircle[next], transformVertex([0,0,0.5], p), transformVertex([0,0,0.5], p), layerName, trueColor);
        dxf += create3DFace(bottomCircle[i], bottomCircle[next], transformVertex([0,0,-0.5], p), transformVertex([0,0,-0.5], p), layerName, trueColor);
      }
    }
    else {
      // SPHERE (Box simplified)
      const v = [
        [-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5],
        [-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]
      ].map(vert => transformVertex(vert, p));
      dxf += create3DFace(v[0], v[1], v[2], v[3], layerName, trueColor);
      dxf += create3DFace(v[4], v[7], v[6], v[5], layerName, trueColor);
      dxf += create3DFace(v[0], v[4], v[5], v[1], layerName, trueColor);
      dxf += create3DFace(v[1], v[5], v[6], v[2], layerName, trueColor);
      dxf += create3DFace(v[2], v[6], v[7], v[3], layerName, trueColor);
      dxf += create3DFace(v[3], v[7], v[4], v[0], layerName, trueColor);
    }
  });

  dxf += "0\nENDSEC\n0\nEOF\n";
  return dxf;
}

export function downloadFile(content: string, fileName: string, contentType: string) {
  const file = new Blob([content], { type: contentType });
  const a = document.createElement("a");
  const url = URL.createObjectURL(file);
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 0);
}
