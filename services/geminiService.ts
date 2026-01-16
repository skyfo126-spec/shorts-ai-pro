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
      Rewrite correctly if needed while maintaining the structure.
      
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
          sources.push({ title: chunk.web.title || '출처', uri: chunk.web.uri });
        }
      });
    }

    return { 
      text: response.text || synopsis, 
      sources: sources.filter((v, i, a) => a.findIndex(t => t.uri === v.uri) === i)
    };
  }

  // Create a detailed storyboard script with visual prompts
  async generateScript(synopsis: string, count: number, tone: string, lang: string, style: string): Promise<{ scenes: Partial<Scene>[], tokens: number }> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Create exactly ${count} detailed scenes for a video.
        Synopsis: ${synopsis}
        Tone: ${tone}
        Language: ${lang}
        Visual Style: ${style}
        
        Provide title, narration, and a detailed English visualPrompt for each scene.`,
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

  // Expand the existing script
  async expandScript(scenes: Scene[], targetLength: number, lang: string, tone: string): Promise<{ scenes: Scene[], tokens: number }> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Expand the narrations to reach ${targetLength} chars total. Maintaining ${scenes.length} scenes.
      Tone: ${tone}
      Language: ${lang}
      Input: ${scenes.map(s => `Scene ${s.id}: ${s.narration}`).join('\n')}`;

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

  // Viral marketing assets
  async generateViralAssets(synopsis: string, lang: string): Promise<ViralAssets> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate 3 titles, 3 hooks, and hashtags for: "${synopsis}" in ${lang}.`,
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

  // Image Generation
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

  // Voice Generation
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

  // ROBUST VIDEO GENERATION FOR VERCEL
  async generateVideo(prompt: string, aspectRatio: string): Promise<string | null> {
    // 1. 영상 생성 시작 직전에 최신 API 키로 인스턴스 생성
    const currentApiKey = process.env.API_KEY;
    if (!currentApiKey) throw new Error("API 키가 없습니다.");
    
    let ai = new GoogleGenAI({ apiKey: currentApiKey });
    let operation;

    try {
      operation = await ai.models.generateVideos({
        model: 'veo-2.0',
        prompt: prompt,
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: (aspectRatio === '9:16' || aspectRatio === '16:9') ? aspectRatio : '16:9'
        }
      });
    } catch (err: any) {
      console.error("Veo 초기 요청 실패:", err);
      throw err;
    }

    // 2. 폴링 루프 강화
    let pollCount = 0;
    const maxPolls = 100; // 약 15분 대기
    
    while (!operation.done && pollCount < maxPolls) {
      pollCount++;
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      try {
        // 매 폴링마다 키 업데이트를 보장하기 위해 새 인스턴스 사용
        const pollAi = new GoogleGenAI({ apiKey: process.env.API_KEY });
        operation = await pollAi.operations.getVideosOperation({ operation: operation });
        
        // 서버 측 에러 발생 시 즉시 중단
        if (operation.error) {
          throw new Error(`Veo 생성 에러: ${operation.error.message}`);
        }
      } catch (pollErr: any) {
        // 네트워크 일시 오류 등은 재시도, 권한 오류 등은 즉시 중단
        if (pollErr.message?.includes("Requested entity was not found")) throw pollErr;
        console.warn("폴링 재시도 중...", pollErr);
      }
    }

    if (!operation.done) throw new Error("영상 생성 대기 시간이 초과되었습니다.");

    // 3. 보안 인증된 다운로드
    const downloadUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (downloadUri) {
      const authUrl = `${downloadUri}${downloadUri.includes('?') ? '&' : '?'}key=${process.env.API_KEY}`;
      const response = await fetch(authUrl);
      if (!response.ok) throw new Error("영상 파일을 불러오는데 실패했습니다.");
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    }
    
    return null;
  }
}