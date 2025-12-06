import { Component, ComponentType } from "./component.js";
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
        this.playerImages = {
            idle: "./assets/images/player/player.png",
            attack: "./assets/images/player/player_attack.png",
            hurt: "./assets/images/player/player_hurt.png",
        };
        this.player = new Player(this, 50, 80, this.playerImages.idle, 350, 420);
        this.playerImageResetTimeout = null;
        this.registerInput();   // 鍵盤滑鼠操控事件

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

        // 隨時間增加遊戲難度
        this.difficultyTickMs = 5000;       // 每 5 秒提升一次難度
        this.difficultyStep = 0.1;          // 每次提升多少倍率
        this.lastDifficultyAt = 0;
        this.startTime = null;
        this.backgroundImage = new Image();
        this.backgroundImage.src = "./assets/images/background/snowfield.png";
        this.backgroundLoaded = false;
        this.backgroundAlpha = 0.8;         // 背景透明度（0~1）
        this.backgroundImage.onload = () => {   // 表示當圖片資源成功載入時，執行箭頭函式. 這樣在 update() 裡可以先判斷 backgroundLoaded 再 drawImage，避免圖片還沒載好時繪製出錯或閃爍。
            this.backgroundLoaded = true;
        };
        this.snowflakes = [];   // 雪花 array

        // drop bomb
        this.bombs = [];
        this.baseBombDropInterval = 3000;
        this.bombDropInterval = this.baseBombDropInterval;
        this.lastDropBombTime = 0;
        this.bombImage = "./assets/images/bomb/bomb.png";
        this.bombExplosionImage = "./assets/images/bomb/bomb_explosion.png";
        this.explosions = [];   // 炸彈爆炸效果

        // start button clicked
        const startButton = document.getElementById("startButton");
        startButton.addEventListener('click', () => {
            this.state = GameState.PLAYING;
            this.score = 0;
            this.live = 5;
            this.resetDifficulty();
            this.startTime = performance.now();
            this.lastDifficultyAt = this.startTime;
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
        this.snowflakes = this.createSnow(80); // 先設定好 canvas 尺寸，再生成雪花，避免初始只落在左側 (this.canvas.width 是預設值（約 300）)
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
        this.setPlayerImage(this.playerImages.attack, 200);
        this.knives.push(knife);
    }

    update() {
        this.clear();
        if (this.backgroundLoaded) {
            this.context.save();    // context.save() / restore()：暫存並還原畫布狀態，避免接下來的設定影響其他繪製。
            this.context.globalAlpha = this.backgroundAlpha;    // 設定全局透明度（0~1），讓背景以指定透明度畫出。
            this.context.drawImage(this.backgroundImage, 0, 0, this.canvas.width, this.canvas.height);
            this.context.restore();
        }
        this.updateSnow();

        this.player.newPos();
        this.player.update();

        // knife
        this.knives.forEach((knife) => {
            knife.newPos();
            knife.update();
        });
        this.knives = this.knives.filter((knife) => knife.y + knife.height > 0); // 留在畫面內的, 飛到畫面外會被移除 

        const isPlaying = this.state === GameState.PLAYING;

        // 除了playing的state 其他都不刷新/移動水果與炸彈，但要保持畫面
        if (isPlaying) {
            this.maybeScaleDifficulty();

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
        const now = performance.now();
        this.explosions = this.explosions.filter((exp) => { // filter 會檢查每個爆炸物件的 expiresAt；時間到了 (now >= exp.expiresAt) 就回傳 false 把它移除。
            if (now >= exp.expiresAt) {
                return false;
            }
            exp.component.update();
            return true;
        });
        
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

    // 重置倍率與刷新間隔，用於重新開始或重置遊戲
    resetDifficulty() {
        this.speedMultiplier = 1;
        this.fruitDropInterval = this.baseFruitDropInterval;
        this.bombDropInterval = this.baseBombDropInterval;
    }

    addExplosion(x, y, width, height, durationMs = 500) {
        const explosion = new Component(this, width, height, this.bombExplosionImage, x, y, ComponentType.IMAGE);
        this.explosions.push({
            component: explosion,
            expiresAt: performance.now() + durationMs,
        });
    }

    // 用來把玩家角色換成指定圖片 imagePath，可選擇在指定毫秒後自動換回預設 idle 圖。
    setPlayerImage(imagePath, durationMs = null) {
        this.player.setImage(imagePath);
        if (this.playerImageResetTimeout) { // 換圖後會檢查是否已有等待恢復的計時器 (playerImageResetTimeout)，如果有就先清掉，避免舊的計時器把新狀態又改回去。
            clearTimeout(this.playerImageResetTimeout);
            this.playerImageResetTimeout = null;
        }
        if (durationMs !== null) {  // 如果呼叫時有給 durationMs（例如 200 或 500），就設定一個 setTimeout 在時間到時把圖片改回 this.playerImages.idle，並清除計時器記錄；若 durationMs 是 null，就只換圖不自動恢復。
            this.playerImageResetTimeout = setTimeout(() => {
                this.player.setImage(this.playerImages.idle);
                this.playerImageResetTimeout = null;
            }, durationMs);
        }
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

    // 依經過時間提升難度（加快掉落倍率與生成頻率）
    maybeScaleDifficulty() {
        if (this.speedMultiplier >= this.maxSpeedMultiplier) {
            return;
        }
        const now = performance.now();
        if (now - this.lastDifficultyAt < this.difficultyTickMs) {
            return;
        }
        this.lastDifficultyAt = now;
        this.adjustDropSpeed(this.difficultyStep);
    }

    // 生成初始雪花陣列
    createSnow(count) {
        const flakes = [];
        for (let i = 0; i < count; i += 1) {
            flakes.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                radius: 1 + Math.random() * 2,
                speedY: 0.5 + Math.random() * 1.5,
                drift: (Math.random() - 0.5) * 0.5, // 設定雪花水平飄移的隨機值, -0.25 ~ 0.25。負值就向左飄，正值向右飄。
            });
        }
        return flakes;
    }

    // 更新並繪製雪花；不受 gameState 影響，持續下雪
    updateSnow() {
        this.context.save();    // context.save() / restore()：暫存並還原畫布狀態，避免接下來的設定影響其他繪製。
        this.context.fillStyle = "rgba(255, 255, 255, 0.8)";
        this.snowflakes.forEach((flake) => {
            flake.y += flake.speedY;
            flake.x += flake.drift;
            if (flake.y > this.canvas.height) { // 越界後從上方隨機位置重新落下。
                flake.y = -flake.radius;
                flake.x = Math.random() * this.canvas.width;
            }
            if (flake.x < 0) flake.x = this.canvas.width;   // 飄到最左邊，再從最右邊出現繼續飄
            if (flake.x > this.canvas.width) flake.x = 0;   // 飄到最右邊，再從最左邊出現繼續飄
            this.context.beginPath();
            this.context.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2);
            this.context.fill();
        });
        this.context.restore();
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
                    this.addExplosion(bomb.x, bomb.y, bomb.width*2, bomb.height*2);
                    this.live = Math.max(0, this.live - 1); // 扣一命，避免負數
                    this.setPlayerImage(this.playerImages.hurt, 500);
                    if (this.live <= 0) {   // Game Over
                        this.gameOver()
                    }
                }
            });
        });
        // 清除撞到的刀子/炸彈 與 飛出畫面的刀子/炸彈
        this.knives = this.knives.filter((k) => !k.hit && k.y + k.height > 0);
        this.bombs = this.bombs.filter((b) => !b.hit && !b.isOutOfBounds());
    }

    // game over state
    gameOver() {
        this.state = GameState.GAME_OVER;
        // 若進入 game over，清空所有掉落物
        this.fruits = [];
        this.bombs = [];
        this.explosions = [];
        this.startTime = null;
    }
    reset() {
        this.state = GameState.READY;
        // 清空所有掉落物
        this.fruits = [];
        this.bombs = [];
        this.explosions = [];
        this.resetDifficulty();
        this.startTime = null;
    }
}
