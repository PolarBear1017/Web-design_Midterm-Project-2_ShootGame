import { ComponentType } from "./component.js";
import { Knife } from "./knife.js";
import { Player } from "./player.js";
import { Fruit } from "./fruit.js";
import { Bomb } from "./bomb.js";
import { GameState } from "./gameState.js"

let game;

function prepareGame() {
    game = new Game("gameCanvas");
    game.start();
}

// export to window so onload in HTML can find it when using type="module"
window.prepareGame = prepareGame;

class Game {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.context = this.canvas.getContext("2d");
        this.keys = {};
        this.knives = [];
        this.player = new Player(this, 50, 80, "./assets/images/player/player.png", 350, 420);
        this.registerInput();

        // drop fruit
        this.fruits = [];
        this.baseFruitDropInterval = 1200; // 毫秒
        this.fruitDropInterval = this.baseFruitDropInterval;
        this.lastDropFuritTime = 0;
        this.fruitImages = [
            "./assets/images/fruits/apple.png",
            "./assets/images/fruits/Hami_melon.png",
            "./assets/images/fruits/watermelon.png",
            "./assets/images/fruits/peach.png",
        ];  // 相對路徑

        this.score = 0;
        this.live = 5;
        this.state = GameState.READY;
        this.speedMultiplier = 1;           // 全域掉落速度倍率
        this.minSpeedMultiplier = 0.5;
        this.maxSpeedMultiplier = 3;

        // drop bomb
        this.bombs = [];
        this.baseBombDropInterval = 3000;
        this.bombDropInterval = this.baseBombDropInterval;
        this.lastDropBombTime = 0;
        this.bombImage = "./assets/images/bomb/bomb.png";

        // start button clicked
        const startButton = document.getElementById("startButton");
        startButton.addEventListener('click', () => {
            this.state = GameState.PLAYING;
            this.score = 0;
            this.live = 5;
        });

        // pause button clicked
        const pauseButton = document.getElementById("pauseButton");
        pauseButton.addEventListener('click', () => {
            this.state = GameState.PAUSED;
        });

        // resetButton clicked
        const resetButton = document.getElementById("resetButton");
        resetButton.addEventListener('click', () => {
            this.reset();
        });

        // fasterButton clicked
        const fasterButton = document.getElementById("fasterButton");
        fasterButton.addEventListener('click', () => {
            this.adjustDropSpeed(0.2); // 每次加快 0.2 倍
        });

        // slowerbutton clicked
        const slowerbutton = document.getElementById("slowerbutton");
        slowerbutton.addEventListener('click', () => {
            this.adjustDropSpeed(-0.2); // 每次減慢 0.2 倍
        });
    }

    start() {
        this.canvas.width = 800;
        this.canvas.height = 500;
        this.interval = setInterval(() => this.update(), 20);    // 50 times per second
    }

    registerInput() {
        // 滑鼠操控 player
        this.canvas.addEventListener("mousemove", (event) => {
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;

            this.player.x = (event.clientX - rect.left - (this.player.width / 2)) * scaleX;
            this.player.clampToCanvas(); // 限制移動不能超出 canvas 邊界。
        });

        // 用鍵盤控制 player
        window.addEventListener("keydown", (event) => {
            const key = event.code || event.key;
            if (["ArrowLeft", "ArrowRight", "Space", " "].includes(key)) {
                event.preventDefault();
            }
            this.keys[key] = true;

            this.player.updatePlayerSpeed(this.keys);

            // 按下 space 發射 knife
            if ((key === "Space" || key === " " || event.key === "Spacebar") && !event.repeat) {
                this.shootKnife();
            }
        });

        // 在canvas中 按下 滑鼠左鍵 發射 knife
        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0) {   // 0 是左鍵
                this.shootKnife();
            }
        });

        // 放開鍵盤按鍵，更新玩家移動速度
        window.addEventListener("keyup", (event) => {
            const key = event.code || event.key;
            this.keys[key] = false;
            this.player.updatePlayerSpeed(this.keys);
        });
    }

    shootKnife() {
        const knifeWidth = 15;
        const knifeHeight = 32;
        const startX = this.player.x + this.player.width / 2 - knifeWidth / 2;
        const startY = this.player.y - knifeHeight; // 從玩家上方射出
        const knifeImage = "./assets/images/weapons/knife.png";
        const knife = new Knife(this, knifeWidth, knifeHeight, knifeImage, startX, startY, ComponentType.IMAGE);
        knife.speedY -= 8;  // 向上
        this.knives.push(knife);
    }

    update() {
        this.clear();

        this.player.newPos();
        this.player.update();

        // knife
        this.knives.forEach((knife) => {
            knife.newPos();
            knife.update();
        });
        this.knives = this.knives.filter((knife) => knife.y + knife.height > 0); // 留在畫面內的, 飛到畫面外會被移除 

        const isPlaying = this.state === GameState.PLAYING;

        // GameState.GAME_OVER 或 PAUSED 都不刷新/移動水果與炸彈，但要保持畫面
        if (isPlaying) {
            // fruit
            let now = performance.now();
            if (now - this.lastDropFuritTime > this.fruitDropInterval) {
                this.dropFruit();
                this.lastDropFuritTime = now;
            }
    
            this.fruits.forEach((f) => {
                f.newPos();
            });
            this.fruits = this.fruits.filter((f) => !f.isOutOfBounds());

            this.detectCrash(); // 判斷有沒有 Crash

            // bomb
            now = performance.now();
            if (now - this.lastDropBombTime > this.bombDropInterval) {
                this.dropBomb();
                this.lastDropBombTime = now;
            }

            this.bombs.forEach((b) => {
                b.newPos();
            })
            this.bombs = this.bombs.filter((b) => !b.isOutOfBounds());
        }

        // 總是繪製 (包括 PAUSED 狀態下仍保留畫面)
        this.fruits.forEach((f) => f.update());
        this.bombs.forEach((b) => b.update());
        
        // 顯示score、lives
        document.getElementById("scoreDisplay").textContent = `Score: ${this.score}`;
        document.getElementById("livesDisplay").textContent = `Lives: ${this.live}`;
        document.getElementById("stateDisplay").textContent = `State: ${this.state}`;
        document.getElementById("speedDisplay").textContent = `Speed factor: ${this.speedMultiplier.toFixed(1)}x`;  // 速度倍率顯示到小數點後一位
    }

    clear() {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // 調整掉落速度倍率，並套用到現有物件與刷新間隔
    adjustDropSpeed(delta) {
        const prevMultiplier = this.speedMultiplier;
        this.speedMultiplier = Math.min(
            this.maxSpeedMultiplier,
            Math.max(this.minSpeedMultiplier, this.speedMultiplier + delta)
        );
        const ratio = this.speedMultiplier / prevMultiplier;

        // 更新刷新間隔（倍率越高間隔越短）
        this.fruitDropInterval = this.baseFruitDropInterval / this.speedMultiplier;
        this.bombDropInterval = this.baseBombDropInterval / this.speedMultiplier;

        // 讓現有掉落物同步新速度
        this.fruits.forEach((f) => (f.speedY *= ratio));
        this.bombs.forEach((b) => (b.speedY *= ratio));
    }

    dropFruit() {
        const img = this.fruitImages[Math.floor(Math.random() * this.fruitImages.length)];
        const width = 40;
        const height = 40;
        const x = Math.random() * (this.canvas.width - width);
        const y = -height; // 從上方落下
        const speedY = (2 + Math.random() * 3) * this.speedMultiplier; // 2~5，隨倍率變化
        const fruit = new Fruit(this, width, height, img, x, y, speedY);
        this.fruits.push(fruit);
    }

    dropBomb() {
        const width = 40;
        const height = 40;
        const x = Math.random() * (this.canvas.width - width);
        const y = -height; // 從上方落下
        const speedY = (2 + Math.random() * 3) * this.speedMultiplier; // 2~5，隨倍率變化
        const bomb = new Bomb(this, width, height, this.bombImage, x, y, speedY);
        this.bombs.push(bomb);
    }

    detectCrash() {
        // knife crashWith fruit
        this.knives.forEach((knife) => {
            this.fruits.forEach((fruit) => {
                if (knife.crashWith(fruit)) {
                    fruit.hit = true;
                    knife.hit = true;

                    // 增加分數
                    this.score += 1;
                }
            });
        });
        // 清除撞到的刀子/水果 與 飛出畫面的刀子/水果
        this.knives = this.knives.filter((k) => !k.hit && k.y + k.height > 0);
        this.fruits = this.fruits.filter((f) => !f.hit && !f.isOutOfBounds());
        
        // knife crashWith bomb
        this.knives.forEach((knife) => {
            this.bombs.forEach((bomb) => {
                if (knife.crashWith(bomb)) {
                    bomb.hit = true;
                    knife.hit = true;
                    this.live = Math.max(0, this.live - 1); // 扣一命，避免負數
                    if (this.live <= 0) {   // Game Over
                        this.gameOver()
                    }
                }
            });
        });
        // 清除撞到的刀子/炸彈 與 飛出畫面的刀子/炸彈
        this.knives = this.knives.filter((k) => !k.hit && k.y + k.height > 0);
        this.bombs = this.bombs.filter((b) => !b.hit && !b.isOutOfBounds());

        // bomb crashWith floor
        this.bombs.forEach((bomb) => {
            const hitFloor = bomb.y + bomb.height >= this.canvas.height;
            if (hitFloor) {
                bomb.hit = true;
                this.live = Math.max(0, this.live - 1);
                if (this.live <= 0) this.gameOver();
            }
        });
        this.bombs = this.bombs.filter((b) => !b.hit && !b.isOutOfBounds());
    }

    // game over state
    gameOver() {
        this.state = GameState.GAME_OVER;
        // 若進入 game over，清空所有掉落物
        this.fruits = [];
        this.bombs = [];
    }
    reset() {
        this.state = GameState.READY;
        // 清空所有掉落物
        this.fruits = [];
        this.bombs = [];
    }
}
