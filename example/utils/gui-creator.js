export function createSideMenuButton(iconSource, tooltipText, shortLabel){
  const button = document.createElement('button');
  button.classList.add('basic-button');

  if (tooltipText) {
    button.title = tooltipText;
    button.setAttribute('aria-label', tooltipText);
  }

  const image = document.createElement("img");
  image.setAttribute("src", iconSource);
  image.setAttribute('alt', tooltipText || '');
  image.classList.add('icon');
  button.appendChild(image);

  if (shortLabel) {
    button.classList.add('basic-button-with-label');
    const label = document.createElement('span');
    label.classList.add('side-menu-button-label');
    label.textContent = shortLabel;
    button.appendChild(label);
  }

  const sideMenu = document.getElementById('side-menu-left');
  sideMenu.appendChild(button);

  return button;
}