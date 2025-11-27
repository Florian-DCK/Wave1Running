import * as Phaser from "phaser";

export class MainScene extends Phaser.Scene {
    // --- Vitesse réelle & entrée joueur ---
    private speed = 1000;              // vitesse utilisée pour le scroll
    private targetSpeed = 1000;        // vitesse "entrée" montée avec ESPACE

    // --- Vitesse cible (rythme imposé par le jeu) ---
    private goalSpeed = 0;         // valeur actuelle affichée
    private goalTargetSpeed = 0;   // vraie cible vers laquelle on glisse
    private goalFollowStrength = 0.2; // vitesse à laquelle le but se déplace (tunable)

    // --- Config gameplay ---
    private maxTargetSpeed = 2000;        // vitesse max
    private targetBoostPerPress = 100;    // gain de targetSpeed à chaque ESPACE
    private baseDecayPerSecond = 200;
    private extraDecayPerSecond = 500;
    private speedFollowStrength = 5;      // interpolation speed -> targetSpeed

    // rythme cible
    private goalChangeInterval = 4;       // toutes les X secondes on change de rythme
    private goalTimer = 0;
    private goalMinRatio = 0.2;           // 20% de la vitesse max
    private goalMaxRatio = 0.9;           // 90% de la vitesse max
    private successThreshold = 80;        // marge d’erreur pour être "dans le bon rythme"

    // --- Vies ---
    private lives = 3;
    private outsideGoalTimer = 0;         // temps passé hors de la bonne zone
    private maxOutsideDuration = 2.0;     // en secondes avant de perdre 1 vie
    private livesText!: Phaser.GameObjects.Text;
    private gameOver = false;

    // --- Objets de la scène ---
    private bg!: Phaser.GameObjects.TileSprite;
    private runner!: Phaser.GameObjects.Rectangle;
    private spaceKey!: Phaser.Input.Keyboard.Key;
    private speedText!: Phaser.GameObjects.Text;
    private targetText!: Phaser.GameObjects.Text;
    private goalText!: Phaser.GameObjects.Text;

    // --- Jauge type compteur ---
    private gaugeContainer!: Phaser.GameObjects.Container;
    private gaugeNeedle!: Phaser.GameObjects.Rectangle;       // aiguille joueur (noire)
    private goalNeedle!: Phaser.GameObjects.Rectangle;        // aiguille rythme cible (bleue)
    private minGaugeAngleDeg = -120; // angle aiguille à gauche
    private maxGaugeAngleDeg = 120;  // angle aiguille à droite

    constructor() {
        super("MainScene");
    }

    preload() {
        // BG tileable horizontalement, ex: /public/assets/bg.jpg
        this.load.image("bg", "/assets/bg.jpg");
    }

    create() {
        const {width, height} = this.scale;

        // ====== BACKGROUND SCROLLABLE ======
        this.bg = this.add
            .tileSprite(0, 0, width, height, "bg")
            .setOrigin(0, 0);

        // ====== RUNNER (placeholder) ======
        this.runner = this.add
            .rectangle(width * 0.2, height * 0.7, 40, 80, 0xff0000)
            .setOrigin(0.5, 1);

        // petite anim idle
        this.tweens.add({
            targets: this.runner,
            y: this.runner.y - 10,
            duration: 300,
            yoyo: true,
            repeat: -1,
        });

        // ====== TEXTS DEBUG ======
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

        // Texte des vies
        this.livesText = this.add
            .text(10, 95, "Vies: 3", {
                fontSize: "16px",
                color: "#ffaaaa",
            })
            .setScrollFactor(0);

        // ====== INPUT CLAVIER (ESPACE) ======
        this.spaceKey = this.input.keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.SPACE
        );
        this.spaceKey.on("down", () => this.boost());

        // ====== CONTROLES MOBILE SUR TAP ======
        this.input.on("pointerdown", () => {
            this.boost();
        });

        // ====== INIT RYTHME CIBLE ======
        const initialGoalRatio = 0.5;
        this.goalTargetSpeed = this.maxTargetSpeed * initialGoalRatio;
        this.goalSpeed = this.goalTargetSpeed; // on commence directement dessus
        this.goalText.setText(
            `Rythme cible: ${Math.round(this.goalSpeed)}`
        );

        // ====== JAUGE TYPE COMPTEUR ======
        const centerX = width / 2;
        const centerY = height - 100;
        const radius = 80;

        this.gaugeContainer = this.add.container(centerX, centerY);

        const g = this.add.graphics();
        this.gaugeContainer.add(g);

        const startDeg = this.minGaugeAngleDeg; // -120
        const endDeg = this.maxGaugeAngleDeg;   //  120
        const midDeg = (startDeg + endDeg) / 2; //   0

        // Offset pour ROTATER seulement les couleurs de -90°
        const colorOffsetDeg = -90;
        const toRad = (deg: number) => Phaser.Math.DegToRad(deg + colorOffsetDeg);

        // Segment rouge (lent)
        g.lineStyle(16, 0xff4b4b, 1);
        g.beginPath();
        g.arc(
            0,
            0,
            radius,
            toRad(startDeg),
            toRad(startDeg + (midDeg - startDeg) * 0.5),
            false
        );
        g.strokePath();

        // Segment jaune (moyen)
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

        // Segment vert (rapide)
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

        // Centre du cadran
        g.fillStyle(0x222222, 1);
        g.fillCircle(0, 0, 10);

        // Aiguille du joueur (noire)
        this.gaugeNeedle = this.add
            .rectangle(0, 0, 4, radius - 10, 0x111111)
            .setOrigin(0.5, 1);
        this.gaugeContainer.add(this.gaugeNeedle);

        // Aiguille du rythme cible (bleue)
        this.goalNeedle = this.add
            .rectangle(0, 0, 3, radius - 18, 0x4bc0ff)
            .setOrigin(0.5, 1);
        this.gaugeContainer.add(this.goalNeedle);

        // Point au centre
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
    }

    update(_time: number, delta: number) {
        const dt = delta / 1000;

        if (this.gameOver) {
            // On pourrait garder le scroll ou non, ici on freeze tout
            return;
        }

        // 1) La targetSpeed (entrée joueur) diminue progressivement (decay dynamique)
        if (this.targetSpeed > 0) {
            const ratio = this.targetSpeed / this.maxTargetSpeed; // 0 → 1

            const dynamicDecay =
                this.baseDecayPerSecond +
                this.extraDecayPerSecond * (ratio * ratio); // ratio² pour accentuer le haut

            this.targetSpeed -= dynamicDecay * dt;
            if (this.targetSpeed < 0) this.targetSpeed = 0;
        }

        // 2) La speed réelle suit la targetSpeed en douceur
        const diff = this.targetSpeed - this.speed;
        this.speed += diff * this.speedFollowStrength * dt;
        if (Math.abs(diff) < 0.5) {
            this.speed = this.targetSpeed;
        }

        // 3) Choix d'une nouvelle cible de rythme toutes les X secondes
        this.goalTimer += dt;
        if (this.goalTimer >= this.goalChangeInterval) {
            this.goalTimer = 0;

            const newRatio = Phaser.Math.FloatBetween(
                this.goalMinRatio,
                this.goalMaxRatio
            );
            this.goalTargetSpeed = newRatio * this.maxTargetSpeed;
        }

        // 3bis) La vitesse cible affichée glisse vers la cible réelle
        const goalDiff = this.goalTargetSpeed - this.goalSpeed;
        this.goalSpeed += goalDiff * this.goalFollowStrength * dt;

        if (Math.abs(goalDiff) < 1) {
            this.goalSpeed = this.goalTargetSpeed;
        }

        // 4) Scroll du background
        this.bg.tilePositionX += (this.speed / 2) * dt;

        // 5) Feedback : est-ce que le joueur suit bien le rythme ?
        const deltaToGoal = Math.abs(this.speed - this.goalSpeed);

        if (deltaToGoal < this.successThreshold) {
            // bon rythme → runner vert
            this.runner.setFillStyle(0x00ff00);
            this.outsideGoalTimer = 0; // reset du timer quand on est dans la zone
        } else {
            // mauvais rythme → runner rouge
            this.runner.setFillStyle(0xff0000);
            this.outsideGoalTimer += dt;

            // si on reste trop longtemps en dehors → perte de vie
            if (this.outsideGoalTimer >= this.maxOutsideDuration) {
                this.outsideGoalTimer = 0;

                if (this.lives > 0) {
                    this.lives--;
                    this.livesText.setText(`Vies: ${this.lives}`);

                    // petit flash rouge
                    this.cameras.main.flash(200, 255, 0, 0);
                }

                if (this.lives <= 0) {
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
        }

        // 6) Debug textes
        this.speedText.setText(`Speed: ${Math.round(this.speed)}`);
        this.targetText.setText(`Input: ${Math.round(this.targetSpeed)}`);
        this.goalText.setText(`Rythme cible: ${Math.round(this.goalSpeed)}`);

        // 7) Mise à jour des aiguilles
        const speedRatio = Phaser.Math.Clamp(
            this.speed / this.maxTargetSpeed,
            0,
            1
        );
        const goalRatio = Phaser.Math.Clamp(
            this.goalSpeed / this.maxTargetSpeed,
            0,
            1
        );

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
