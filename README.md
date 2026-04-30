# Lucky Survivor

`Lucky Survivor`는 `뱀파이어 서바이벌`식 이동 생존과 `운빨존망겜`식 확률 뽑기, 자동 합성을 섞은 브라우저 프로토타입입니다. 적을 피하며 코인을 모으고, 무기를 뽑아 전투력을 폭발시키는 흐름을 Next.js와 Canvas 기반으로 빠르게 검증하는 데 초점을 맞췄습니다.

## 핵심 루프

- 적을 처치해 코인을 모읍니다.
- `Space`로 코인을 소비해 무기를 소환합니다.
- 같은 종류와 같은 등급의 무기 2개가 모이면 즉시 상위 등급으로 합성됩니다.
- 아주 낮은 확률로 `신화` 직출이나 `조커`가 등장해 판을 뒤집습니다.

## 현재 프로토타입에 들어간 요소

- 자유 이동 기반 생존 전투
- 적 추적 AI와 코인 드랍
- `Orb`, `Bolt`, `Saw` 자동 공격 무기
- 확률형 무기 소환
- 조커 합성과 신화 등급
- 최근 뽑기와 합성 로그 UI
- 최고 생존 시간 저장

## 조작

- 이동: `WASD` 또는 방향키
- 시작/재시작: `Enter` 또는 캔버스 클릭
- 소환: `Space`

## 실행 방법

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`으로 접속하면 바로 플레이할 수 있습니다.

## 테스트와 빌드

```bash
npm test
npm run build
```

- `npm test`: 가챠 결과와 자동 합성 규칙을 검증합니다.
- `npm run build`: Next.js 프로덕션 빌드와 타입 검사를 함께 확인합니다.

## 기술 스택

- Next.js 14
- React 18
- TypeScript
- Tailwind CSS

## 배포

Vercel에 바로 배포할 수 있는 구조입니다.

```bash
npm install -g vercel
vercel
```
