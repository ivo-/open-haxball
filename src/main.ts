import "./style.css";

import { GameController } from "./game";
import { UI } from "./ui";

(async () => {
  const controller = new GameController();
  await controller.init();

  new UI(controller);
})();
