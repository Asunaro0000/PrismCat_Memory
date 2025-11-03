document.addEventListener("DOMContentLoaded", () => {
  console.log("🎨 Album render initialized");

  // bodyにクラス追加（CSSを有効化）
  document.body.classList.add("album-contrast");

  // 各アルバムカードにclassを強制追加
  const albumCards = document.querySelectorAll(".album-card, .album-item, .phase-card");
  albumCards.forEach(card => {
    card.classList.add("album");
  });

  // タイトルのカラー変更を確認
  const titles = document.querySelectorAll(".album-title, .card-title, .phase-title");
  titles.forEach(title => {
    title.style.color = "#1a1a1a"; // ほぼ黒
    title.style.textShadow = "0 1px 3px rgba(255,255,255,0.4)";
    title.style.webkitTextStroke = "0.5px rgba(255,255,255,0.3)";
  });

  console.log(`✅ ${albumCards.length} album cards updated`);
});

