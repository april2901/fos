[SE_Assignment2_G12.pdf](https://github.com/user-attachments/files/23809469/SE_Assignment2_G12.pdf)

Focus on Speaking App UI
========================

영어 스피킹 연습을 위한 웹 UI 프로젝트입니다.  
Figma에서 설계한 화면을 Vite + React 기반으로 구현한 브랜치입니다.

기술 스택
--------

- Vite  
- React  
- TypeScript  
- (선택) Tailwind CSS  
- Node.js 18 이상

폴더 구조
--------

- src/  
  - components/  : 공통 UI 컴포넌트  
  - pages/       : 페이지 단위 컴포넌트  
  - hooks/       : 커스텀 훅  
  - assets/      : 이미지, 아이콘 등 정적 리소스  
  - main.tsx     : 엔트리 포인트  
- index.html     : 루트 HTML 템플릿  
- package.json   : 의존성 및 스크립트 정의  
- vite.config.ts : Vite 설정  

(실제 구조와 다르면 진행하면서 수정하면 됩니다.)

로컬 실행 방법
-------------

1. 의존성 설치  

    npm install

2. 개발 서버 실행  

    npm run dev  

    터미널에 표시되는 주소 (예: http://localhost:5173)를 브라우저에서 열면 됩니다.

3. 프로덕션 빌드 및 미리보기  

    npm run build  
    npm run preview  

Figma 디자인 파일
-----------------

- Figma 링크: https://figma.com/...  
  (실제 링크로 교체해서 사용하세요.)

브랜치 정보
-----------

- 이 브랜치: fos2-ui  
- ai-assistant-for-presentation 레포의 다른 브랜치와 분리된 UI 전용 브랜치입니다.

TODO
----

- 주요 화면별 페이지 컴포넌트 분리 (홈, 연습, 통계 등)  
- 공통 레이아웃(Header, Sidebar, Footer) 컴포넌트화  
- 실제 API 연동용 서비스 레이어 추가  
- 상태 관리 도입 (예: React Query, Zustand 등)
