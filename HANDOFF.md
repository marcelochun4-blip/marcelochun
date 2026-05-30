# 작업 인수인계 (HANDOFF)

> 이 문서는 다음 작업자(이하 "인수자")가 **Zalo KO-VI Auto Translator** 작업을 이어받기 위한 모든 정보를 담고 있습니다.
> 코드는 이미 구현·검증되어 브랜치에 푸시된 상태이며, 남은 일은 **실제 Zalo Web 화면 연동(선택자 보정)** 과 **API 키 입력** 두 가지입니다.

- **리포지토리:** `marcelochun4-blip/marcelochun`
- **작업 브랜치:** `claude/zalo-ko-vi-translator-Y7Oge`
- **기준 문서:** 요구사항 정의서 v1.0 (2026-05-30) — 기능 F-01~F-22, 비기능 NF-01~NF-08
- **구현 범위:** Phase 1 (MVP) + Phase 2 (히스토리)

---

## 1. 한 줄 요약

> 백엔드(번역 프록시 + SQLite 히스토리)와 Chrome 확장(수신 오버레이 / 송신 패널 / 팝업 / 히스토리 뷰어)은 **코드 레벨에서 완성·테스트 통과** 상태. **실제 Zalo 화면에 붙여 선택자를 맞추는 튜닝**과 **Google API 키 입력**만 하면 동작합니다.

---

## 2. 현재 상태 (✅ 완료 / ⚠️ 남음)

| 영역 | 상태 | 비고 |
|------|------|------|
| 백엔드 서버 (Express) | ✅ 실행·응답 검증 | `/api/health`, `/api/translate`, `/api/history` |
| 번역 로직 (v2/v3, 감지, 캐시) | ✅ 단위테스트 통과 | `backend/translate.js` |
| SQLite 히스토리 (CRUD·필터·CSV·중복방지) | ✅ 단위테스트 통과 | `backend/db.js` |
| 단위 테스트 | ✅ 11/11 통과 | `cd backend && npm test` |
| 확장 파일 (manifest·content·popup·history) | ✅ 문법검증·manifest 유효 | `node --check` 통과 |
| 아이콘 | ✅ 생성됨 | `extension/icons/*.png` |
| **Google API 키** | ⚠️ **미입력** | `backend/.env` 에 키 필요 |
| **Zalo DOM 선택자** | ⚠️ **추정값 → 실측 보정 필요** | `extension/content/selectors.js` |

---

## 3. 왜 선택자 보정이 남았나 (중요)

`extension/content/selectors.js` 의 선택자들은 **공개된 Zalo Web 구조 기준의 추정값**입니다. 실제 검증을 못 한 이유:

- 이전 작업 환경은 `web.zalo.me` 로 **아웃바운드 네트워크가 차단**(`ECONNREFUSED`)되어 접속 불가.
- Zalo 채팅 DOM(메시지 버블·입력창)은 **로그인 후에만 렌더링**되며, 자동화 도구로 사용자 계정에 로그인하는 것은 NF-05(로그인 정보 수집 금지)에 위배.
- Zalo Web 은 클래스명이 난독화(예: `._3xyz`)되어 있고 수시로 바뀜 → 공개 코드의 선택자도 현재 버전과 다를 수 있음.

**→ 인수자는 실제 `web.zalo.me` 에 로그인한 브라우저에서 DevTools 로 선택자를 확인해 `selectors.js` 만 수정하면 됩니다.** (이 파일 하나로 모든 DOM 의존성이 격리되어 있음 — NF-08 설계)

---

## 4. 리포지토리 구조

```
.
├── README.md                # 설치/실행/사용 안내 (먼저 읽을 것)
├── HANDOFF.md               # (이 문서)
├── .gitignore               # .env, data/, node_modules 제외
│
├── backend/                 # 로컬 Node.js 서버 (번역 프록시 + 히스토리)
│   ├── server.js            # Express 진입점, 포트 8787
│   ├── translate.js         # Google Translate v2/v3 래퍼 + 언어감지 + LRU 캐시
│   ├── db.js                # SQLite 히스토리 (better-sqlite3)
│   ├── routes/
│   │   ├── translate.js     # POST /api/translate
│   │   └── history.js       # GET /api/history, rooms, export.csv / DELETE / POST delete
│   ├── test/logic.test.js   # 순수 로직 단위테스트 11개
│   ├── .env.example         # 환경변수 예시 (→ .env 로 복사)
│   └── package.json
│
└── extension/               # Chrome 확장 (Manifest v3)
    ├── manifest.json
    ├── background.js        # content ↔ 백엔드 중계 service worker
    ├── content/
    │   ├── selectors.js     # ⚠️⚠️ 보정 대상: Zalo DOM 선택자 (여기만 수정)
    │   ├── api.js           # content → background 메시징 헬퍼
    │   ├── content.js       # 수신 VI→KO (MutationObserver → 오버레이)
    │   ├── compose.js       # 송신 KO→VI (미리보기 패널 → 입력창 삽입)
    │   └── overlay.css
    ├── popup/               # ON/OFF 토글·설정·상태표시
    ├── history/             # 히스토리 뷰어 페이지
    └── icons/               # make-icons.mjs 로 생성된 PNG
```

---

## 5. 동작 흐름 (데이터 플로우)

```
[Zalo Web DOM]
   │  content.js(MutationObserver)가 새 메시지 감지 / compose.js가 입력창 텍스트 읽음
   ▼
[content/api.js]  chrome.runtime.sendMessage({type:'TRANSLATE', payload})
   ▼
[background.js]   payload를 fetch로 백엔드에 POST
   ▼
[backend /api/translate]  Google Translate 호출(자동 언어감지) + 캐시 + 히스토리 저장
   ▼
응답 {translatedText, detectedSourceLanguage, target, direction, cached, historyId}
   ▼
[content.js] 원문 아래 오버레이 표시  /  [compose.js] 미리보기 패널 표시
```

- 번역 방향: 백엔드가 source 언어를 감지해 `ko` 이면 → `vi`(KO2VI), 그 외면 → `ko`(VI2KO). 송신 패널은 `target:'vi'` 를 명시해 강제.
- 히스토리는 번역 시점에 백엔드 SQLite 에 자동 기록(F-13). 뷰어는 `/api/history` 를 읽어 표시.

---

## 6. ⚠️ 남은 작업 ①: Zalo 선택자 보정 (메인 작업)

### 6.1 작업 파일
`extension/content/selectors.js` — `window.ZALO_SELECTORS` 객체의 각 key 는 **후보 선택자 배열**입니다. `queryFirst/queryAll/matches` 헬퍼가 배열을 순차 시도하므로, 정확한 선택자를 배열 맨 앞에 추가하면 됩니다.

### 6.2 채워야 할 선택자 목록

| key | 의미 | 어떻게 찾나 (DevTools) |
|-----|------|------------------------|
| `conversationContainers` | 새 메시지가 추가되는 대화 스크롤 영역 (MutationObserver 부착 대상) | 메시지 목록 전체를 감싸는 가장 가까운 컨테이너 |
| `messageItems` | 개별 메시지 버블(행) | 메시지 하나를 감싸는 반복 요소 |
| `messageText` | 버블 안의 텍스트 요소 | 실제 문장 텍스트가 들어있는 노드 |
| `senderName` | (그룹) 발신자 이름 | 그룹 채팅에서 이름 표시 노드 (F-14 기록용) |
| `outgoingMarker` | 내가 보낸 메시지 구분 표식 | "내 메시지" 버블에만 붙는 class (수신 번역 제외용) |
| `roomTitle` | 현재 채팅방 이름 | 상단 헤더의 방 이름 (F-14 기록용) |
| `inputBox` | 메시지 입력창 (KO→VI 삽입 대상) | `contenteditable` div 또는 textarea |

### 6.3 찾는 절차 (인수자 가이드)
1. `web.zalo.me` 로그인 → 아무 채팅방 열기
2. 메시지/입력창 우클릭 → **검사(Inspect)**
3. 해당 요소의 안정적인 식별자 확인. **난독화된 클래스(`._3xyz`)는 버전마다 바뀌므로 피하고**, 가능하면:
   - `id`, `role`, `data-*`, `aria-*`, `contenteditable` 같은 **의미 기반 속성** 우선
   - 부모-자식 구조 기반 선택자(예: `[role="row"] [dir="auto"]`)
4. 찾은 선택자를 해당 key 배열 **맨 앞**에 추가 (기존 추정값은 fallback 으로 남겨둠)
5. 저장 후 `chrome://extensions` 에서 확장 **새로고침** → Zalo 새로고침 → 동작 확인

### 6.4 검증 방법
- **수신:** 베트남어 메시지 아래에 파란 번역 말풍선이 뜨면 성공. 안 뜨면 DevTools Console 확인 + `messageItems`/`messageText` 점검.
- **송신:** 한국어 입력 → 우하단 "한→베 번역" 버튼 → 미리보기에 베트남어가 뜨고 "입력창에 삽입" 시 입력창이 채워지면 성공. 입력창이 안 채워지면 `inputBox` 점검 (특히 `compose.js` 의 `writeInput()` 이 contenteditable / textarea 분기 처리함 — Zalo 가 contenteditable 이면 input 이벤트 디스패치가 핵심).

### 6.5 디버깅 힌트
- content script 로그는 **Zalo 페이지의 DevTools Console** 에 찍힘(확장 팝업 아님).
- 처리된 메시지는 `data-zt-processed` 속성으로 마킹됨 → 재처리 방지. 테스트 중 강제 재처리하려면 이 속성을 지우면 됨.
- 그룹 채팅 다량 메시지는 300ms debounce + 처리 마킹으로 성능 보호(리스크 대응). 성능 이슈 시 `content.js` 의 debounce 값 조정.

---

## 7. ⚠️ 남은 작업 ②: Google API 키

1. Google Cloud Console → 프로젝트 생성 → **Cloud Translation API** 사용 설정 → API 키 발급
2. `backend/.env.example` 를 `backend/.env` 로 복사
3. `.env` 의 `GOOGLE_TRANSLATE_API_KEY` 에 키 입력
4. (v3 사용 시) `GOOGLE_TRANSLATE_API_VERSION=v3` + `GOOGLE_PROJECT_ID` 설정
5. **`.env` 는 절대 커밋 금지** (`.gitignore` 에 등록됨, NF-03)

> 무료 한도 월 500,000자. 백엔드가 (텍스트, 방향) 단위로 캐싱하여 호출량을 줄임.

---

## 8. 실행 & 검증 절차 (인수자용 체크리스트)

```bash
# 1) 백엔드
cd backend
npm install
cp .env.example .env        # → 키 입력
npm start                   # http://127.0.0.1:8787
npm test                    # 11개 테스트 통과 확인

# 2) 헬스체크
curl http://127.0.0.1:8787/api/health
#   apiConfigured: true 여야 실제 번역 가능

# 3) 번역 동작 확인 (키 입력 후)
curl -X POST http://127.0.0.1:8787/api/translate \
  -H 'Content-Type: application/json' \
  -d '{"text":"xin chào"}'
#   → {"translatedText":"안녕하세요", "target":"ko", "direction":"VI2KO", ...}

# 4) 확장 로드
#   chrome://extensions → 개발자 모드 ON → "압축해제된 확장 프로그램 로드" → extension/ 선택
#   web.zalo.me 접속 후 동작 확인 (→ 6.4 검증)
```

---

## 9. API 계약 (참고)

### POST `/api/translate`
```jsonc
// 요청
{ "text": "원문", "target": "vi", "room": "방이름", "sender": "발신자", "save": true }
// target 생략 시 자동 방향 결정. save 기본 true.

// 응답
{ "translatedText": "...", "detectedSourceLanguage": "vi",
  "target": "ko", "direction": "VI2KO", "cached": false, "historyId": 12 }
```

### GET `/api/history?room=&direction=&from=&to=&q=&limit=&offset=`
→ `{ rows:[...], total, limit, offset }`

기타: `GET /api/history/rooms`, `GET /api/history/export.csv?...`(BOM 포함), `DELETE /api/history/:id`, `POST /api/history/delete`(조건 일괄), `GET /api/health`.

---

## 10. 요구사항 추적 (어느 파일이 무엇을 담당하나)

| 요구사항 | 구현 위치 |
|----------|-----------|
| F-01 언어 자동감지 | `backend/translate.js` (`_detectV2/V3`) |
| F-02 VI→KO 번역 | `backend/translate.js`, `routes/translate.js` |
| F-03 원문 아래 오버레이 | `content/content.js` (`buildOverlay`), `overlay.css` |
| F-04 메시지별 접기/펼치기 | `content/content.js` (`.zt-toggle`) |
| F-05 그룹 전체 적용 | `content/content.js` (`scanAll`, 컨테이너 옵저버) |
| F-06 한국어 원문 유지 | `content/content.js` (target=='vi'/감지=='ko' 시 오버레이 제거) |
| F-07~F-12 송신 KO→VI | `content/compose.js` |
| F-13~F-18 히스토리 | `backend/db.js`, `routes/history.js`, `extension/history/*` |
| F-19 ON/OFF 토글 | `extension/popup/*` |
| F-20 비침습 디자인 | `overlay.css` (zt- 접두사, 최소 침습) |
| F-21 로딩 인디케이터 | `overlay.css` (`.zt-spinner`) |
| F-22 오류+재시도 | `content/content.js` (`renderError`), popup 상태표시 |
| NF-03 키 서버 전용 | `backend/.env`, content 는 키 미취급 |
| NF-04 로컬 저장 | `backend/db.js` (로컬 SQLite, 외부 전송 없음) |
| NF-05 로그인정보 미수집 | 쿠키/세션 접근 코드 없음 |
| NF-08 UI 변경 대응 | `content/selectors.js` (선택자 외부화 + 다중 후보) |

---

## 11. 알려진 한계 / 주의

- **Zalo 모바일 앱 미지원** (Web 전용).
- **자동 전송 미구현** (Zalo 정책 리스크 회피 — 최종 전송은 항상 수동, F-11).
- 선택자는 추정값 → **실측 보정 필수** (§6).
- `compose.js` 의 송신 버튼/패널은 `position: fixed` 로 화면 우하단에 띄움. Zalo 레이아웃과 겹치면 `overlay.css` 의 `.zt-translate-btn` / `.zt-compose` 위치 조정.
- `compose.js` 의 패널 삽입 위치(`inputEl.closest('div')...`)는 Zalo 구조에 따라 안 맞을 수 있음 → fallback 으로 `document.body` 에 붙음. 보기 좋게 하려면 입력영역 컨테이너에 맞춰 조정.

---

## 12. 인수자 To-Do (우선순위 순)

1. **[필수]** `backend/.env` 에 Google API 키 입력 → `npm start` → `/api/health` 로 `apiConfigured:true` 확인 (§7, §8)
2. **[필수]** `web.zalo.me` 실측으로 `extension/content/selectors.js` 7개 key 보정 (§6)
3. **[필수]** 수신/송신 동작 확인 (§6.4)
4. **[권장]** 그룹 채팅에서 발신자 이름·방 이름이 히스토리에 잘 기록되는지 확인 (`senderName`, `roomTitle` 보정)
5. **[권장]** 송신 패널/버튼 위치를 Zalo 레이아웃에 맞게 CSS 미세조정
6. **[선택]** Phase 3 고도화(발신자 매핑, 원문+번역 동시 전송 다듬기, 단축어) 검토

---

*문의/원본 맥락: README.md 와 요구사항 정의서 v1.0 참고.*
