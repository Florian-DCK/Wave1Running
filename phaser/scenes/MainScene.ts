import * as Phaser from 'phaser';

export class MainScene extends Phaser.Scene {
	// --- Paramètres généraux ---
	private isMobile = false;
	private speed = 0;
	private maxSpeed = 0;
	private boostAmount = 0;
	private decayPerSecond = 0;
	private gameOver = false;

	// --- BG & objets principaux ---
	private bg!: Phaser.GameObjects.TileSprite;
	private ground!: Phaser.GameObjects.TileSprite;
	private runner!: Phaser.GameObjects.Rectangle;
	private bounceTween!: Phaser.Tweens.Tween;
	private speedText!: Phaser.GameObjects.Text;
	private infoText!: Phaser.GameObjects.Text;
	private spaceKey!: Phaser.Input.Keyboard.Key;
	private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
	private stepsText!: Phaser.GameObjects.Text;

	// Progress UI
	private progressBarBg!: Phaser.GameObjects.Rectangle;
	private progressBarFill!: Phaser.GameObjects.Rectangle;
	private progressBarWidth = 240;
	private progressBarHeight = 18;

	// --- Compteur de pas ---
	private distanceTravelled = 0; // en pixels
	private steps = 0;
	private targetSteps = 10000;
	private pxPerStep = 10;
	private stepMultiplier = 5;
	private goalReached = false;

	// --- Lignes (temple run 2 lignes horizontales) ---
	private lanesY: number[] = [];
	private currentLaneIndex = 1; // 0 = haut, 1 = bas
	private laneSwitchDuration = 120;

	// --- Obstacles qui arrivent de la droite sur une ligne ---
	private obstacles: Phaser.GameObjects.Rectangle[] = [];
	private obstacleSpawnInterval = 1.2; // secondes
	private obstacleSpawnTimer = 0;
	private obstacleSpeed = 650; // px/s
	private swipeStartY: number | null = null;

	constructor() {
		super('MainScene');
	}

	preload() {
		this.load.image('bg', '/assets/ciel.png');
		this.load.image('ground', '/assets/sol.png');
	}

	create() {
		const { width, height } = this.scale;
		this.isMobile = !this.sys.game.device.os.desktop;

		this.maxSpeed = this.isMobile ? 400 : 900;
		this.boostAmount = this.isMobile ? 180 : 260;
		this.decayPerSecond = this.isMobile ? 360 : 480;
		this.obstacleSpeed = this.isMobile ? 520 : 700;
		this.stepMultiplier = this.isMobile ? 8 : 5;
		this.speed = 0;

		// Lignes horizontales (haut / bas)
		this.lanesY = [height * 0.58, height * 0.8];

		// ====== BACKGROUND SCROLLABLE ======
		const groundTop = this.lanesY[1];
		this.bg = this.add.tileSprite(0, 0, width, height, 'bg').setOrigin(0, 0);
		const bgTex = this.textures.get('bg').getSourceImage();
		if (bgTex && bgTex.height > 0) {
			// Force une seule tuile en Y en étirant le visuel sur toute la hauteur.
			const scaleY = height / bgTex.height;
			this.bg.setTileScale(1, scaleY);
		}
		this.ground = this.add
			.rectangle(
				width / 2,
				groundTop + groundHeight / 2,
				width,
				groundHeight,
				0x0c0c0c
			)
			.setOrigin(0.5, 0.5);

		// ===== RUNNER =====
		const runnerScale = this.isMobile ? 0.8 : 1;
		const runnerWidth = 44 * runnerScale;
		const runnerHeight = 86 * runnerScale;
		const runnerX = width * 0.2;

		this.runner = this.add
			.rectangle(
				runnerX,
				this.lanesY[this.currentLaneIndex],
				runnerWidth,
				runnerHeight,
				0x00ff66
			)
			.setOrigin(0.5, 1);

		// petit rebond idle (stocké pour pouvoir le recréer après un switch de ligne)
		this.bounceTween = this.tweens.add({
			targets: this.runner,
			y: this.runner.y - 12,
			duration: 320,
			yoyo: true,
			repeat: -1,
			ease: 'Sine.easeInOut',
		});

		// ===== UI =====
		this.speedText = this.add.text(10, 10, 'Vitesse: 0', {
			fontSize: '18px',
			color: '#ffffff',
		});

		this.infoText = this.add
			.text(10, 32, 'ESPACE = accélérer | Swipe ou ↑/↓ = changer de ligne', {
				fontSize: '14px',
				color: '#dddddd',
			})
			.setDepth(1);

		// compteur de pas centré
		const centerX = width / 2;
		const uiCenterY = 60;
		this.add
			.rectangle(
				centerX,
				uiCenterY,
				this.progressBarWidth + 20,
				56,
				0x111111,
				0.6
			)
			.setOrigin(0.5, 0.5);

		this.stepsText = this.add
			.text(centerX, uiCenterY - 12, `Pas: 0 / ${this.targetSteps}`, {
				fontSize: '20px',
				color: '#ffffff',
				stroke: '#000000',
				strokeThickness: 4,
				backgroundColor: '#000000',
			})
			.setOrigin(0.5, 0);

		const barX = centerX - this.progressBarWidth / 2;
		const barY = uiCenterY + 40;
		this.progressBarBg = this.add
			.rectangle(
				centerX,
				barY,
				this.progressBarWidth,
				this.progressBarHeight,
				0x444444,
				0.8
			)
			.setOrigin(0.5, 0.5);
		this.progressBarFill = this.add
			.rectangle(barX, barY, 0, this.progressBarHeight - 4, 0x4caf50, 1)
			.setOrigin(0, 0.5);

		// ===== INPUTS =====
		if (this.input && this.input.keyboard) {
			this.spaceKey = this.input.keyboard.addKey(
				Phaser.Input.Keyboard.KeyCodes.SPACE
			);
			this.spaceKey.on('down', () => this.boost());

			this.cursors = this.input.keyboard.createCursorKeys();
		}

		if (this.input) {
			this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
				if (this.gameOver) return;
				this.swipeStartY = p.position.y;
			});
			this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
				if (this.gameOver) return;
				if (this.swipeStartY === null) return;
				const dy = p.position.y - this.swipeStartY;
				const threshold = 30;
				if (dy > threshold) {
					this.switchLane(1);
				} else if (dy < -threshold) {
					this.switchLane(-1);
				} else {
					// tap court = boost (surtout pour mobile)
					this.boost();
				}
				this.swipeStartY = null;
			});
		}
	}

	private switchLane(direction: -1 | 1 | 0 = 0) {
		if (this.gameOver) return;
		if (direction === 0) {
			this.currentLaneIndex = this.currentLaneIndex === 0 ? 1 : 0;
		} else {
			this.currentLaneIndex = Phaser.Math.Clamp(
				this.currentLaneIndex + direction,
				0,
				1
			);
		}
		const targetY = this.lanesY[this.currentLaneIndex];

		// stop/recrée le rebond pour éviter de revenir sur l'ancienne ligne
		if (this.bounceTween) {
			this.bounceTween.stop();
		}

		this.tweens.add({
			targets: this.runner,
			y: targetY,
			duration: this.laneSwitchDuration,
			ease: 'Sine.easeOut',
			onComplete: () => {
				this.bounceTween = this.tweens.add({
					targets: this.runner,
					y: targetY - 12,
					duration: 320,
					yoyo: true,
					repeat: -1,
					ease: 'Sine.easeInOut',
				});
			},
		});
	}

	private spawnObstacle() {
		const laneIndex = Phaser.Math.Between(0, 1);
		const size = this.isMobile ? 50 : 60;
		const y = this.lanesY[laneIndex];
		const x = this.scale.width + size;

		const obs = this.add
			.rectangle(x, y, size, size, 0xffaa00)
			.setOrigin(0.5, 1);

		this.obstacles.push(obs);
	}

	private boost() {
		if (this.gameOver) return;
		this.speed = Math.min(this.speed + this.boostAmount, this.maxSpeed);
		this.infoText.setText(
			`Boost: +${Math.round(this.boostAmount)} | Vitesse: ${Math.round(
				this.speed
			)}`
		);
	}

	private handleCrash() {
		if (this.gameOver) return;
		this.gameOver = true;
		this.runner.setFillStyle(0xff4444);
		this.cameras.main.flash(200, 255, 0, 0);

		const msg = this.add
			.text(
				this.scale.width / 2,
				this.scale.height / 2,
				'Ouch !\nTape pour rejouer',
				{
					fontSize: '28px',
					color: '#ffffff',
					backgroundColor: '#aa0000',
					padding: { x: 12, y: 10 },
					align: 'center',
				}
			)
			.setOrigin(0.5);

		this.input.once('pointerdown', () => this.scene.restart());
		if (this.spaceKey) {
			this.spaceKey.once('down', () => this.scene.restart());
		}
	}

	update(_time: number, delta: number) {
		const dt = delta / 1000;
		const { width, height } = this.scale;

		if (this.gameOver) {
			return;
		}

		// ===== INPUT LANE (flèches / swipe) =====
		if (this.cursors) {
			if (this.cursors.up && Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
				this.switchLane(-1);
			} else if (
				this.cursors.down &&
				Phaser.Input.Keyboard.JustDown(this.cursors.down)
			) {
				this.switchLane(1);
			}
		}

		// ===== VITESSE / SCROLL =====
		this.speed = Math.max(0, this.speed - this.decayPerSecond * dt);
		const scroll = this.speed * dt;
		// le décor et les obstacles avancent à la même vitesse pour rester “collés” au fond
		this.bg.tilePositionX += scroll;
		this.ground.tilePositionX += scroll;

		// ===== COMPTEUR DE PAS =====
		if (!this.goalReached) {
			this.distanceTravelled += scroll;
			const newSteps = Math.floor(
				(this.distanceTravelled / this.pxPerStep) * this.stepMultiplier
			);
			if (newSteps !== this.steps) {
				this.steps = newSteps;
				const displaySteps = Math.min(this.steps, this.targetSteps);
				this.stepsText.setText(`Pas: ${displaySteps} / ${this.targetSteps}`);
				const ratio = Phaser.Math.Clamp(displaySteps / this.targetSteps, 0, 1);
				this.progressBarFill.width = Math.round(this.progressBarWidth * ratio);
				this.tweens.add({
					targets: this.stepsText,
					scale: 1.08,
					duration: 140,
					yoyo: true,
				});

				if (this.steps >= this.targetSteps) {
					this.goalReached = true;
					this.cameras.main.flash(500, 0, 255, 0);
					const winText = this.add
						.text(width / 2, height / 2, 'Objectif atteint\n10 000 pas', {
							fontSize: '28px',
							color: '#ffffff',
							backgroundColor: '#228822',
							padding: { x: 10, y: 10 },
							align: 'center',
						})
						.setOrigin(0.5);
					this.tweens.add({
						targets: winText,
						alpha: { from: 0, to: 1 },
						duration: 400,
					});
				}
			}
		}

		// ===== SPAWN D'OBSTACLES =====
		this.obstacleSpawnTimer += dt;
		if (this.obstacleSpawnTimer >= this.obstacleSpawnInterval) {
			this.obstacleSpawnTimer = 0;
			this.spawnObstacle();
			// petit jitter
			this.obstacleSpawnInterval = Phaser.Math.FloatBetween(0.9, 1.4);
		}

		// ===== MISE À JOUR DES OBSTACLES =====
		for (let i = this.obstacles.length - 1; i >= 0; i--) {
			const o = this.obstacles[i];
			o.x -= scroll;

			// collision
			if (
				Phaser.Geom.Intersects.RectangleToRectangle(
					o.getBounds(),
					this.runner.getBounds()
				)
			) {
				o.destroy();
				this.obstacles.splice(i, 1);
				this.handleCrash();
				continue;
			}

			// hors écran
			if (o.x < -100) {
				o.destroy();
				this.obstacles.splice(i, 1);
			}
		}

		// ===== DEBUG TEXTE =====
		const firstObsXText =
			this.obstacles.length > 0
				? String(Math.round(this.obstacles[0].x))
				: 'none';
		this.speedText.setText(
			`Vitesse: ${Math.round(this.speed)} | Ligne: ${
				this.currentLaneIndex + 1
			} | ObX: ${firstObsXText}`
		);
	}
}
