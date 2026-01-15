
import { Language, AspectRatio } from './types';

export const LANGUAGES = [
  Language.KOREAN, Language.ENGLISH, Language.JAPANESE, 
  Language.SPANISH, Language.PORTUGUESE, Language.HINDI
];

export const GENRES = [
  "충격적인 막장 사연", "감동적인 황혼 연애", "눈물나는 인생 고백", "미스테리 추리극", 
  "손에 땀을 쥐는 스릴러", "속 시원한 사이다 복수극", "조선야담 (만담, 야담)", 
  "SF/판타지 세계관", "역사/시대극", "가슴 따뜻한 가족 이야기", "사연으로 배우는 인생명언", 
  "인생도전 (시니어 성공담)", "써프라이즈 On TV", "드라마 예고편", "영화 예고편", 
  "음모론", "실화 바탕 사건사고", "한국남 일본녀 운명 로맨스", "국뽕 드라마", 
  "연예계 뉴스 소식", "예능 줄거리 핵심 요약", "넷플릭스 드라마 줄거리 핵심 요약"
];

export const TONES = [
  "설명체 (~했습니다)", "친근체 (~했어요)", "소설체 (~했다)"
];

export const STYLES = [
  "실사", "3D 애니메이션", "인상주의 (Impressionism)", "큐비즘 (Cubism)", "리얼리즘 (Realism)", 
  "초현실주의 (Surrealism)", "종이 (Paper)", "표현주의 (Expressionism)", "미니멀리즘 (Minimalism)", 
  "풍경화와 자연화 (Landscape and Nature)", "픽셀 아트 (Pixel Art)", "만화와 코믹스 (Cartoon and Comics)", 
  "아르데코 (Art Deco)", "기하학적 및 프랙탈 아트 (Geometric and Fractal Art)", "팝 아트 (Pop Art)", 
  "르네상스 (Renaissance)", "SF 및 판타지 (Sci-Fi and Fantasy)", "초상화 (Portrait)", 
  "플랫 디자인 (Flat Design)", "아이소메트릭 (Isometric)", "수채화 (Watercolor)", "스케치 (Sketch)", 
  "빈센트 반 고흐 스타일 (Vincent van Gogh Style)", "클로드 모네 스타일 (Claude Monet Style)", 
  "파블로 피카소 스타일 (Pablo Picasso Style)", "살바도르 달리 스타일 (Salvador Dalí Style)", 
  "프리다 칼로 스타일 (Frida Kahlo Style)", 
  "일본 애니메이션 (Anime): 큰 눈, 생동감 있는 색상, 캐릭터 강조", 
  "서양 만화 (Western Comic): 굵은 선, 역동적인 구성", 
  "픽사/디즈니 스타일 (Pixar/Disney Style): 부드러운 3D CG 질감", 
  "지브리 스타일 (Ghibli Style): 서정적 배경, 동화적 분위기", 
  "카툰 (Cartoon): 단순화 및 과장된 표현", 
  "수채화/색연필 (Watercolor/Crayon): 부드러운 수작업 질감", 
  "점토 애니메이션 (Claymation): 점토 질감의 스톱모션 스타일", 
  "라인 아트 (Line Art): 간결한 선 위주의 스타일"
];

export const SEASONINGS = [
  { id: 'savory', label: '감칠맛 (핵심 감정/갈등)' },
  { id: 'spice', label: '향신료 (구체적인 설정/차별점)' },
  { id: 'flavor', label: '풍미 (콘텐츠의 가치)' }
];

export const DEFAULT_PRODUCTION = {
  topic: '',
  heroContext: '',
  conflict: '',
  twist: '',
  ending: '',
  seasoning: [],
  genre: GENRES[0],
  language: Language.KOREAN,
  tone: TONES[0],
  synopsis: '',
  scenes: [],
  sceneCount: 6,
  aspectRatio: AspectRatio.P9_16,
  style: STYLES[0],
  totalTokens: 0
};
