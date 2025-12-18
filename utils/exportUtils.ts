
import { ModelData, PrimitiveType, Primitive } from '../types';

/**
 * Maps Hex to standard AutoCAD Color Index (1-7)
 */
function hexToACI(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 0;
  const b = parseInt(hex.slice(5, 7), 16) || 0;
  
  if (r > 180 && g < 100 && b < 100) return 1; // Red
  if (r > 180 && g > 180 && b < 100) return 2; // Yellow
  if (g > 180 && r < 100 && b < 100) return 3; // Green
  if (g > 180 && b > 180 && r < 100) return 4; // Cyan
  if (b > 180 && r < 100 && g < 100) return 5; // Blue
  if (r > 180 && b > 180 && g < 100) return 6; // Magenta
  return 7; // White/Black
}

/**
 * Applies 3D transformations to a vertex based on primitive properties
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
 * Creates a DXF 3DFACE entity (R12 compatible)
 */
function create3DFace(v1: number[], v2: number[], v3: number[], v4: number[] | undefined, layer: string, color: number): string {
  // En DXF R12, para un triángulo, el punto 4 debe ser igual al punto 3
  const p4 = v4 || v3;
  return `0\n3DFACE\n8\n${layer}\n62\n${color}\n` +
         `10\n${v1[0].toFixed(6)}\n20\n${v1[1].toFixed(6)}\n30\n${v1[2].toFixed(6)}\n` +
         `11\n${v2[0].toFixed(6)}\n21\n${v2[1].toFixed(6)}\n31\n${v2[2].toFixed(6)}\n` +
         `12\n${v3[0].toFixed(6)}\n22\n${v3[1].toFixed(6)}\n32\n${v3[2].toFixed(6)}\n` +
         `13\n${p4[0].toFixed(6)}\n23\n${p4[1].toFixed(6)}\n33\n${p4[2].toFixed(6)}\n`;
}

/**
 * Helper to generate geometry vertices and faces for each primitive type
 */
function getPrimitiveGeometry(p: Primitive) {
  const vertices: [number, number, number][] = [];
  const faces: number[][] = []; 

  switch (p.type) {
    case PrimitiveType.BOX:
      [
        [-0.5,-0.5,-0.5], [0.5,-0.5,-0.5], [0.5,0.5,-0.5], [-0.5,0.5,-0.5],
        [-0.5,-0.5, 0.5], [0.5,-0.5, 0.5], [0.5,0.5, 0.5], [-0.5,0.5, 0.5]
      ].forEach(v => vertices.push(transformVertex(v, p)));
      faces.push([0,1,2,3], [4,7,6,5], [0,4,5,1], [1,5,6,2], [2,6,7,3], [3,7,4,0]);
      break;

    case PrimitiveType.CYLINDER:
      const segments = 16;
      for (let i = 0; i < segments; i++) {
        const a = (i / segments) * Math.PI * 2;
        vertices.push(transformVertex([0.5 * Math.cos(a), -0.5, 0.5 * Math.sin(a)], p));
      }
      for (let i = 0; i < segments; i++) {
        const a = (i / segments) * Math.PI * 2;
        vertices.push(transformVertex([0.5 * Math.cos(a), 0.5, 0.5 * Math.sin(a)], p));
      }
      const bC = vertices.length;
      vertices.push(transformVertex([0, -0.5, 0], p));
      const tC = vertices.length;
      vertices.push(transformVertex([0, 0.5, 0], p));

      for (let i = 0; i < segments; i++) {
        const n = (i + 1) % segments;
        faces.push([i, n, n + segments, i + segments]); // Lado
        faces.push([i, bC, n]); // Tapa inferior
        faces.push([i + segments, n + segments, tC]); // Tapa superior
      }
      break;

    case PrimitiveType.PYRAMID:
      [[-0.5,-0.5,-0.5], [0.5,-0.5,-0.5], [0.5,-0.5,0.5], [-0.5,-0.5,0.5]].forEach(v => vertices.push(transformVertex(v, p)));
      vertices.push(transformVertex([0, 0.5, 0], p));
      faces.push([0,1,2,3]); // Base
      faces.push([0,4,1]); faces.push([1,4,2]); faces.push([2,4,3]); faces.push([3,4,0]); // Caras
      break;

    case PrimitiveType.SPHERE:
      const latR = 8; const lonR = 12;
      for (let lat = 0; lat <= latR; lat++) {
        const th = (lat * Math.PI) / latR;
        const sTh = Math.sin(th); const cTh = Math.cos(th);
        for (let lon = 0; lon <= lonR; lon++) {
          const ph = (lon * 2 * Math.PI) / lonR;
          vertices.push(transformVertex([0.5 * Math.cos(ph) * sTh, 0.5 * cTh, 0.5 * Math.sin(ph) * sTh], p));
        }
      }
      for (let lat = 0; lat < latR; lat++) {
        for (let lon = 0; lon < lonR; lon++) {
          const f = lat * (lonR + 1) + lon;
          const s = f + lonR + 1;
          faces.push([f, s, s + 1, f + 1]);
        }
      }
      break;
    
    default: // Fallback a box si el tipo no es reconocido
      [[-0.5,-0.5,-0.5], [0.5,0.5,0.5]].forEach(v => vertices.push(transformVertex(v, p)));
      break;
  }
  return { vertices, faces };
}

export function exportToOBJ(model: ModelData): string {
  let obj = "# GeoImage Export - High Fidelity BIM Mesh\n";
  let vOffset = 1;
  model.primitives.forEach((p, i) => {
    obj += `\ng Pieza_${i+1}_${p.type}\n`;
    const { vertices, faces } = getPrimitiveGeometry(p);
    vertices.forEach(v => obj += `v ${v[0].toFixed(6)} ${v[1].toFixed(6)} ${v[2].toFixed(6)}\n`);
    faces.forEach(f => {
      if (f.length === 3) obj += `f ${f[0] + vOffset} ${f[1] + vOffset} ${f[2] + vOffset}\n`;
      else obj += `f ${f[0] + vOffset} ${f[1] + vOffset} ${f[2] + vOffset} ${f[3] + vOffset}\n`;
    });
    vOffset += vertices.length;
  });
  return obj;
}

export function exportToDXF(model: ModelData): string {
  // DXF R12 Header and Tables for Revit Compatibility
  let dxf = "0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n0\nENDSEC\n" + 
            "0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n10\n";
  
  // Definición de capas básicas
  model.primitives.forEach((_, idx) => {
    dxf += `0\nLAYER\n2\nPIEZA_${idx + 1}\n70\n64\n62\n7\n6\nCONTINUOUS\n`;
  });
  
  dxf += "0\nENDTAB\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n";
  
  model.primitives.forEach((p, idx) => {
    const layer = `PIEZA_${idx + 1}`;
    const color = hexToACI(p.color);
    const { vertices, faces } = getPrimitiveGeometry(p);
    
    faces.forEach(f => {
      const v1 = vertices[f[0]];
      const v2 = vertices[f[1]];
      const v3 = vertices[f[2]];
      const v4 = f.length > 3 ? vertices[f[3]] : undefined;
      dxf += create3DFace(v1, v2, v3, v4, layer, color);
    });
  });
  
  dxf += "0\nENDSEC\n0\nEOF\n";
  return dxf;
}

export function downloadFile(content: string, fileName: string, contentType: string) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
