export type Keyboard = {
  rightClicked: boolean;
  leftClicked: boolean;
  upClicked: boolean;
  downClicked: boolean;
  spaceClicked: boolean;
};

let callback: (data: Keyboard) => void = () => {};
export const onKeyboard = (cb: typeof callback) => {
  callback = cb;
};

export const getKeyboard = () => ({
  rightClicked,
  leftClicked,
  upClicked,
  downClicked,
  spaceClicked,
});

let rightClicked = false;
let leftClicked = false;
let upClicked = false;
let downClicked = false;
let spaceClicked = false;

export const initialKeyboard = {
  rightClicked,
  leftClicked,
  upClicked,
  downClicked,
  spaceClicked,
};

document.body.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") rightClicked = true;
  else if (e.key === "ArrowLeft") leftClicked = true;
  else if (e.key === "ArrowUp") upClicked = true;
  else if (e.key === "ArrowDown") downClicked = true;
  else if (e.key === " ") spaceClicked = true;
  else return;

  e.preventDefault();
  callback(getKeyboard());
});

document.body.addEventListener("keyup", (e) => {
  if (e.key === "ArrowRight") rightClicked = false;
  else if (e.key === "ArrowLeft") leftClicked = false;
  else if (e.key === "ArrowUp") upClicked = false;
  else if (e.key === "ArrowDown") downClicked = false;
  else if (e.key === " ") spaceClicked = false;
  else return;

  e.preventDefault();
  callback(getKeyboard());
});

export { rightClicked, leftClicked, upClicked, downClicked, spaceClicked };
