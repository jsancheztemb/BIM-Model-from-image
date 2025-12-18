
import { ModelData, PrimitiveType } from '../types';

/**
 * Generates an OBJ file string.
 */
export function exportToOBJ(model: ModelData): string {
  let objContent = "# GeoSimplifier 3D Export for Revit/BIM\n";
  objContent += "# Scale based on user reference length\n";
  let vertexOffset = 1;

  model.primitives.forEach((p, idx) => {
    objContent += `g Primitive_${idx}_${p.type}\n`;
    
    const [px, py, pz] = p.position;
    const [sx, sy, sz] = p.scale;
    const [rx, ry, rz] = p.rotation;

    const addVertex = (x: number, y: number, z: number) => {
        let vx = x * sx;
        let vy = y * sy;
        let vz = z * sz;

        // Rx
        let vy1 = vy * Math.cos(rx) - vz * Math.sin(rx);
        let vz1 = vy * Math.sin(rx) + vz * Math.cos(rx);
        vy = vy1; vz = vz1;
        // Ry
        let vx2 = vx * Math.cos(ry) + vz * Math.sin(ry);
        let vz2 = -vx * Math.sin(ry) + vz * Math.cos(ry);
        vx = vx2; vz = vz2;
        // Rz
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
 * Generates a DXF file string using 3DFACE entities.
 */
export function exportToDXF(model: ModelData): string {
  let dxf = "0\nSECTION\n2\nENTITIES\n";

  model.primitives.forEach((p, idx) => {
    const [px, py, pz] = p.position;
    const [sx, sy, sz] = p.scale;
    const [rx, ry, rz] = p.rotation;

    const transform = (x: number, y: number, z: number) => {
      let vx = x * sx;
      let vy = y * sy;
      let vz = z * sz;

      // Rotation matrix applications
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
      [0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], 
      [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]
    ];

    faces.forEach(f => {
      dxf += "0\n3DFACE\n8\nPrimitives\n";
      f.forEach((vIdx, i) => {
        const v = verts[vIdx];
        dxf += `${10 + i}\n${v[0]}\n${20 + i}\n${v[1]}\n${30 + i}\n${v[2]}\n`;
      });
    });
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
