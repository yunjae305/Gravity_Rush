# Gravity Gem Rush

`Gravity Gem Rush`는 중력을 뒤집으며 장애물을 피하고 보석을 모으는 원버튼 아케이드 러너 게임입니다. Next.js와 Tailwind CSS로 제작되었고, 브라우저에서 바로 실행할 수 있습니다.

## 주요 특징

- 스페이스바, 엔터, 방향키, 클릭, 터치로 바로 조작 가능한 원버튼 플레이
- 장애물을 통과하고 보석을 모으며 점수를 쌓는 러너 게임 방식
- 최고 점수를 `localStorage`에 저장하는 기록 기능
- Vercel에 바로 배포할 수 있는 Next.js 프로젝트 구조

## 실행 방법

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`으로 접속하면 게임을 플레이할 수 있습니다.

## 조작 방법

- `Space`
- `Enter`
- `ArrowUp`
- `ArrowDown`
- 마우스 클릭
- 모바일 터치

위 입력 중 아무거나 사용하면 중력이 반전됩니다.

## 게임 목표

- 스파이크와 게이트 장애물을 피합니다.
- 보석을 모아 추가 점수를 획득합니다.
- 오래 버틸수록 속도가 빨라져 난도가 올라갑니다.

## 기술 스택

- Next.js 14
- React 18
- TypeScript
- Tailwind CSS

## 배포

Vercel을 사용하면 쉽게 배포할 수 있습니다.

```bash
npm install -g vercel
vercel
```

또는 GitHub 저장소를 연결한 뒤 Vercel에서 Import Project로 배포할 수 있습니다.
