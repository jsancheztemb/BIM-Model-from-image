
import { GoogleGenAI, Type } from "@google/genai";
import { LOD, ModelData, PrimitiveType, Unit, LODConfig } from "../types";

const SYSTEM_INSTRUCTION = `
You are an expert 3D architectural modeler specialized in BIM and CAD software.
Your task is to analyze one or more images and decompose them into a set of SIMPLE 3D primitives (BOX, CYLINDER, PYRAMID, SPHERE).

INPUT HANDLING:
- You may receive photos of real objects OR technical drawings (floor plans, elevations, sections, side views).
- Technical drawings often contain "noise": text, dimension lines, annotations, grid lines, and title blocks.
- IGNORE ALL TEXT AND ANNOTATIONS. Focus solely on the geometric outlines and spatial relationships shown in the drawings.
- If multiple views are provided (e.g., a plan and an elevation), correlate them to build a single coherent 3D object.

MODELING RULES:
1. Represent the object using the EXACT number of primitives requested (LOD) or fewer while maintaining the core shape.
2. Provide precise relative positions (x, y, z), rotations (radians), and scales (relative units).
3. The output MUST be a JSON object containing an array of primitives.
4. SCALE RULE: Use the provided 'Reference Length' as the LARGEST dimension of the object. Calculate all 'position' and 'scale' values in the specified unit so the model has correct real-world dimensions for BIM software.
`;

export async function generate3DPrimitives(
  images: string[], 
  lod: LOD, 
  config: LODConfig,
  referenceLength: number, 
  unit: Unit
): Promise<ModelData> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const imageParts = images.map(base64 => ({
    inlineData: {
      data: base64.split(',')[1],
      mimeType: "image/jpeg"
    }
  }));

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: {
      parts: [
        ...imageParts,
        { 
          text: `Analyze the attached image(s) - which might be technical drawings (plans/elevations) or photos - and reconstruct the object into a 3D model.
          NOISE FILTERING: Ignore all texts, dimensions, and annotations.
          TARGET COMPLEXITY: Use a maximum of ${config.maxPrimitives} primitives for this ${lod} level.
          SCALING: The LARGEST dimension of this object is exactly ${referenceLength} ${unit}. 
          Please output all coordinates and scales in ${unit} accordingly.` 
        }
      ]
    },
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          primitives: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: {
                  type: Type.STRING,
                  enum: Object.values(PrimitiveType),
                  description: "The primitive shape type."
                },
                position: {
                  type: Type.ARRAY,
                  items: { type: Type.NUMBER },
                  description: "[x, y, z] coordinates in the specified unit."
                },
                rotation: {
                  type: Type.ARRAY,
                  items: { type: Type.NUMBER },
                  description: "[x, y, z] rotation in radians."
                },
                scale: {
                  type: Type.ARRAY,
                  items: { type: Type.NUMBER },
                  description: "[x, y, z] dimensions in the specified unit."
                },
                color: {
                  type: Type.STRING,
                  description: "Hex color representing the material or layer. For technical drawings, use standard CAD colors (grey/blue/black)."
                }
              },
              required: ["type", "position", "rotation", "scale", "color"]
            }
          }
        },
        required: ["primitives"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("Empty response from AI");
  
  try {
    const sanitizedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const data = JSON.parse(sanitizedText);
    
    if (!data.primitives || !Array.isArray(data.primitives)) {
      throw new Error("AI returned invalid structure");
    }

    return {
      ...data,
      generationTime: Date.now()
    } as ModelData;
  } catch (e) {
    console.error("Failed to parse AI response", text);
    throw new Error("Invalid model data received from AI. Check console for details.");
  }
}
