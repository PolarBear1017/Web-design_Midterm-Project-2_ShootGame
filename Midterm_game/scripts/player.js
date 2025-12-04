import { Component, ComponentType } from "./component.js";

export class Player extends Component {
  constructor(game, width, height, imagePath, x, y) {
    super(game, width, height, imagePath, x, y, ComponentType.IMAGE);
  }

  updatePlayerSpeed(keys) {
    if (keys.ArrowLeft && !keys.ArrowRight) {
      this.speedX = -5;
    } else if (keys.ArrowRight && !keys.ArrowLeft) {
      this.speedX = 5;
    } else {
      this.speedX = 0;
    }
  }
}
