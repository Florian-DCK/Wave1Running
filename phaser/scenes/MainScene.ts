import * as Phaser from "phaser";

export class MainScene extends Phaser.Scene {
    // --- Vitesse réelle & entrée joueur ---
    private speed = 1000;              // vitesse utilisée pour le scroll
    private targetSpeed = 1000;        // vitesse "entrée" montée avec input

    // --- Vitesse cible (rythme imposé par le jeu) ---
    private goalSpeed = 0;             // valeur actuelle affichée (aiguille bleue)
    private goalTargetSpeed = 0;       // vraie cible vers laquelle on glisse
    private goalFollowStrength = 0.2;  // vitesse à laquelle le but se déplace

    // --- Config gameplay ---
    private maxTargetSpeed = 2000;
    private targetBoostPerPress = 100;
    private baseDecayPerSecond = 200;
    private extraDecayPerSecond = 500;
    private speedFollowStrength = 5;

    // Décélération liée au temps sans input
    private timeSinceLastInput = 0;
    private releaseRampUpTime = 1.5;
    private extraReleaseDecayMultiplier = 3;

    // --- Rythme cible ---
    private goalChangeInterval = 4;
    private goalTimer = 0;
    private goalMinRatio = 0.2;
    private goalMaxRatio = 0.9;
    private successThreshold = 80;

    // --- Vies ---
    private lives = 3;
    private outsideGoalTimer = 0;
    private maxOutsideDuration = 2.0;
    private livesText!: Phaser.GameObjects.Text;
    private gameOver = false;

    // --- Objets de la scène ---
    private bg!: Phaser.GameObjects.TileSprite;
    private runner!: Phaser.GameObjects.Rectangle;
    private spaceKey!: Phaser.Input.Keyboard.Key;
    private speedText!: Phaser.GameObjects.Text;
    private targetText!: Phaser.GameObjects.Text;
    private goalText!: Phaser.GameObjects.Text;

    // --- Jauge ---
    private gaugeContainer!: Phaser.GameObjects.Container;
    private gaugeNeedle!: Phaser.GameObjects.Rectangle;
    private goalNeedle!: Phaser.GameObjects.Rectangle;
    private minGaugeAngleDeg = -120;
    private maxGaugeAngleDeg = 120;

    // --- Obstacles ---
    private obstacle: Phaser.GameObjects.Rectangle | null = null;
    private obstacleActive = false;
    private obstacleTimer = 0;
    private obstacleSpawnIntervalMin = 12;
    private obstacleSpawnIntervalMax = 20;
    private nextObstacleTime = 0;
    private safeStopSpeed = 150;

    constructor() {
        super("MainScene");
    }

    preload() {
        this.load.image("bg", "/assets/bg.jpg");
    }

    create() {
        const { width, height } = this.scale;
        const isMobile = !this.sys.game.device.os.desktop;

        // facteur de vitesse plus lent sur mobile
        const speedFactor = isMobile ? 0.6 : 1;

        // On adapte les configs de vitesse
        this.maxTargetSpeed *= speedFactor;
        this.targetBoostPerPress *= speedFactor;
        this.baseDecayPerSecond *= speedFactor;
        this.extraDecayPerSecond *= speedFactor;

        // Et les valeurs de départ
        this.speed *= speedFactor;
        this.targetSpeed *= speedFactor;

        // ====== BACKGROUND FULLSCREEN ======
        this.bg = this.add
            .tileSprite(0, 0, this.bg.width, height, "bg")
            .setOrigin(0, 0);

        // ====== RUNNER ======
        const runnerScale = isMobile ? 0.7 : 1;       // plus petit en mobile
        const runnerWidth = 40 * runnerScale;
        const runnerHeight = 80 * runnerScale;

        const runnerX = isMobile ? width * 0.18 : width * 0.22;
        const runnerY = height * 0.7;

        this.runner = this.add
            .rectangle(runnerX, runnerY, runnerWidth, runnerHeight, 0xff0000)
            .setOrigin(0.5, 1);

        this.tweens.add({
            targets: this.runner,
            y: runnerY - 10,
            duration: 300,
            yoyo: true,
            repeat: -1,
        });


        // ====== TEXTS ======
        this.add
            .text(10, 10, "Tape ESPACE ou TAP pour courir !", {
                fontSize: "18px",
                color: "#ffffff",
            })
            .setScrollFactor(0);

        this.speedText = this.add
            .text(10, 35, "Speed: 0", {
                fontSize: "16px",
                color: "#ffffff",
            })
            .setScrollFactor(0);

        this.targetText = this.add
            .text(10, 55, "Input: 0", {
                fontSize: "16px",
                color: "#aaaaaa",
            })
            .setScrollFactor(0);

        this.goalText = this.add
            .text(10, 75, "Rythme cible: 0", {
                fontSize: "16px",
                color: "#4bc0ff",
            })
            .setScrollFactor(0);

        this.livesText = this.add
            .text(10, 95, "Vies: 3", {
                fontSize: "16px",
                color: "#ffaaaa",
            })
            .setScrollFactor(0);

        // ====== INPUTS ======
        this.spaceKey = this.input.keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.SPACE
        );
        this.spaceKey.on("down", () => this.boost());

        this.input.on("pointerdown", () => {
            this.boost();
        });

        // ====== INIT RYTHME ======
        const initialGoalRatio = 0.5;
        this.goalTargetSpeed = this.maxTargetSpeed * initialGoalRatio;
        this.goalSpeed = this.goalTargetSpeed;
        this.goalText.setText(`Rythme cible: ${Math.round(this.goalSpeed)}`);

        // ====== INIT OBSTACLES ======
        this.nextObstacleTime = Phaser.Math.FloatBetween(
            this.obstacleSpawnIntervalMin,
            this.obstacleSpawnIntervalMax
        );

        // ====== JAUGE ======
        const centerX = width / 2;
        const gaugeY = isMobile ? height - 80 : height - 100;
        const radius = 80;

        this.gaugeContainer = this.add.container(centerX, gaugeY);

        const g = this.add.graphics();
        this.gaugeContainer.add(g);

        const startDeg = this.minGaugeAngleDeg;
        const endDeg = this.maxGaugeAngleDeg;
        const midDeg = (startDeg + endDeg) / 2;
        const colorOffsetDeg = -90;
        const toRad = (deg: number) => Phaser.Math.DegToRad(deg + colorOffsetDeg);

        g.lineStyle(16, 0xff4b4b, 1);
        g.beginPath();
        g.arc(0, 0, radius, toRad(startDeg), toRad(startDeg + (midDeg - startDeg) * 0.5), false);
        g.strokePath();

        g.lineStyle(16, 0xffd34b, 1);
        g.beginPath();
        g.arc(
            0,
            0,
            radius,
            toRad(startDeg + (midDeg - startDeg) * 0.5),
            toRad(midDeg + (endDeg - midDeg) * 0.3),
            false
        );
        g.strokePath();

        g.lineStyle(16, 0x5ad45a, 1);
        g.beginPath();
        g.arc(
            0,
            0,
            radius,
            toRad(midDeg + (endDeg - midDeg) * 0.3),
            toRad(endDeg),
            false
        );
        g.strokePath();

        g.fillStyle(0x222222, 1);
        g.fillCircle(0, 0, 10);

        this.gaugeNeedle = this.add
            .rectangle(0, 0, 4, radius - 10, 0x111111)
            .setOrigin(0.5, 1);
        this.gaugeContainer.add(this.gaugeNeedle);

        this.goalNeedle = this.add
            .rectangle(0, 0, 3, radius - 18, 0x4bc0ff)
            .setOrigin(0.5, 1);
        this.gaugeContainer.add(this.goalNeedle);

        const centerDot = this.add.circle(0, 0, 6, 0x000000);
        this.gaugeContainer.add(centerDot);
    }

    private boost() {
        if (this.gameOver) return;

        this.targetSpeed = Math.min(
            this.targetSpeed + this.targetBoostPerPress,
            this.maxTargetSpeed
        );
        this.targetText.setText(`Input: ${Math.round(this.targetSpeed)}`);
        this.timeSinceLastInput = 0;
    }

    private loseLife() {
        if (this.lives > 0) {
            this.lives--;
            this.livesText.setText(`Vies: ${this.lives}`);
            this.cameras.main.flash(200, 255, 0, 0);
        }

        if (this.lives <= 0 && !this.gameOver) {
            this.gameOver = true;
            this.runner.setFillStyle(0x555555);

            const { width, height } = this.scale;
            this.add.text(width / 2, height / 2, "GAME OVER", {
                fontSize: "48px",
                color: "#ffffff",
                backgroundColor: "#00000080",
            }).setOrigin(0.5);
        }
    }

    private spawnObstacle() {
        if (this.obstacleActive || this.gameOver) return;

        const { width } = this.scale;

        this.obstacle = this.add
            .rectangle(width + 40, this.runner.y, 40, 80, 0x2222ff)
            .setOrigin(0.5, 1);

        this.obstacleActive = true;
        this.obstacleTimer = 0;
        this.outsideGoalTimer = 0;

        // pendant obstacle → objectif vitesse = 0
        this.goalTargetSpeed = 0;

        this.nextObstacleTime = Phaser.Math.FloatBetween(
            this.obstacleSpawnIntervalMin,
            this.obstacleSpawnIntervalMax
        );
    }

    private clearObstacle() {
        if (this.obstacle) {
            this.obstacle.destroy();
            this.obstacle = null;
        }
        this.obstacleActive = false;

        // relancer un rythme non nul
        this.goalTimer = 0;
        const newRatio = Phaser.Math.FloatBetween(
            this.goalMinRatio,
            this.goalMaxRatio
        );
        this.goalTargetSpeed = newRatio * this.maxTargetSpeed;
    }

    update(_time: number, delta: number) {
        const dt = delta / 1000;
        if (this.gameOver) return;

        this.timeSinceLastInput += dt;

        // 1) decay dynamique + boost si on lâche longtemps
        if (this.targetSpeed > 0) {
            const ratio = this.targetSpeed / this.maxTargetSpeed;
            const baseDynamicDecay =
                this.baseDecayPerSecond +
                this.extraDecayPerSecond * (ratio * ratio);

            const t = Phaser.Math.Clamp(
                this.timeSinceLastInput / this.releaseRampUpTime,
                0,
                1
            );
            const releaseFactor =
                1 + (this.extraReleaseDecayMultiplier - 1) * t;

            const dynamicDecay = baseDynamicDecay * releaseFactor;

            this.targetSpeed -= dynamicDecay * dt;
            if (this.targetSpeed < 0) this.targetSpeed = 0;
        }

        // 2) speed suit targetSpeed
        const diff = this.targetSpeed - this.speed;
        this.speed += diff * this.speedFollowStrength * dt;
        if (Math.abs(diff) < 0.5) this.speed = this.targetSpeed;

        // 3) rythme cible (hors obstacle)
        if (!this.obstacleActive) {
            this.goalTimer += dt;
            if (this.goalTimer >= this.goalChangeInterval) {
                this.goalTimer = 0;
                const newRatio = Phaser.Math.FloatBetween(
                    this.goalMinRatio,
                    this.goalMaxRatio
                );
                this.goalTargetSpeed = newRatio * this.maxTargetSpeed;
            }
        }

        // 3bis) goalSpeed suit goalTargetSpeed
        const goalDiff = this.goalTargetSpeed - this.goalSpeed;
        const follow = this.obstacleActive
            ? this.goalFollowStrength * 4 // descend plus vite vers 0 en obstacle
            : this.goalFollowStrength;

        this.goalSpeed += goalDiff * follow * dt;
        if (Math.abs(goalDiff) < 1) this.goalSpeed = this.goalTargetSpeed;

        // 4) scroll du background
        const scroll = (this.speed / 2) * dt;
        this.bg.tilePositionX += scroll;

        // 4bis) spawn obstacle
        this.obstacleTimer += dt;
        if (!this.obstacleActive && this.obstacleTimer >= this.nextObstacleTime) {
            this.obstacleTimer = 0;
            this.spawnObstacle();
        }

        // 5) gestion obstacle
        if (this.obstacleActive && this.obstacle) {
            this.obstacle.x -= scroll;
            const distance = this.obstacle.x - this.runner.x;

            if (distance < 200 && distance > 0) {
                this.runner.setFillStyle(0xffff00);
            }

            // arrêt suffisant → obstacle disparaît
            if (this.speed <= this.safeStopSpeed) {
                this.clearObstacle();
                this.runner.setFillStyle(0x00ff00);
                this.outsideGoalTimer = 0;
            }
            // collision si trop vite
            else if (distance <= 50) {
                this.clearObstacle();
                this.speed = 0;
                this.targetSpeed = 0;
                this.outsideGoalTimer = 0;
                this.runner.setFillStyle(0xff0000);
                this.loseLife();
            }

            if (this.obstacle && this.obstacle.x < -50) {
                this.clearObstacle();
            }

        } else {
            // 5bis) logique de rythme classique
            const deltaToGoal = Math.abs(this.speed - this.goalSpeed);

            if (deltaToGoal < this.successThreshold) {
                this.runner.setFillStyle(0x00ff00);
                this.outsideGoalTimer = 0;
            } else {
                this.runner.setFillStyle(0xff0000);
                this.outsideGoalTimer += dt;

                if (this.outsideGoalTimer >= this.maxOutsideDuration) {
                    this.outsideGoalTimer = 0;
                    this.loseLife();
                }
            }
        }

        // 6) textes debug
        this.speedText.setText(`Speed: ${Math.round(this.speed)}`);
        this.targetText.setText(`Input: ${Math.round(this.targetSpeed)}`);
        this.goalText.setText(`Rythme cible: ${Math.round(this.goalSpeed)}`);

        // 7) aiguilles
        const speedRatio = Phaser.Math.Clamp(this.speed / this.maxTargetSpeed, 0, 1);
        const goalRatio = Phaser.Math.Clamp(this.goalSpeed / this.maxTargetSpeed, 0, 1);

        const speedAngleDeg = Phaser.Math.Linear(
            this.minGaugeAngleDeg,
            this.maxGaugeAngleDeg,
            speedRatio
        );
        const goalAngleDeg = Phaser.Math.Linear(
            this.minGaugeAngleDeg,
            this.maxGaugeAngleDeg,
            goalRatio
        );

        this.gaugeNeedle.setRotation(Phaser.Math.DegToRad(speedAngleDeg));
        this.goalNeedle.setRotation(Phaser.Math.DegToRad(goalAngleDeg));
    }
}
