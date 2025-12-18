
import { GoogleGenAI, Type } from "@google/genai";
import { LOD, ModelData, PrimitiveType, Unit, LODConfig } from "../types";

const SYSTEM_INSTRUCTION = `
You are a expert 3D architectural modeler specialized in BIM and Revit.
Your task is to analyze one or more images of a complex geometric object and decompose it into a set of SIMPLE 3D primitives.
The primitives you can use are: BOX, CYLINDER, PYRAMID (a 4-sided cone), and SPHERE.

Rules:
1. Represent the object using the EXACT number of primitives requested or fewer while maintaining the core shape.
2. Provide precise relative positions (x, y, z), rotations (radians), and scales (relative units).
3. The output MUST be a JSON object containing an array of primitives.
4. If multiple images are provided, they represent different views of the SAME object.
5. SCALE RULE: You will be given a 'Reference Length' which corresponds to the LARGEST dimension of the object in a specific unit (cm or m). Ensure all 'position' and 'scale' values in the output are calculated in that unit so the resulting model has correct real-world dimensions.
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
          text: `Analyze the attached image(s) and decompose the object into a 3D model. 
          TARGET COMPLEXITY: Use a maximum of ${config.maxPrimitives} primitives for this ${lod} level representation.
          SCALING: The LARGEST dimension (length, width or height) of this object is exactly ${referenceLength} ${unit}. 
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
                  description: "Hex color representing the material in the image."
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
    // Sanitización robusta: eliminar posibles bloques de código markdown que la IA pueda colar
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
