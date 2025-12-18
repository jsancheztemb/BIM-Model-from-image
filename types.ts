
export enum PrimitiveType {
  BOX = 'BOX',
  CYLINDER = 'CYLINDER',
  PYRAMID = 'PYRAMID',
  SPHERE = 'SPHERE',
}

export interface Primitive {
  type: PrimitiveType;
  position: [number, number, number];
  rotation: [number, number, number]; // Radians
  scale: [number, number, number];
  color: string;
}

export interface ModelData {
  primitives: Primitive[];
  generationTime?: number;
}

export enum LOD {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export enum Unit {
  MM = 'mm',
  CM = 'cm',
  M = 'm',
  IN = 'in',
  FT = 'ft',
}

export interface LODConfig {
  maxPrimitives: number;
}

export interface AppState {
  images: string[];
  lod: LOD;
  lodConfigs: Record<LOD, LODConfig>;
  unit: Unit;
  model: ModelData | null;
  globalScale: number;
  isProcessing: boolean;
  error: string | null;
  notification: { message: string; type: 'success' | 'error' | 'info' } | null;
}
