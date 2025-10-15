window.addEventListener('DOMContentLoaded', () => {
  const select = document.getElementById('pairSelect');
  const board = document.getElementById('board');
  if (!select || !board) return;

  select.addEventListener('change', () => {
    const pairs = parseInt(select.value);
    board.innerHTML = ''; // 既存カード削除
    const cards = [];
    for (let i = 1; i <= pairs; i++) {
      cards.push(i, i);
    }
    cards.sort(() => Math.random() - 0.5);
    for (const n of cards) {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div class="inner">
          <div class="face front"></div>
          <div class="face back">
            <img src="../assets/image/phase1card${n}.webp" alt="">
          </div>
        </div>`;
      board.appendChild(card);
    }
  });
});
