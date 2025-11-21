
# 프로젝트 문서

문서 전문은 아래 PDF에서 보실 수 있습니다:
[프로젝트 개요 PDF](SE_Assignment2_G12.pdf)
# FoS (Focus on Speaking)

LG Display 연동 실시간 회의 AI 프롬프터 프로젝트입니다.  
발표/회의 전·중·후 전 과정을 지원하는 실시간 텔레프롬프터 & 회의 보조 시스템을 구현합니다.<br><br>
**실제 서비스는 Vercel을 통해 배포되어 있으며, 아래 주소에서 이용이 가능합니다.**<br>
**[https://focusonspeaking.vercel.app/](https://focusonspeaking.vercel.app/)**

## 1. Project Overview

- 실시간 STT(Speech-to-Text) 기반 텔레프롬프터
- 스크립트-발화 동기화 및 유연한 매칭 (KoSentence-BERT + LLM)
- 키워드 누락 감지 및 실시간 스크립트 보완 제안
- 발표자 대시보드 (속도, 진행률, 감정/집중도 추정)
- 회의 모드:
  - 실시간 발언 의도 태깅 (아이디어, 결정, 액션 아이템, 질문 등)
  - 아젠다 맵 시각화
  - Decision / Action Item 위젯
  - Fact-check 위젯 (RAG / 웹 검색 기반)

자세한 시스템 요구사항과 설계는 `docs/fos_paper.tex` (IEEE LaTeX 논문) 파일에 정리되어 있습니다.

## 2. Tech Stack

- **Backend**: Python 3.11+, FastAPI, WebSocket
- **Frontend**: React 18, TypeScript, Web Audio API, TensorFlow.js
- **AI / ML**: Google Cloud STT, sentence-transformers, LLM(API)
- **Infra**: AWS (EC2, S3, RDS), GCP (STT, Vision API)

## 3. Repository Structure (예시)

- `frontend/` – React 기반 웹 클라이언트
- `backend/` – FastAPI 기반 서버 및 STT/LLM 연동
- `docs/` – 프로젝트 문서 및 LaTeX 논문 (`fos_paper.tex`)
- `README.md` – 현재 문서

## 4. Paper

- `docs/fos_paper.tex`: IEEE conference template 기반 프로젝트 논문
- PDF 빌드는 로컬 TeX 환경 또는 Overleaf에서 수행합니다.

[![PDF 썸네일](screenshot1.png)]
