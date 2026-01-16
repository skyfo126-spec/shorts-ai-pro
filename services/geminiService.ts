
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Scene, Language, ViralAssets, GroundingSource } from "../types";

export class GeminiService {
  // Generate a cinematic synopsis with 3-part structure
  async generateSynopsis(p: any): Promise<{ text: string, tokens: number }> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const seasoningPrompt = p.seasoning && p.seasoning.length > 0 
      ? `Add extra details focusing on the following elements: ${p.seasoning.join(', ')}` 
      : '';
    
    const prompt = `Create a high-impact cinematic synopsis for a short-form video.
      Topic: ${p.topic}
      Context: ${p.heroContext}
      Conflict: ${p.conflict}
      Twist: ${p.twist}
      Ending: ${p.ending}
      Genre: ${p.genre}
      Language: ${p.language}
      ${seasoningPrompt}
      
      IMPORTANT: Structure the response exactly into three sections: [서론], [본론], [결론].
      Each section should be 1-2 powerful sentences.`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt
    });
    
    return { text: response.text || '', tokens: 500 };
  }

  // Fact check the synopsis using Google Search
  async factCheckSynopsis(synopsis: string): Promise<{ text: string, sources: GroundingSource[] }> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Please fact-check the following story/synopsis. 
      Use Google Search to verify any names, dates, historical events, or real-world facts mentioned.
      If any facts are incorrect, rewrite the synopsis with corrected information while maintaining the [서론], [본론], [결론] structure.
      If the facts are correct, you can refine the expression but keep the content.
      
      Synopsis to check:
      ${synopsis}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const sources: GroundingSource[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks) {
      chunks.forEach((chunk: any) => {
        if (chunk.web) {
          sources.push({
            title: chunk.web.title || '출처',
            uri: chunk.web.uri
          });
        }
      });
    }

    return { 
      text: response.text || synopsis, 
      sources: sources.filter((v, i, a) => a.findIndex(t => t.uri === v.uri) === i) // Deduplicate
    };
  }

  // Create a detailed storyboard script with visual prompts
  async generateScript(synopsis: string, count: number, tone: string, lang: string, style: string): Promise<{ scenes: Partial<Scene>[], tokens: number }> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Create exactly ${count} detailed scenes for a video based on this synopsis: ${synopsis}
        Tone: ${tone}
        Language: ${lang}
        Visual Style: ${style}
        
        For each scene, provide:
        - title: Scene title
        - narration: Spoken text
        - visualPrompt: Detailed English image generation prompt incorporating the "${style}" style.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            scenes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  narration: { type: Type.STRING },
                  visualPrompt: { type: Type.STRING }
                },
                required: ["title", "narration", "visualPrompt"]
              }
            }
          },
          required: ["scenes"]
        }
      }
    });

    try {
      const data = JSON.parse(response.text || '{}');
      return { scenes: data.scenes || [], tokens: count * 300 };
    } catch (e) {
      return { scenes: [], tokens: 0 };
    }
  }

  // Expand the existing script for deeper emotional impact
  async expandScript(scenes: Scene[], targetLength: number, lang: string, tone: string): Promise<{ scenes: Scene[], tokens: number }> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Expand the following script to a total of approximately ${targetLength} characters. 
      The content should be emotionally amplified and highly detailed while maintaining the existing ${scenes.length} scene structure.
      Tone: ${tone}
      Language: ${lang}
      
      Input Scenes:
      ${scenes.map(s => `Scene ${s.id}: ${s.narration}`).join('\n')}
      
      Output ONLY the expanded narration for each scene as a JSON array of strings.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });

    try {
      const expandedTexts = JSON.parse(response.text || '[]');
      const updated = scenes.map((s, i) => ({ ...s, narration: expandedTexts[i] || s.narration }));
      return { scenes: updated, tokens: targetLength / 2 };
    } catch (e) {
      return { scenes, tokens: 0 };
    }
  }

  // Generate marketing assets like titles and hashtags
  async generateViralAssets(synopsis: string, lang: string): Promise<ViralAssets> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Based on this video synopsis: "${synopsis}", generate:
        1. 3 Click-baity viral titles in ${lang}.
        2. 3 High-curiosity thumbnail text hooks in ${lang}.
        3. Hashtags for Instagram, TikTok, and YouTube. IMPORTANT: Every single hashtag MUST start with the '#' character.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            titles: { type: Type.ARRAY, items: { type: Type.STRING } },
            thumbnailHooks: { type: Type.ARRAY, items: { type: Type.STRING } },
            hashtags: {
              type: Type.OBJECT,
              properties: {
                instagram: { type: Type.ARRAY, items: { type: Type.STRING } },
                tiktok: { type: Type.ARRAY, items: { type: Type.STRING } },
                youtube: { type: Type.ARRAY, items: { type: Type.STRING } }
              }
            }
          }
        }
      }
    });
    return JSON.parse(response.text || '{}');
  }

  // Generate an image based on a visual prompt
  async generateImage(prompt: string, ratio: string): Promise<string | null> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: prompt }] },
      config: { imageConfig: { aspectRatio: ratio as any } }
    });
    const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    return part ? `data:image/png;base64,${part.inlineData.data}` : null;
  }

  // Generate speech for narration using Gemini TTS
  async generateVoice(text: string): Promise<string | null> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } }
      }
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
  }

  // Generate a short video using Veo models
  async generateVideo(prompt: string, aspectRatio: string): Promise<string | null> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: prompt,
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: aspectRatio === '9:16' || aspectRatio === '16:9' ? aspectRatio : '16:9'
      }
    });

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (downloadLink) {
      const fetchResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
      if (!fetchResponse.ok) {
        throw new Error(`Failed to fetch video: ${fetchResponse.statusText}`);
      }
      const blob = await fetchResponse.blob();
      return URL.createObjectURL(blob);
    }
    
    return null;
  }
}
