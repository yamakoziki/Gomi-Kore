import { useState } from "react";
import type { SourceData } from "../types";

export function AboutFooter({ source }: { source: SourceData }) {
  const [open, setOpen] = useState(false);

  return (
    <footer className="about-footer">
      <button type="button" className="about-footer__toggle" onClick={() => setOpen((prev) => !prev)}>
        このアプリについて
      </button>
      {open && (
        <div className="about-footer__content">
          <p className="about-footer__disclaimer">
            本アプリの情報は参考情報です。最新・正確な収集日は必ず{source.municipalityName}の公式情報でご確認ください。本アプリは{source.municipalityName}
            の公式アプリ・サービスではありません（非公式の個人開発アプリです）。
          </p>
          <p>
            <a href={source.officialUrl} target="_blank" rel="noreferrer">
              {source.municipalityName}公式サイトのごみ収集日カレンダーを見る
            </a>
          </p>
          <h3>データ出典・ライセンス</h3>
          <p>{source.creditText}</p>
          <p>
            <a href={source.datasetUrl} target="_blank" rel="noreferrer">
              データセットページ（{source.datasetName}）
            </a>
          </p>
          <h3>プライバシー</h3>
          <p>
            選択した地区・表示設定は、この端末内（ブラウザのローカルストレージ）にのみ保存され、サーバーには送信されません。
          </p>
          <h3>利用規約・免責事項</h3>
          <p>
            ごみ出しの取りこぼし等、本アプリの情報に起因する不利益についてアプリ提供者は責任を負いかねます。あらかじめご了承ください。
          </p>
          <p className="about-footer__last-verified">データ最終確認日: {source.lastVerifiedAt}</p>
        </div>
      )}
    </footer>
  );
}
