import { Component, ComponentType } from "./component.js";

export class Knife extends Component {
  constructor(game, width, height, appearance, x, y, type = ComponentType.COLOR) {
    super(game, width, height, appearance, x, y, type);
  }

  newPos() {
    this.x += this.speedX;
    this.y += this.speedY;
    // 不夾邊，讓它飛出去
  }
}
