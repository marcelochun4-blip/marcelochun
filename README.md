# Zalo KO-VI Auto Translator

Zalo Web(`web.zalo.me`) 기반 **한국어 ↔ 베트남어 자동 번역 보조 도구**입니다.
LS전선 에너지본부 사업기획팀의 베트남 파트너 커뮤니케이션을 돕기 위해 개발되었습니다.

- **수신 (VI → KO):** 베트남어 메시지를 감지해 원문 아래에 한국어 번역을 오버레이로 표시
- **송신 (KO → VI):** 입력한 한국어를 베트남어로 번역·미리보기 → 확인/수정 후 입력창에 삽입 (전송은 직접 수행)
- **히스토리:** 모든 번역을 로컬 SQLite 에 저장하고 뷰어에서 조회·필터·CSV 내보내기·삭제

> 요구사항 정의서 v1.0 (2026-05-30) 기준 Phase 1(MVP) + Phase 2(히스토리) 구현.

---

## 구조

```
.
├── backend/                 # 로컬 Node.js 서버 (번역 프록시 + 히스토리 저장)
│   ├── server.js            # Express 진입점
│   ├── translate.js         # Google Translate API 래퍼 + 언어감지 + 캐시
│   ├── db.js                # SQLite 히스토리 저장소
│   ├── routes/              # /api/translate, /api/history
│   ├── test/                # 순수 로직 단위 테스트
│   └── .env.example         # 환경 변수 예시 (복사하여 .env 작성)
│
└── extension/               # Chrome 확장 (Manifest v3)
    ├── manifest.json
    ├── background.js        # 백엔드 중계 service worker
    ├── content/             # Zalo Web 주입 스크립트 (감지/오버레이/송신패널)
    │   ├── selectors.js     # ⚠️ Zalo DOM 선택자 (UI 변경 시 여기만 수정)
    │   ├── content.js       # 수신 번역 (MutationObserver → 오버레이)
    │   ├── compose.js       # 송신 번역 (KO→VI 미리보기 패널)
    │   └── overlay.css
    ├── popup/               # ON/OFF 토글 · 설정 · 상태표시
    ├── history/             # 히스토리 뷰어 페이지
    └── icons/
```

---

## 사전 준비: Google Cloud Translation API 키

1. [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트 생성
2. **Cloud Translation API** 사용 설정
3. **사용자 인증 정보 → API 키** 생성
4. (권장) API 키를 Translation API 로만 제한

> 무료 한도: 월 500,000자. 비용 절감을 위해 백엔드가 동일 문장 번역 결과를 캐싱합니다.

---

## 1) 백엔드 실행

```bash
cd backend
npm install

# 환경 변수 설정
cp .env.example .env
#  → .env 를 열어 GOOGLE_TRANSLATE_API_KEY 값을 채워 넣으세요.

npm start          # http://127.0.0.1:8787 에서 실행
# 개발 시: npm run dev (파일 변경 자동 반영)
```

실행 확인:

```bash
curl http://127.0.0.1:8787/api/health
# {"ok":true,"apiConfigured":true,"apiVersion":"v2","cacheSize":0}
```

### 환경 변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `GOOGLE_TRANSLATE_API_KEY` | Google Translation API 키 (**필수**) | — |
| `GOOGLE_TRANSLATE_API_VERSION` | `v2`(API 키) 또는 `v3` | `v2` |
| `GOOGLE_PROJECT_ID` | v3 사용 시 GCP 프로젝트 ID | — |
| `PORT` | 백엔드 포트 | `8787` |
| `TRANSLATION_CACHE_SIZE` | 번역 캐시 최대 항목 수 | `2000` |
| `DB_PATH` | SQLite DB 경로 | `./data/history.db` |

> **보안(NF-03/04/05):** API 키는 백엔드 `.env` 에만 저장되며 클라이언트에 노출되지 않습니다.
> 히스토리는 로컬 SQLite 에만 보관되고 외부로 전송되지 않습니다.
> Zalo 로그인 정보·세션 쿠키는 수집·저장하지 않습니다.

---

## 2) Chrome 확장 설치

1. Chrome 주소창에 `chrome://extensions` 입력
2. 우측 상단 **개발자 모드** 켜기
3. **압축해제된 확장 프로그램을 로드** 클릭 → `extension/` 폴더 선택
4. `web.zalo.me` 접속 후 로그인

확장 팝업(툴바 아이콘)에서:
- **자동 번역** ON/OFF 토글 (F-19)
- 송신 시 원문+번역 함께 삽입 옵션 (F-12)
- 백엔드 주소 설정 및 연결 상태 확인 (F-22)
- **번역 히스토리 열기** 버튼 (F-15)

---

## 사용법

### 수신 (VI → KO)
베트남어 메시지가 도착하면 원문 아래에 파란색 번역 말풍선이 자동으로 표시됩니다.
- 헤더의 `▼` 버튼으로 번역을 접거나 펼칠 수 있습니다 (F-04).
- 한국어 메시지는 번역 없이 그대로 둡니다 (F-06).
- 번역 실패 시 **재시도** 버튼이 나타납니다 (F-22).

### 송신 (KO → VI)
1. Zalo 입력창에 한국어를 입력합니다.
2. 우측 하단 **한→베 번역** 버튼을 클릭합니다.
3. 미리보기 패널에 베트남어 번역이 표시됩니다 — **직접 수정 가능** (F-09).
4. **입력창에 삽입** 클릭 → Zalo 입력창에 베트남어가 채워집니다 (F-10).
5. **Zalo 전송 버튼**으로 직접 보냅니다 (F-11, 자동 전송하지 않음).

### 히스토리
팝업에서 **번역 히스토리 열기** → 채팅방/방향/날짜/검색어로 필터(F-16),
CSV 내보내기(F-17, Excel 호환 BOM 포함), 단건/조건부 삭제(F-18)를 할 수 있습니다.

---

## 테스트

```bash
cd backend && npm test
```

API 호출 없이 검증 가능한 순수 로직(번역 방향 결정·엔티티 디코딩·캐시·히스토리 CRUD·중복방지·필터)을 검사합니다.

---

## Zalo UI 변경 대응 (NF-08)

Zalo Web 의 DOM 구조가 바뀌어 번역이 멈추면 **`extension/content/selectors.js`** 파일의
선택자 배열만 수정하면 됩니다. 모든 DOM 의존 지점을 이 파일에 모아 두었고,
각 항목은 여러 후보 선택자를 순차 시도하므로 일부 변경에는 자동으로 견딥니다.

---

## 제약 및 주의

- **Zalo 모바일 앱 미지원** — Zalo Web 전용입니다.
- **자동 전송 미구현** — Zalo 정책 위반 소지를 줄이기 위해 최종 전송은 항상 수동입니다.
- 선택자는 공개 구조 기준의 추정값이며, 실제 환경에서 DevTools 로 검증·보정이 필요할 수 있습니다.

---

## 라이선스

MIT
