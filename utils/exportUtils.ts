
import { ModelData, PrimitiveType } from '../types';

/**
 * Helper to convert Hex to ACI (AutoCAD Color Index)
 * A very simplified version for the most common colors
 */
function hexToACI(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  
  // Basic mapping to some standard ACI colors
  if (r > 200 && g < 100 && b < 100) return 1; // Red
  if (g > 200 && r < 100 && b < 100) return 3; // Green
  if (b > 200 && r < 100 && g < 100) return 5; // Blue
  if (r > 200 && g > 200 && b < 100) return 2; // Yellow
  if (r > 200 && b > 200 && g < 100) return 6; // Magenta
  if (g > 200 && b > 200 && r < 100) return 4; // Cyan
  return 7; // White/Black default
}

/**
 * Generates an OBJ file string.
 */
export function exportToOBJ(model: ModelData): string {
  let objContent = "# GeoImage Export\n";
  let vertexOffset = 1;

  model.primitives.forEach((p, idx) => {
    objContent += `g Primitive_${idx}_${p.type}\n`;
    const [px, py, pz] = p.position;
    const [sx, sy, sz] = p.scale;
    const [rx, ry, rz] = p.rotation;

    const addVertex = (x: number, y: number, z: number) => {
        let vx = x * sx; let vy = y * sy; let vz = z * sz;
        let vy1 = vy * Math.cos(rx) - vz * Math.sin(rx);
        let vz1 = vy * Math.sin(rx) + vz * Math.cos(rx);
        vy = vy1; vz = vz1;
        let vx2 = vx * Math.cos(ry) + vz * Math.sin(ry);
        let vz2 = -vx * Math.sin(ry) + vz * Math.cos(ry);
        vx = vx2; vz = vz2;
        let vx3 = vx * Math.cos(rz) - vy * Math.sin(rz);
        let vy3 = vx * Math.sin(rz) + vy * Math.cos(rz);
        vx = vx3; vy = vy3;
        objContent += `v ${vx + px} ${vy + py} ${vz + pz}\n`;
    };

    const verts = [
        [-0.5,-0.5,-0.5], [0.5,-0.5,-0.5], [0.5, 0.5,-0.5], [-0.5, 0.5,-0.5],
        [-0.5,-0.5, 0.5], [0.5,-0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]
    ];
    verts.forEach(v => addVertex(v[0], v[1], v[2]));
    objContent += `f ${vertexOffset} ${vertexOffset+1} ${vertexOffset+2} ${vertexOffset+3}\n`;
    objContent += `f ${vertexOffset+4} ${vertexOffset+7} ${vertexOffset+6} ${vertexOffset+5}\n`;
    objContent += `f ${vertexOffset} ${vertexOffset+4} ${vertexOffset+5} ${vertexOffset+1}\n`;
    objContent += `f ${vertexOffset+1} ${vertexOffset+5} ${vertexOffset+6} ${vertexOffset+2}\n`;
    objContent += `f ${vertexOffset+2} ${vertexOffset+6} ${vertexOffset+7} ${vertexOffset+3}\n`;
    objContent += `f ${vertexOffset+3} ${vertexOffset+7} ${vertexOffset+4} ${vertexOffset}\n`;
    vertexOffset += 8;
  });
  return objContent;
}

/**
 * Generates a high-quality DXF file for BIM workflows.
 * Uses Layers per object and Polyface Meshes for "solid-like" behavior in Revit.
 */
export function exportToDXF(model: ModelData): string {
  let dxf = "0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1015\n0\nENDSEC\n";
  
  // TABLES SECTION: Define layers for each primitive with their colors
  dxf += "0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n" + model.primitives.length + "\n";
  model.primitives.forEach((p, idx) => {
    const layerName = `GEO_PIEZA_${idx + 1}_${p.type}`;
    const aciColor = hexToACI(p.color || "#ffffff");
    dxf += "0\nLAYER\n2\n" + layerName + "\n70\n0\n62\n" + aciColor + "\n";
  });
  dxf += "0\nENDTAB\n0\nENDSEC\n";

  // ENTITIES SECTION
  dxf += "0\nSECTION\n2\nENTITIES\n";

  model.primitives.forEach((p, idx) => {
    const layerName = `GEO_PIEZA_${idx + 1}_${p.type}`;
    const [px, py, pz] = p.position;
    const [sx, sy, sz] = p.scale;
    const [rx, ry, rz] = p.rotation;

    const transform = (x: number, y: number, z: number) => {
      let vx = x * sx; let vy = y * sy; let vz = z * sz;
      let vy1 = vy * Math.cos(rx) - vz * Math.sin(rx);
      let vz1 = vy * Math.sin(rx) + vz * Math.cos(rx);
      vy = vy1; vz = vz1;
      let vx2 = vx * Math.cos(ry) + vz * Math.sin(ry);
      let vz2 = -vx * Math.sin(ry) + vz * Math.cos(ry);
      vx = vx2; vz = vz2;
      let vx3 = vx * Math.cos(rz) - vy * Math.sin(rz);
      let vy3 = vx * Math.sin(rz) + vy * Math.cos(rz);
      vx = vx3; vy = vy3;
      return [vx + px, vy + py, vz + pz];
    };

    const verts = [
      [-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5],
      [-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]
    ].map(v => transform(v[0], v[1], v[2]));

    const faces = [
      [1, 2, 3, 4], [8, 7, 6, 5], [1, 5, 6, 2], 
      [2, 6, 7, 3], [3, 7, 8, 4], [4, 8, 5, 1]
    ];

    // POLYFACE MESH (Standard non-ACIS "solid" object in DXF)
    dxf += "0\nPOLYLINE\n8\n" + layerName + "\n66\n1\n70\n64\n71\n8\n72\n6\n";
    
    // Add Vertices
    verts.forEach(v => {
      dxf += "0\nVERTEX\n8\n" + layerName + "\n10\n" + v[0] + "\n20\n" + v[1] + "\n30\n" + v[2] + "\n70\n192\n";
    });

    // Add Faces (Indices start at 1, negative means invisible edge)
    faces.forEach(f => {
      dxf += "0\nVERTEX\n8\n" + layerName + "\n10\n0\n20\n0\n30\n0\n70\n128\n71\n" + f[0] + "\n72\n" + f[1] + "\n73\n" + f[2] + "\n74\n" + f[3] + "\n";
    });

    dxf += "0\nSEQEND\n8\n" + layerName + "\n";
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
