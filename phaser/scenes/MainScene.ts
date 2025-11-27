import * as Phaser from "phaser";

export class MainScene extends Phaser.Scene {
    // vitesse de course auto
    private runSpeed = 800;
    private speed = this.runSpeed;

    // état
    private isStopped = false;
    private stopThreshold = 40;     // en dessous → considéré à l’arrêt
    private stopDuration = 1.0;     // temps d’arrêt avant de repartir automatiquement
    private stopTimer = 0;

    // freinage par spam
    private tapCount = 0;
    private tapWindow = 0.6;        // fenêtre de temps pour compter les taps (en s)
    private tapTimer = 0;
    private tapsPerSecondToFullBrake = 6; // à partir de ce rythme on freine à fond
    private brakeStrength = 1;
    private lastTapTime = 0;
    private tapHoldDuration = 0.15; // temps max entre deux taps pour considérer que "le joueur freine"
// combien vite on interpole vers 0

    // objets
    private bg!: Phaser.GameObjects.TileSprite;
    private runner!: Phaser.GameObjects.Rectangle;
    private spaceKey!: Phaser.Input.Keyboard.Key;
    private speedText!: Phaser.GameObjects.Text;

    // jauge (une seule aiguille)
    private gaugeContainer!: Phaser.GameObjects.Container;
    private gaugeNeedle!: Phaser.GameObjects.Rectangle;
    private minGaugeAngleDeg = -120;
    private maxGaugeAngleDeg = 120;

    constructor() {
        super("MainScene");
    }

    preload() {
        this.load.image("bg", "/assets/bg.jpg");
    }

    create() {
        const { width, height } = this.scale;
        const isMobile = !this.sys.game.device.os.desktop;

        // ===== BG =====
        this.bg = this.add
            .tileSprite(0, 0, width, height, "bg")
            .setOrigin(0, 0);

        // ===== Runner =====
        const runnerScale = isMobile ? 0.7 : 1;
        const runnerWidth = 40 * runnerScale;
        const runnerHeight = 80 * runnerScale;

        const runnerX = isMobile ? width * 0.18 : width * 0.22;
        const runnerY = height * 0.7;

        this.runner = this.add
            .rectangle(runnerX, runnerY, runnerWidth, runnerHeight, 0x00ff00)
            .setOrigin(0.5, 1);

        this.tweens.add({
            targets: this.runner,
            y: runnerY - 10,
            duration: 300,
            yoyo: true,
            repeat: -1,
        });

        // ===== Texte debug =====
        this.speedText = this.add.text(10, 10, "Speed: 0", {
            fontSize: "18px",
            color: "#ffffff"
        });

        // ===== Input =====
        this.spaceKey = this.input.keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.SPACE
        );
        this.spaceKey.on("down", () => this.onTap());

        this.input.on("pointerdown", () => {
            this.onTap();
        });

        // ===== Jauge =====
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

        // rouge
        g.lineStyle(16, 0xff4b4b, 1);
        g.beginPath();
        g.arc(0, 0, radius, toRad(startDeg), toRad(startDeg + (midDeg - startDeg) * 0.5), false);
        g.strokePath();

        // jaune
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

        // vert
        g.lineStyle(16, 0x5ad45a, 1);
        g.beginPath();
        g.arc(0, 0, radius, toRad(midDeg + (endDeg - midDeg) * 0.3), toRad(endDeg), false);
        g.strokePath();

        // centre
        g.fillStyle(0x222222, 1);
        g.fillCircle(0, 0, 10);

        this.gaugeNeedle = this.add
            .rectangle(0, 0, 4, radius - 10, 0x111111)
            .setOrigin(0.5, 1);
        this.gaugeContainer.add(this.gaugeNeedle);

        const centerDot = this.add.circle(0, 0, 6, 0x000000);
        this.gaugeContainer.add(centerDot);
    }

    private onTap() {
        if (this.isStopped) return;

        this.lastTapTime = this.time.now; // marque le dernier tap
        this.runner.setFillStyle(0xffff00); // feedback de freinage
    }


    update(_time: number, delta: number) {
        const dt = delta / 1000;

// ===== Gestion de l’état arrêté / course =====
        if (this.isStopped) {
            // perso totalement stoppé
            this.speed = 0;

            this.stopTimer += dt;
            if (this.stopTimer >= this.stopDuration) {
                // on repart automatiquement
                this.isStopped = false;
                this.stopTimer = 0;
                this.runner.setFillStyle(0x00ff00);
            }
        } else {
            // personnage en course auto : tend vers la vitesse de base
            const target = this.runSpeed;

            // est-ce que le joueur spam actuellement ?
            const isBraking = (this.time.now - this.lastTapTime) < (this.tapHoldDuration * 1000);

            let desiredSpeed;

            if (isBraking) {
                // le joueur spam → il freine vers 0
                desiredSpeed = 0;
                this.runner.setFillStyle(0xffff00); // feedback visuel de freinage
            } else {
                // le joueur ne tape plus → il repart
                desiredSpeed = target;
                this.runner.setFillStyle(0x00ff00);
            }

            // interpolation douce vers la vitesse cible
            this.speed += (desiredSpeed - this.speed) * this.brakeStrength * dt;

            // s'il freine fort et qu'il arrive quasi à 0 → entrer en mode STOP
            if (isBraking && this.speed <= this.stopThreshold) {
                this.speed = 0;
                this.isStopped = true;
                this.stopTimer = 0;
                this.runner.setFillStyle(0x5555ff);
            }
        }

        // ===== Scroll du background =====
        this.bg.tilePositionX += (this.speed / 2) * dt;

        // ===== Debug texte & jauge =====
        this.speedText.setText(`Speed: ${Math.round(this.speed)}`);

        const speedRatio = Phaser.Math.Clamp(this.speed / this.runSpeed, 0, 1);
        const speedAngleDeg = Phaser.Math.Linear(
            this.minGaugeAngleDeg,
            this.maxGaugeAngleDeg,
            speedRatio
        );
        this.gaugeNeedle.setRotation(Phaser.Math.DegToRad(speedAngleDeg));
    }
}
