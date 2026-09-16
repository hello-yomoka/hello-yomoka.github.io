(() => {
  const images = document.querySelectorAll('.usage-step .usage-image');
  if (!images.length || typeof HTMLDialogElement === 'undefined') return;

  const dialog = document.createElement('dialog');
  dialog.className = 'usage-lightbox';
  dialog.id = 'usage-lightbox';
  dialog.setAttribute('aria-label', '説明画像の拡大表示');
  dialog.setAttribute('aria-modal', 'true');
  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'usage-lightbox-close';
  closeButton.setAttribute('aria-label', '拡大画像を閉じる');
  closeButton.textContent = '×';
  const enlarged = document.createElement('img');
  enlarged.className = 'usage-lightbox-image';
  dialog.append(closeButton, enlarged);
  document.body.append(dialog);

  let opener;
  let previousOverflow;
  function open(image) {
    opener = image;
    enlarged.src = image.currentSrc || image.src;
    enlarged.alt = image.alt;
    previousOverflow = document.documentElement.style.overflow;
    dialog.showModal();
    document.documentElement.style.overflow = 'hidden';
    closeButton.focus({ preventScroll: true });
  }
  // The image and its surrounding background both close the viewer.
  dialog.addEventListener('click', () => dialog.close());
  // Native modal dialog handles Escape and keeps focus inside the viewer.
  dialog.addEventListener('close', () => {
    document.documentElement.style.overflow = previousOverflow;
    opener?.focus({ preventScroll: true });
  });
  images.forEach(image => {
    image.tabIndex = 0;
    image.setAttribute('role', 'button');
    image.setAttribute('aria-label', `${image.alt}を拡大表示`);
    image.setAttribute('aria-haspopup', 'dialog');
    image.setAttribute('aria-controls', dialog.id);
    image.addEventListener('click', () => open(image));
    image.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open(image);
      }
    });
  });
})();