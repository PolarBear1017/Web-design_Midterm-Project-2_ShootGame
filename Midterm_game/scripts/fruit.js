import { Component, ComponentType } from "./component.js";

export class Fruit extends Component {
  constructor(game, width, height, imagePath, x, y, speedY) {
    super(game, width, height, imagePath, x, y, ComponentType.IMAGE);
    this.speedY = speedY;
  }

  newPos() {
    this.y += this.speedY;
  }

  isOutOfBounds() {
    return this.y > this.game.canvas.height;
  }
}