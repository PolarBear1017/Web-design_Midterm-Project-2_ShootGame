export const ComponentType = Object.freeze({
    IMAGE: "image",
    COLOR: "color"
});

export class Component {
    constructor(game, width, height, appearance, x, y, type) {
        this.game = game;
        this.width = width;
        this.height = height;
        this.x = x;
        this.y = y;
        this.speedX = 0;
        this.speedY = 0;
        this.type = type;   // color's type
        this.hit = false;   // 有沒有 crashWith other object

        if (type === ComponentType.IMAGE) {
            this.image = new Image();
            this.image.src = appearance;
        } else {
            this.color = appearance;
        }
    }

    update() {
        const ctx = this.game.context;
        if (this.type === ComponentType.IMAGE) {
            ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
        } else {
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
    }

    newPos() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.clampToCanvas();    // 預設會夾邊. 
    }

    clampToCanvas() {   // 限制移動不能超出 canvas 邊界。
        const maxX = this.game.canvas.width - this.width;
        const maxY = this.game.canvas.height - this.height;
        this.x = Math.max(0, Math.min(this.x, maxX));
        this.y = Math.max(0, Math.min(this.y, maxY));
    }

    crashWith(otherObject) {
        let myleft = this.x;
        let myright = this.x + (this.width);
        let mytop = this.y;
        let mybottom = this.y + (this.height);
        let otherleft = otherObject.x;
        let otherright = otherObject.x + (otherObject.width);
        let othertop = otherObject.y;
        let otherbottom = otherObject.y + (otherObject.height);

        let crash = true;
        if ((mybottom < othertop) ||
        (mytop > otherbottom) ||
        (myright < otherleft) ||
        (myleft > otherright)) {
            crash = false;
        }
        /*
        四種「完全分離」情況都不成立時才算碰撞:
        我的底邊不在對方上方 (mybottom < othertop 為假)
        我的頂邊不在對方下方 (mytop > otherbottom 為假)
        我的右邊不在對方左邊 (myright < otherleft 為假)
        我的左邊不在對方右邊 (myleft > otherright 為假)
        */
        return crash;
    }
}
