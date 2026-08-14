# CLAUDE.md

このファイルは Claude Code がこのリポジトリで作業する際のガイドです。

## プロジェクト概要

**プロダクト名（仮）**: ごみコレ（Gomi-Kore）

**解決する課題**: 「今日のゴミは何？」を家族に聞かなくても、スマホを見れば自分で分かるようにする。

**ユーザー**:
- 主に家庭内でゴミ出し担当をしている人（プライマリユーザー：札幌市在住）
- 将来的には全国の自治体在住者
- 高齢者や忙しい人でも迷わない、シンプルなUIを重視

**動作環境**: iPhone / Android / タブレット（ブラウザ経由のPWAとして提供）

## 開発コマンド

```bash
npm run dev              # Vite dev server
npm run build             # tsc -b && vite build（型チェック含む）
npm run lint               # oxlint（.oxlintrc.json）
npm run test               # vitest run（全テスト1回実行）
npx vitest run <path>       # 単一テストファイルのみ実行（例: src/logic/date.test.ts）
npx vitest                   # watch モード
npm run preview             # ビルド成果物をローカルでプレビュー
npm run fetch:sapporo       # data/sapporo/calendar.json を CKAN API から再生成
npm run fetch:sapporo-dict  # data/sapporo/item-dictionary.json を「家庭ごみ50音分別辞典」ページから再生成
npm run fetch:otaru-dict    # data/otaru/item-dictionary.json を市の「分別区早見表」CSVから再生成
npm run fetch:otaru          # data/otaru/calendar.json を CSV から再生成
```

- CI（`.github/workflows/ci.yml`）は push/PR (main) で `lint` → `test` → `build` を実行する。
- `deploy.yml` は main への push で `test` → `build`（`GITHUB_PAGES=true`）→ GitHub Pages に公開する。
- `refresh-calendar.yml` / `refresh-otaru-calendar.yml` は週次スケジュールで対応する `fetch:*` スクリプトを実行し、差分があれば `data/{muni}/calendar.json` と `source.json` を自動コミットする。ebetsu 用の fetch スクリプトはまだ無く、`data/ebetsu/calendar.json` は手動更新。
- テストは vitest + happy-dom + `@testing-library/react`（セットアップ: `src/setupTests.ts`）。`virtual:pwa-register` は `src/test-mocks/virtual-pwa-register.ts` にエイリアスされる（`vitest.config.ts`）。

## アーキテクチャ概要（実装済み）

現時点で `sapporo` / `otaru` / `ebetsu` の3自治体が実装済み（下記「データソース戦略」に書かれているPhase 1〜3の設計方針はすでにコードに反映されている）。

- **アダプタとレジストリ**: `src/adapters/registry.ts` の `adapters: Record<string, AdapterModule>` が `sapporo.ts` / `otaru.ts` / `ebetsu.ts` を束ねる。各アダプタは `MUNICIPALITY_CODE`・`categoriesData`・`areaMappingData`・`sourceData`（すべて `data/{code}/*.json` を静的 import）と `loadCalendar(): Promise<LoadCalendarResult>` を export する、という共通シェイプを持つ。新しい自治体を追加する = `data/{code}/*.json` 一式 + `src/adapters/{code}.ts` + `registry.ts` への登録 + `data/municipalities.json` へのエントリ追加（後述の逆ジオコーディング解決用）。
- **`loadCalendar()` の3段フォールバック**: ネットワーク取得 → `localStorage`（キー `gomi-kore:{code}:calendar`）のキャッシュ → アプリにバンドルされた `calendar.json` スナップショット。札幌は CKAN の `datastore_search` JSON API、小樽は Shift_JIS の CSV を手書きパーサ（`otaru.ts` 内 `parseCsv`）で処理しており、どちらもブラウザからは CORS でブロックされる（確認済み）ため、実運用ではバンドル済みスナップショット（`scripts/fetch-{code}-calendar.mjs` で生成・コミット）を大半のユーザーが見ることになる。
- **自治体・地区の特定フロー**: `useGeolocation` → `src/adapters/geocode.ts` の `lookupMunicipalityCode(lat, lon)` が国土地理院の逆ジオコーダー（CORS許可済み・APIキー不要）を叩きJIS市区町村コード（例: `01101`）を取得 → `registry.ts` の `resolveMunicipalityCodeFromMuniCode()` が `data/municipalities.json` の `muniCodes` と照合して自治体コード（例: `sapporo`）に解決する。区・地区番号（collection-route単位の区分け）はデジタル境界データが存在しないため常に手動選択（`AreaSelector`）。
- **主要な型**（`src/types.ts`）: `CalendarData`/`CalendarDay`（日付 → `areaColumnName` → ごみ種別コードのマップ）、`CategoriesData`/`Category`（`feeType`、`scheduleType: "regular" | "on_request"`、任意の `subItem`/`contact`）、`AreaMappingData`/`AreaInfo`、`SourceData`（CKAN系フィールドとCSV系フィールドを自治体ごとに使い分ける）。
- **純粋ロジック層**（`src/logic/`、単体テスト必須）: `date.ts`（8時境界の日付計算）、`collection.ts`（`getCategoriesForDate` / `getNextCollectionDate` — `categories.json` に無い未知コードは例外を投げず「収集なし」として扱う）、`itemSearch.ts`（「これ何ゴミ？」のキーワード検索）。
- **App構成**（`src/App.tsx`）: トップの `App` が `localStorage`（キー `gomi-kore:municipalityCode`）で選択自治体を保持し、未選択なら `MunicipalitySelector` を表示。選択後は `MunicipalityApp` に `key={MUNICIPALITY_CODE}` を渡してマウントし直す（自治体切り替え時に地区選択などのローカル状態を確実にリセットするため）。`MunicipalityApp` はアダプタの `loadCalendar` 結果を `TodayPanel` / `ItemSearchPanel` / `AllCategoriesPanel` / `AboutFooter` に配る。
- **多言語**: `react-i18next` の辞書は `src/i18n/resources/{ja,en}.ts`、選択言語は `localStorage`（キー `gomi-kore:language`）に保存。UI文言はi18nextのkey経由だが、`data/*.json` 由来のごみ種別名・地区名などの `LocalizedText` は `src/i18n/localized.ts` の `pickLocalized(text, language)` で直接切り替える（i18next のリソースには入れない）。
- **PWA**: `vite-plugin-pwa`（`registerType: 'autoUpdate'`）。`vite.config.ts` の `base` は `GITHUB_PAGES` 環境変数で切り替わる（GitHub Pagesのプロジェクトページ配下 `/Gomi-Kore/` とローカル/他ホスティングのルート `/` を両立するため）。
- **品目辞書検索（「これ何ゴミ？」）**: `data/{code}/item-dictionary.json`（`ItemDictionaryData`）を持つ自治体（現状 sapporo・otaru）は `src/adapters/{code}.ts` がそれを `itemDictionaryData` として export し、`AdapterModule.itemDictionaryData`（未実装自治体向けにoptional。現状 ebetsu は未実装）経由で `ItemSearchPanel` に渡る。`src/logic/itemSearch.ts` の `searchItemDictionary()` が品目名を検索し、`categoryId`/`subItemId` を各自治体の `categories.json` の実データに解決するほか、calendar に乗らない特殊ケース（収集対象外など、`special` フィールド）も返す。辞書本文は日本語のみのデータなので、UI言語が日本語のときだけ使用し、英語表示時は既存の `categories.json` 内 `keywords`（和英併記）ベースの `searchCategories()` にフォールバックする。
  - `scripts/fetch-sapporo-item-dictionary.mjs`: 札幌市公式サイトの「家庭ごみ50音分別辞典」全文（1000件超）から生成。このページはCC-BYではなく札幌市の了解を得て複製している通常のサイトコンテンツのため、`SourceData.itemDictionaryCreditText`（CC-BYの `creditText` とは別フィールド）でクレジット表示する。
  - `scripts/fetch-otaru-item-dictionary.mjs`: 小樽市公式サイトの「ごみ・資源物分別区早見表」CSV（`source.json` の `itemDictionaryCsvUrl`、1000件超）から生成。この出典は既存の `creditText` に含まれているため、専用クレジットフィールドは不要。CSVの「収集しないごみ」ラベルはパソコン類と一般不可燃物の2カテゴリにまたがるため、`categories.json` の `pc_recycling.keywords` との突き合わせで振り分けている。
  - **他自治体での参考表示**: 独自の `itemDictionaryData` を持たない自治体（現状 ebetsu）では、`src/adapters/registry.ts` の `getReferenceItemDictionary(currentMunicipalityCode)` が「`itemDictionaryData` を持つ他自治体」を探し、あれば返す（自治体名をハードコードせず、`adapters` を走査するだけの実装。現状は実質的に Sapporo または Otaru のいずれかが該当）。`ItemSearchPanel` はこれを別枠（`.item-search-panel__reference`、破線ボーダー）で「参考: ○○市の分別区分」として表示し、実際の分別・手数料は自治体ごとに異なる旨の免責文言を必ず添える。あくまで補助情報であり、その自治体自身の `categories.json`（`searchCategories()`）による本来の検索結果を置き換えるものではない。ある自治体が自前の `itemDictionaryData` を持てば、この参考表示は（コード変更なしに）自動的に出なくなる。

## 技術スタックと理由

| 技術 | 用途 | 選定理由 |
|---|---|---|
| React + TypeScript + Vite | フロントエンド | 単一コードベースでiOS/Android/タブレットに対応。ネイティブアプリ審査不要 |
| PWA (Service Worker) | インストール可能化・オフライン対応 | ホーム画面追加でアプリ的に使える。ストア審査コスト回避 |
| Geolocation API | 位置情報取得 | ブラウザ標準、追加コスト無し |
| Web Speech API (SpeechSynthesis) | 音声読み上げ | 日本語含む多言語TTSが端末側で完結、無料 |
| react-i18next | 多言語対応 | UI文言・ゴミ種別名の翻訳を辞書ベースで管理 |
| IndexedDB / localForage | ローカルキャッシュ | 取得済みカレンダーをオフラインでも参照可能に |
| Vercel or GitHub Pages | ホスティング | 個人開発・OSS公開に適した無料枠 |

**採用しないもの**: ネイティブアプリ（Swift/Kotlin別実装）は開発コストが高く、個人+OSS運営に見合わないため見送り。将来必要になれば Capacitor 等でPWAをラップする選択肢を残す。

## データソース戦略（最重要・最難関）

### 前提

日本には自治体横断の「ゴミ収集日 全国統一API」は存在しない。自治体ごとにデータの持ち方・公開状況が異なる。全国対応を最初から作り込まず、自治体ごとにデータを追加できるプラガブルな設計にする。

### Phase 1: 札幌市（実装済みAPIあり）

札幌市は「DATA-SMART CITY SAPPORO」（さっぽろ産業振興財団運営、CKAN基盤）でオープンデータAPIを公開している。

- 提供元: https://ckan.pf-sapporo.jp/
- エンドポイント形式: `https://ckan.pf-sapporo.jp/api/3/action/datastore_search?resource_id={id}&limit=366`
- 主要リソース:
  - ごみ種別・番号対応表（番号とごみ種別名の対応）
  - 家庭ごみ収集日カレンダー（日付 × 地区 のテーブル。セルの値がごみ種別番号）
- resource_id は年度が変わると変化するため、年度更新の仕組みが必要（後述のデータ更新フローを参照）。`scripts/fetch-sapporo-calendar.mjs` は `package_show` APIでリソース一覧を取得し、リソース名（「収集日カレンダー」を含むもの）から現在有効なresource_idを自動検出する。手動での固定値更新は不要
- ライセンス: CC-BY 4.0。アプリ内に出典クレジット表示が必須
  - 例: 「本アプリのごみ収集データは、一般財団法人さっぽろ産業振興財団が提供するオープンデータ（CC-BY 4.0）を利用しています」
- **既知のデータ品質問題**: カレンダーCSVの一部セル（2025年12月〜2026年4月の散発的な日付・地区、計223セル/365日分）に、公式の「ごみ種別・番号対応表」に存在しない記号 `0` が入っている（生CSVで確認済み、API側のパース起因ではない）。意味は不明（冬季の枝・葉・草収集運休を示す可能性はあるが未確認）。アプリ側は未知コードを「収集なし」として安全側に倒して扱う（`src/logic/collection.ts` の `resolveCategoryByCode` 参照）。`fetch-sapporo-calendar.mjs` は毎回未知コードを検出すると警告を出すので、意味が判明したら `categories.json` に追記する

#### 住所→地区（エリアコード）の対応

カレンダーAPIの列名は「中央区①」のような地区コードであり、住所そのものではない。住所から地区コードへのマッピングは、札幌市公式サイトの「家庭ごみ収集日カレンダー」ページ（区ごとのPDF/一覧）を元に、初期データとして手動で整備し、`data/sapporo/area-mapping.json` のような形で保持する。

#### 既知の制約: ブラウザから直接APIを叩けない（CORS）

`ckan.pf-sapporo.jp` は `Access-Control-Allow-Origin` ヘッダーを返さないため、ブラウザの `fetch()` から直接叩くとCORSエラー（`Failed to fetch`）になる（`curl` 等サーバーサイドからのアクセスは問題なく成功する）。バックエンドを持たない個人開発・静的ホスティング（Vercel/GitHub Pages）という前提のため、以下の方式を採用する。

- `scripts/fetch-sapporo-calendar.mjs`（Node実行、CORS制約を受けない）でAPIを叩き、`data/sapporo/calendar.json` に静的スナップショットとして書き出す（`npm run fetch:sapporo` で再生成）。年度更新や定期更新はこのスクリプトを再実行してコミットする運用とする（将来的にはGitHub Actionsの定期実行での自動化も検討）。
- `src/adapters/sapporo.ts` の `loadCalendar()` は次の3段フォールバックで動作する: ①ブラウザからのライブ`fetch`を試みる（CORS許可されるAPIやプロキシ経由なら将来的に有効） → ②失敗時は`localStorage`の前回取得キャッシュ → ③それも無ければアプリにバンドルされた `calendar.json` スナップショットを表示する。この③が実質的に大半のユーザーが目にする経路になる。
- 他自治体アダプタを実装する際も、対象APIがCORS対応しているか事前に確認し、対応していなければ同様に「Node側で定期生成する静的スナップショット」方式を基本とする。

### Phase 2以降: 他自治体への拡張

- 参考にすべき先行事例: 5374.jp（Code for Kanazawa発、OSSでの全国横展開プロジェクト）。統一データ形式 `area_days.csv` を使い、各地域の有志が個別にデータを用意・展開している。1つのAPIに統合されているわけではなく、自治体ごとに個別データを持つ分散モデルである点を踏襲する。
- 本プロジェクトでも `data/{municipality_code}/` 配下に自治体ごとのデータディレクトリを作り、以下を持たせる設計とする:
  - `calendar.json`（収集日カレンダー本体、または外部APIへの参照設定）
  - `area-mapping.json`（住所→地区コード）
  - `categories.json`（ごみ種別マスタ・多言語ラベル）
  - `exceptions.json`（年末年始等の特例日）
  - `notices.json`（臨時のお知らせ・天候/災害影響情報。手動またはベストエフォートで自動取得）
  - `source.json`（データ出典・ライセンス・最終更新日）
- 自治体ごとにAPIの有無・形式が異なるため、`src/adapters/{municipality_code}.ts` のようなアダプタパターンで、データソースの違いを吸収する。
- コミュニティがPRでデータを追加できるよう、`CONTRIBUTING.md` にデータ追加手順を明記する（5374.jp運営ノウハウを参考にする）。

### データ未対応地域のフォールバック

対応自治体が見つからない場合は、位置情報の取得に失敗した扱いとせず、「この地域はまだ未対応です。手動で自治体を選択してください／情報提供のご協力をお願いします」という導線を出す（機能停止ではなくOSSへの貢献を促すUX）。

### 他の市区町村住民からの要望への対応方法

結論から言うと可能。すでに上記のアダプタパターン＋自治体ごとのデータディレクトリ構成が、この要望に応えるための土台になっている。想定する展開方法は2パターン。

**パターンA: 同一アプリ内に自治体を追加（推奨・基本形）**
- `data/{municipality_code}/` に新しい自治体のデータ（カレンダー・地区マッピング・出典情報等）を追加し、`src/adapters/{municipality_code}.ts` にその自治体のデータ取得ロジックを実装するだけで、UI・音声・多言語・法的表示などの共通機能はそのまま流用できる
- 追加してほしい自治体の住民が「うちの市はこういうデータ公開状況です」と情報提供→Issue/PRを作る、という流れを `CONTRIBUTING.md` にテンプレート化しておく（5374.jpのコミュニティ運営を参考にする）
- 自治体側にオープンデータAPIが無い場合は、PDF/カレンダー画像からの手動データ化が必要になる点は事前に伝える（工数がかかる旨をIssueテンプレートに明記）

**パターンB: 独立版としてフォーク（自治体色を強く出したい場合）**
- 5374.jpのように、地域コミュニティが「札幌版をベースに、うちの市の名前・ドメイン・デザインで独自展開したい」というケースもあり得る
- その場合は本リポジトリをGitHubの「テンプレートリポジトリ」として公開しておき、`data/sapporo/` と `src/adapters/sapporo.ts` を参考実装として残しつつ、フォーク先で自分の自治体用に差し替えてもらう
- 共通ロジック（`src/logic/`, `src/components/`, `src/i18n/`）はそのまま使えるため、フォーク後の作業はほぼ「データ層の入れ替え」で完結する

どちらを主軸にするかは、コントリビュータが増えてから判断すればよい。今の設計（アダプタ分離）を崩さずに実装を進めておけば、後からA/Bどちらの要望にも対応できる、という点が重要。

## 主要機能仕様

### 1. 位置情報 → 自治体・地区の特定
- Geolocation APIで緯度経度を取得（ユーザーの明示的な許可が必要）。位置情報がOFF/拒否/未対応の場合は、区・地区番号ともに手動選択にフォールバックする
- 逆ジオコーディングは国土地理院（GSI）のリバースジオコーディングAPI（`mreversegeocoder.gsi.go.jp`）を採用。無料・APIキー不要・`Access-Control-Allow-Origin: *` でブラウザから直接叩けることを確認済み（札幌市CKAN APIのようなCORS制約が無い）
- 取得できるのはJIS市区町村コード（例: 01101=中央区）までであり、これを`data/sapporo/area-mapping.json`の`wardMuniCodes`で「区」に変換して自動選択する
- 地区番号（例: 中央区①〜⑥）はごみ収集ルート独自の区分けで、境界を示す公式デジタルデータが存在しないため自動判定の対象外。区が自動/手動いずれかで決まった後、ユーザーが地区番号のみ手動選択する
- 一度特定した地区は端末にローカル保存し、毎回GPSを取らなくても良いようにする（設定画面から変更可能）

### 2. 当日/翌日判定ロジック
- 現在時刻が 0:00〜7:59 → 「今日」の収集情報を表示
- 現在時刻が 8:00〜23:59 → 「明日」の収集情報を表示
- 8時という境界は「収集は朝早く始まるため、それより前でないと今日のごみ出しに間に合わない」というユーザーからの指摘を反映したもの。境界値は将来的にも自治体の収集開始時刻に応じて調整できるよう、ハードコードせず設定値（`COLLECTION_CUTOFF_HOUR` のような定数）として持たせる
- 表示画面には対象日が「今日（8/5）」「明日（8/6）」と明確に分かるようにする（ロジックだけでなく表示上の誤解防止も重要）

### 3. 画面表示 / 音声読み上げ
- 設定で「表示のみ」「音声のみ」「両方」を選択可能に
- 音声読み上げ時も文字は画面に残す（アクセシビリティ、聞き逃し対策）
- 音声合成は `speechSynthesis` の `lang` を選択言語に連動させる

### 4. 品目タップ→次回収集日
- ゴミ種別ボタンをタップすると、その種別の直近の未来の収集日を計算して表示
- カレンダーデータと例外日（祝日・年末年始調整）を考慮したロジックを共通関数化する（例: `getNextCollectionDate(category, area, fromDate)`）

### 5. 多言語対応
- UI文言・ゴミ種別名を i18n 辞書化（最低: 日本語・英語。優先度に応じて中国語・韓国語・ロシア語などを追加。札幌市の外国語版カレンダーが中国語・韓国語・ロシア語対応であることも参考にする）
- 音声合成の言語も選択言語に合わせて切り替え

### 6. データ更新方式（自動/手動の選択）
- 設定画面で「自動更新」「手動更新」を選べるようにする
- 自動更新: アプリ起動時、または一定間隔（例: 1日1回）でバックグラウンド的に最新カレンダー・お知らせを取得。Service Workerでのバックグラウンド同期、または起動時フェッチ+キャッシュ比較で実現
- 手動更新: ユーザーが「更新」ボタンを押した時のみ通信する。データ通信量を抑えたい、オフライン環境が多いユーザー向け
- どちらのモードでも、取得に失敗した場合は直前のキャッシュを表示し、後述の最終更新日時を必ず併記する（情報が古い可能性をユーザーに伝えるため）

### 7. タイムリーな情報の表示

ユーザーからの要望に基づき、以下3種類を「お知らせ」領域として画面上部（メイン情報より目立つ位置）に表示する。

- データの最終更新日時: 「この情報は 2026/08/05 07:12 時点のものです」のように常に明示する。自動更新・手動更新いずれの場合も、取得成功時刻を保存し表示する
- 自治体からの臨時のお知らせ: 収集中止・変更などの告知。多くの自治体データには収集有無（null/0など）は含まれるが、「なぜ中止か」という理由文言までは無いことが多いため、`notices.json`（自治体ごと）に手動またはRSS/自治体お知らせページのスクレイピングで登録する仕組みを用意する。取得元が無い場合は空欄でよく、必須機能ではなくベストエフォートとする
- 天候・災害等による収集への影響情報: 大雪・台風・地震等で収集が遅延・中止されるケースがあるため、上記お知らせと同じ仕組み（`notices.json`）で扱う。気象庁等の警報APIとの自動連携は将来検討とし、MVPでは自治体お知らせの手動反映を基本とする

### 8. 有料ごみの扱い

札幌市をはじめ多くの自治体では「燃やせるごみ／燃やせないごみは指定有料ごみ袋を使用」「粗大ごみは個別申込＋シール購入が必要」など、ごみ種別ごとに有料/無料の別がある。これをアプリ上でも明確に区別する。

- `categories.json` にフィールドを追加
  - `feeType`: `"free" | "designated_bag"`（指定有料袋） | `"sticker_required"`（粗大ごみ等・申込制シール） など
  - `feeNote`: 「指定ごみ袋（有料）をご使用ください」等、自治体ごとの注意文言（多言語化対象）
- UI表示: ゴミ種別名の横に「有料」「無料」のバッジを表示する。有料の場合はタップでfeeNoteの詳細（購入場所の目安、料金体系へのリンク等）を表示する
- 粗大ごみ（大型ごみ）は通常の収集カレンダーと分離して扱う
  - 通常のごみ収集日カレンダーには乗らず、電話・Web申込で個別に収集日を指定する制度のため、`categories.json` 内で `scheduleType: "regular"` と `scheduleType: "on_request"` を区別する
  - `on_request` のカテゴリは「次回収集日」を計算せず、代わりに申込窓口（電話番号・申込サイトURL）への導線を表示する
- 他自治体対応時の注意: 有料/無料の制度自体が無い自治体（すべて無料回収）もあるため、`feeType` は自治体データ側で自由に定義でき、無ければ「無料」がデフォルトになるようにする

## 開発フェーズ（ロードマップ）

### Phase 1: 札幌市MVP
- 札幌市APIからのカレンダー取得・キャッシュ
- 住所→地区マッピング（手動データ）
- 当日/翌日判定・表示・音声読み上げ
- 品目タップ→次回収集日
- 日本語のみ

### Phase 2: 多言語・UX強化
- react-i18next導入、英語対応
- オフラインキャッシュ（Service Worker）
- PWAとしてホーム画面追加対応

### Phase 3: 拡張性の実装
- 自治体アダプタパターンの整備
- データディレクトリ構造の一般化
- 手動で自治体・地区を選択できるUI（GPSに頼らない経路）

### Phase 4: 他自治体追加・コミュニティ化
- 2〜3自治体を試験的に追加
- `CONTRIBUTING.md` 整備、データ追加テンプレート提供
- 多言語をさらに拡充

### Phase 5（将来検討）
- プッシュ通知（前日夜のリマインド）
- 家族間の設定共有
- カレンダーアプリ連携（iCal出力）
- ホーム画面ウィジェット（PWA制約があるためネイティブラッパー要検討）

## ディレクトリ構成（案）

```
/
├── src/
│   ├── components/        # UIコンポーネント
│   ├── adapters/          # 自治体ごとのデータ取得アダプタ
│   ├── logic/              # 当日/翌日判定、次回収集日計算などの純粋ロジック
│   ├── i18n/                # 多言語辞書
│   ├── hooks/              # 位置情報・音声合成などのカスタムフック
│   └── App.tsx
├── data/
│   └── sapporo/
│       ├── area-mapping.json
│       ├── categories.json
│       ├── exceptions.json
│       ├── notices.json
│       └── source.json
├── public/
├── CONTRIBUTING.md         # 他自治体データの追加方法
└── CLAUDE.md
```

## 非機能要件
- オフライン対応: 一度取得したカレンダーはローカルキャッシュから表示できること
- プライバシー: 位置情報は住所解決の目的のみに使用し、外部に送信する場合は最小限にする。生のGPS座標をそのままログに残さない
- アクセシビリティ: 文字サイズ・コントラストに配慮。音声読み上げと表示の併用を基本とする
- ライセンス遵守: 詳細は下記「法的表示要件」を参照

## 法的表示要件

個人開発・GitHub公開・行政オープンデータ利用という性質上、以下をアプリ内の「アプリについて／このアプリについて」画面（フッターやメニューから常時アクセス可能な場所）にすべて表示する。

- **データ出典・ライセンス表示（必須・CC-BY 4.0）**
  - 札幌市データ利用時の必須クレジット文言、例: 「本アプリのごみ収集データは、一般財団法人さっぽろ産業振興財団が提供するオープンデータ（DATA-SMART CITY SAPPORO、CC-BY 4.0）を利用しています」
  - 表示中の自治体に応じて動的に切り替える（`source.json` の内容をそのまま画面に描画する設計にし、自治体追加時にコード変更なしでクレジットが増えるようにする）
  - CC-BY 4.0の要件（出典表示のみで足りる）を満たしていることをコメントで明記しておく
- **データの正確性に関する免責事項**
  - 「本アプリの情報は参考情報です。最新・正確な収集日は必ず各自治体の公式情報でご確認ください」という趣旨の文言を必須表示
  - 各自治体の公式ページへのリンクを併記する（`source.json` に `official_url` フィールドを持たせる）
  - 本アプリが自治体の公式アプリ・サービスではないこと（非公式であること）を明記する
- **プライバシーポリシー**
  - 取得する情報（位置情報、選択言語、設定内容）とその利用目的
  - 外部送信の有無（逆ジオコーディングAPI等、外部サービスを使う場合はその送信先も明記）
  - データの保存場所（端末内ローカルのみで、サーバーには送信しない、等）
- **利用規約**
  - 免責事項（収集し忘れ等の不利益についてアプリ提供者は責任を負わない旨）
  - 非公式アプリである旨の再掲
- **OSSライセンス表示**
  - アプリ本体のライセンス（例: MIT等、リポジトリで採用するものを明記）
  - 利用しているOSSライブラリ一覧・ライセンス（React, react-i18next 等）。package.json から自動生成する仕組み（例: license-checker 等のツール）を検討する
- **第三者API・サービスの利用表記**
  - 逆ジオコーディングに外部サービスを使う場合、その利用規約・帰属表示要件を確認し記載する
  - 音声合成（Web Speech API）は端末OS機能利用のため通常追加表示は不要だが、方針として明記しておく

**実装メモ**: 上記1・2は自治体ごとに内容が変わるため `data/{municipality_code}/source.json` に集約し、UIはそれを描画するだけにする。3〜6はアプリ全体で共通のため `src/legal/` 配下に静的コンテンツとして持たせる。

## コーディング規約
- TypeScript strict モードを有効化
- 日付・ゴミ種別計算などのロジックはUIから分離し、`src/logic/` にテスト可能な純粋関数として実装する
- 自治体固有の処理は必ず `src/adapters/{municipality_code}.ts` に閉じ込め、UI層に自治体名をハードコードしない
- コミット・PRは日本語で問題なし。ただしOSS公開を想定し、コード内コメント・README・CONTRIBUTINGは英語/日本語併記を推奨

## テスト方針
- `logic/` 配下のロジック関数（当日/翌日判定、次回収集日計算、例外日処理）は単体テストを必須とする
- 自治体アダプタは、実データのモックを使った統合テストを用意する
- 8時境界・年末年始・祝日ずらしなど「日付エッジケース」を重点的にテストする

## 楽しく・ためになる機能アイデア

「毎日の家事を減らす」だけでなく「使うとちょっと嬉しい」体験を足すためのアイデア。優先度が高そうなものから記載。

- **「これ何ゴミ？」検索辞書**（実装済み・札幌市）: 品目名で検索すると分別区分が分かる機能。当初想定していた「`categories.json` の `keywords` を手動拡充する」方式に加え、札幌市の了解を得て公式の「家庭ごみ50音分別辞典」全文（1000件超）を実データとして取り込み済み（詳細は上記「アーキテクチャ概要」参照）。他自治体へ展開する場合は、各自治体に相当ページがあるかどうかと、複製の許諾を個別に確認する必要がある。
- **分別クイズ / ミニゲーム**: 「これは何ゴミ？」のクイズ形式。特に子どもがいる家庭で楽しく分別知識が身につく。上記の辞書データをそのままクイズの出題データとして再利用できるため実装コストが低い。
- **今日のエコ豆知識**: ごみ情報の横に「ペットボトルはラベルとキャップを外して出しましょう」のような小さな豆知識を1日1個表示。押し付けがましくない範囲で「ためになる」感を出す。多言語化・自治体差分どちらも影響が少なく、共通コンテンツとして持てる。
- **季節の特集案内**: 年末の大掃除シーズンに合わせた粗大ごみ案内、衣替え時期の古着回収案内など、時期に応じた案内をトップ画面に出す。上記「タイムリーな情報」の仕組み（`notices.json`）を流用できる。
- **「出しました」チェック機能（家族内シェア）**: ゴミを出したら軽くチェックを付けられるようにし、家族の誰かが見た時に「今日はもう出した」と分かるようにする。「聞かなくて済む」という本来の目的をさらに一歩進める機能で、通知や誇張された数値化を伴わないシンプルな実装にとどめる（過度なゲーミフィケーションで習慣を煽らないよう配慮）。

これらはPhase 4以降（コア機能安定後）に着手するのが妥当。1・2はデータ構造を共有できるため特にセットで実装効率が良い。

## 今後のアイデアバックログ
- プッシュ通知（前日リマインド）
- 家族・世帯での設定共有
- iCal/Googleカレンダー連携
- 対応自治体マップ（どこまで対応しているか可視化）
- 「この地域のデータをください」というコミュニティ協力導線
- ホーム画面ウィジェット（将来のネイティブラッパー化を検討）
- 上記「楽しく・ためになる機能アイデア」1〜5
