
export interface Scene {
  id: number;
  title: string;
  narration: string;
  visualPrompt: string;
  imageUrl?: string;
  audioBlob?: string; // Base64 string
  videoUrl?: string;
  isGeneratingImage?: boolean;
  isGeneratingVoice?: boolean;
  isGeneratingVideo?: boolean;
  isGeneratingScript?: boolean;
}

export interface ViralAssets {
  titles: string[];
  thumbnailHooks: string[];
  hashtags: {
    instagram: string[];
    tiktok: string[];
    youtube: string[];
  };
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface Production {
  topic: string;
  heroContext: string;
  conflict: string;
  twist: string;
  ending: string;
  seasoning: string[];
  genre: string;
  language: string;
  tone: string;
  synopsis: string;
  scenes: Scene[];
  sceneCount: number;
  aspectRatio: string;
  style: string;
  viralAssets?: ViralAssets;
  groundingSources?: GroundingSource[];
  totalTokens: number;
}

export type GenerationStep = 'idle' | 'synopsis' | 'script' | 'complete';

export enum Language {
  KOREAN = '한국어',
  ENGLISH = '영어',
  JAPANESE = '일본어',
  SPANISH = '스페인어',
  PORTUGUESE = '포르투갈어',
  HINDI = '힌디어'
}

export enum AspectRatio {
  P9_16 = '9:16',
  P16_9 = '16:9',
  P1_1 = '1:1',
  P4_3 = '4:3',
  P3_4 = '3:4'
}
