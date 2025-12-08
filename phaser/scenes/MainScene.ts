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
	private houses!: Phaser.GameObjects.TileSprite;
	private runner!: Phaser.GameObjects.Sprite;
	private runnerHitbox!: Phaser.GameObjects.Rectangle;
	private speedText!: Phaser.GameObjects.Text;
	private infoText!: Phaser.GameObjects.Text;
	private spaceKey!: Phaser.Input.Keyboard.Key;
	private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
	private stepsText!: Phaser.GameObjects.Text;
	private transitionFrameKeys: string[] = [];
	private transitionAnimationKey = 'idle_to_run';
	private isTransitionPlaying = false;
	private walkFrameKeys: string[] = [];
	private walkAnimationKey = 'walk_loop';
	private isWalkLoopPlaying = false;
	private idleTextureKey = 'character_idle';

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
		this.transitionFrameKeys = [];
		this.walkFrameKeys = [];
		this.load.image('bg', '/assets/ciel.png');
		this.load.image('ground', '/assets/sol.png');
		this.load.image('houses', '/assets/maison.png');
		this.load.image('character_idle', '/assets/character_idle.png');
		const transitionFrames = 27;
		for (let i = 0; i < transitionFrames; i++) {
			const frameId = i.toString().padStart(5, '0');
			const key = `transition_${frameId}`;
			this.transitionFrameKeys.push(key);
			this.load.image(
				key,
				`/assets/animations/Arret+Marche/Arret+Marche_${frameId}.png`
			);
		}
		const walkFrames = 34;
		for (let i = 0; i < walkFrames; i++) {
			const frameId = i.toString().padStart(5, '0');
			const key = `walk_${frameId}`;
			this.walkFrameKeys.push(key);
			this.load.image(
				key,
				`/assets/animations/marche loop/marche loop_${frameId}.png`
			);
		}
		if (this.transitionFrameKeys.length > 0) {
			this.idleTextureKey = this.transitionFrameKeys[0];
		} else if (this.walkFrameKeys.length > 0) {
			this.idleTextureKey = this.walkFrameKeys[0];
		}
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
		this.lanesY = [height * 0.75, height * 0.95];

		// ====== BACKGROUND SCROLLABLE ======
		this.bg = this.add.tileSprite(0, 0, width, height, 'bg').setOrigin(0, 0);
		this.fitBackgroundToHeight(width, height);
		this.houses = this.add
			.tileSprite(0, height - 570, width, 300, 'houses')
			.setOrigin(0, 0);
		this.ground = this.add
			.tileSprite(0, height - 270, width, 270, 'ground')
			.setOrigin(0, 0);
		this.scale.on('resize', this.handleResize, this);

		// ===== RUNNER =====
		const runnerScale = this.isMobile ? 0.3 : 0.3;
		const runnerX = width * 0.2;

		this.runner = this.add
			.sprite(runnerX, this.lanesY[this.currentLaneIndex], this.idleTextureKey)
			.setOrigin(0.5, 1)
			.setScale(runnerScale);
		this.createRunnerAnimations();
		const hitboxWidth = this.runner.displayWidth * 0.1;
		const hitboxHeight = this.runner.displayHeight * 0.7;
		this.runnerHitbox = this.add
			.rectangle(
				runnerX,
				this.lanesY[this.currentLaneIndex],
				hitboxWidth,
				hitboxHeight,
				0xff0000,
				0.2
			)
			.setOrigin(0.5, 1.15)
			.setVisible(true);

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

		this.tweens.add({
			targets: this.runner,
			y: targetY,
			duration: this.laneSwitchDuration,
			ease: 'Sine.easeOut',
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
		obs.setData('laneIndex', laneIndex);

		this.obstacles.push(obs);
	}

	private boost() {
		if (this.gameOver) return;
		const wasStopped = this.speed <= 1;
		this.speed = Math.min(this.speed + this.boostAmount, this.maxSpeed);
		if (wasStopped && this.speed > 0) {
			this.playStartTransition();
		}
		this.infoText.setText(
			`Boost: +${Math.round(this.boostAmount)} | Vitesse: ${Math.round(
				this.speed
			)}`
		);
	}

	private playStartTransition() {
		if (this.isTransitionPlaying) return;
		if (!this.anims.exists(this.transitionAnimationKey)) {
			this.playWalkLoop();
			return;
		}
		if (this.isWalkLoopPlaying && this.runner.anims) {
			this.runner.anims.stop();
			this.isWalkLoopPlaying = false;
		}
		this.isTransitionPlaying = true;
		this.runner.play(this.transitionAnimationKey);
		this.runner.once(
			Phaser.Animations.Events.ANIMATION_COMPLETE_KEY +
				this.transitionAnimationKey,
			() => {
				this.isTransitionPlaying = false;
				this.playWalkLoop();
			}
		);
	}

	private playWalkLoop() {
		if (this.isWalkLoopPlaying) return;
		if (!this.anims.exists(this.walkAnimationKey)) return;
		this.runner.play(this.walkAnimationKey);
		this.isWalkLoopPlaying = true;
	}

	private stopWalkLoop() {
		if (!this.isWalkLoopPlaying) return;
		if (this.runner.anims) {
			this.runner.anims.stop();
		}
		this.runner.setTexture(this.idleTextureKey);
		this.isWalkLoopPlaying = false;
	}

	private handleCrash() {
		if (this.gameOver) return;
		this.gameOver = true;
		this.isTransitionPlaying = false;
		this.stopWalkLoop();
		this.runner.setTint(0xff4444);
		this.cameras.main.flash(200, 255, 0, 0);

		this.add
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

	private handleResize(gameSize: Phaser.Structs.Size) {
		const { width, height } = gameSize;

		// keep the background and ground filling the full viewport height
		if (this.bg) {
			this.bg.setSize(width, height);
			this.bg.setTilePosition(0, 0);
			this.fitBackgroundToHeight(width, height);
		}
		if (this.ground) {
			this.ground.setSize(width, 100);
			this.ground.setPosition(0, height - 100);
		}

		// recalculate lanes and runner Y to stay aligned with the new height
		this.lanesY = [height * 0.58, height * 0.8];
		if (this.runner) {
			this.runner.y = this.lanesY[this.currentLaneIndex];
			if (this.runnerHitbox) {
				this.runnerHitbox.x = this.runner.x;
				this.runnerHitbox.y = this.runner.y;
			}
		}
	}

	private fitBackgroundToHeight(width: number, height: number) {
		const texture = this.textures.get('bg');
		const source = texture.getSourceImage() as HTMLImageElement | undefined;
		// some Phaser builds expose getFrame on the manager, not the texture instance
		const frame = this.textures.getFrame('bg');
		const frameHeight = source?.height ?? frame?.height;
		if (!frameHeight || frameHeight === 0) return;

		// uniform scale: keep aspect ratio, fit height, let X repeat naturally
		const scale = height / frameHeight;
		this.bg.setTileScale(scale, scale);
	}

	private createRunnerAnimations() {
		this.createAnimationFromKeys(
			this.transitionAnimationKey,
			this.transitionFrameKeys,
			20,
			0
		);
		this.createAnimationFromKeys(
			this.walkAnimationKey,
			this.walkFrameKeys,
			24,
			-1
		);
	}

	private createAnimationFromKeys(
		key: string,
		frameKeys: string[],
		frameRate: number,
		repeat: number
	) {
		if (frameKeys.length === 0) return;
		if (this.anims.exists(key)) return;
		const frames = frameKeys.map((frameKey) => ({ key: frameKey }));
		this.anims.create({ key, frames, frameRate, repeat });
	}

	update(_time: number, delta: number) {
		const dt = delta / 1000;
		const { width, height } = this.scale;

		if (this.gameOver) {
			return;
		}
		if (this.runnerHitbox) {
			this.runnerHitbox.x = this.runner.x;
			this.runnerHitbox.y = this.runner.y;
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
		if (!this.isTransitionPlaying && this.speed <= 5) {
			this.stopWalkLoop();
		}
		const scroll = this.speed * dt;
		// le décor et les obstacles avancent à la même vitesse pour rester “collés” au fond
		this.bg.tilePositionX += scroll / 2.5;
		this.houses.tilePositionX += scroll;
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

			const obstacleLane = o.getData('laneIndex') ?? 0;
			const sameLane = obstacleLane === this.currentLaneIndex;
			if (sameLane) {
				const collides = Phaser.Geom.Intersects.RectangleToRectangle(
					o.getBounds(),
					this.runnerHitbox.getBounds()
				);
				if (collides) {
					o.destroy();
					this.obstacles.splice(i, 1);
					this.handleCrash();
					continue;
				}
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
