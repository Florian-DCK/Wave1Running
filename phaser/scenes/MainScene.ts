import * as Phaser from 'phaser';

export class MainScene extends Phaser.Scene {
	// --- Vitesse auto du personnage ---
	private isMobile = false;
	private runSpeed = this.isMobile ? 400 : 800; // vitesse de base
	private speed = 0;
	private maxSpeed = 0;
	private boostAmount = 0;
	private decayPerSecond = 0;
	private timeSinceLastBoost = 0;
	private extraDecayDelay = 0;
	private extraDecayRampDuration = 0;
	private extraDecayMaxMultiplier = 0;

	// --- BG & objets principaux ---
	private bg!: Phaser.GameObjects.TileSprite;
	private ground!: Phaser.GameObjects.TileSprite;
	private houses!: Phaser.GameObjects.TileSprite;
	private runner!: Phaser.GameObjects.Sprite;
	private runnerHitbox!: Phaser.GameObjects.Rectangle;
	private speedText!: Phaser.GameObjects.Text;
	private targetText!: Phaser.GameObjects.Text;
	private spaceKey!: Phaser.Input.Keyboard.Key;
	private stepsText!: Phaser.GameObjects.Text;
	private transitionFrameKeys: string[] = [];
	private walkFrameKeys: string[] = [];
	private transitionAnimationKey = 'idle_to_run';
	private walkAnimationKey = 'walk_loop';
	private isTransitionPlaying = false;
	private isWalkLoopPlaying = false;
	private idleTextureKey = 'character_idle';
	private obstacleTextureKeys: string[] = [];
	private runnerScale = 0.3;

	// Progress UI
	private progressBarBg!: Phaser.GameObjects.Rectangle;
	private progressBarFill!: Phaser.GameObjects.Rectangle;
	private progressBarWidth = 240;
	private progressBarHeight = 18;

	// --- Compteur de pas ---
	private distanceTravelled = 0; // en pixels
	private steps = 0;
	private targetSteps = 10000;
	// combien de pixels équivalent à un pas (ajustable)
	private pxPerStep = 10;
	// multiplicateur pour augmenter le nombre de pas gagnés pour la même distance
	private stepMultiplier = this.isMobile ? 2.5 : 5; // 2 = double les pas pour une même distance
	private goalReached = false;

	// --- Jauge de vitesse (désactivée) ---
	// private gaugeContainer!: Phaser.GameObjects.Container;
	// private gaugeNeedle!: Phaser.GameObjects.Rectangle;
	// private minGaugeAngleDeg = -120;
	// private maxGaugeAngleDeg = 120;

	// --- Zone d'impact au sol (où les obstacles tombent) ---
	private impactZoneX = 0;
	private impactZoneWidth = 120;
	private impactGroundY = 0;
	// indicateur visuel (point d'exclamation rouge) remplace la zone rectangle
	private impactIndicator!: Phaser.GameObjects.Text;

	// --- Obstacles qui tombent du ciel ---
	// maintenant on gère plusieurs obstacles en même temps
	private fallingObstacles: Array<
		Phaser.GameObjects.Rectangle | Phaser.GameObjects.Sprite
	> = [];
	// on utilise un intervalle fixe pour un spawn plus régulier
	private obstacleSpawnInterval = 1.5; // secondes
	private obstacleFallSpeed = 500; // px/s
	private obstacleSpawnTimer = 0;
	private nextObstacleTime = 0;
	private safeSpeedForObstacle = 200; // en dessous → esquive réussie
	// Randomness / jitter pour la fréquence de spawn (en secondes)
	private obstacleSpawnVariance = 0.6; // +/- variance en secondes
	private minObstacleSpawnInterval = 0.4; // intervalle minimal clampé

	constructor() {
		super('MainScene');
	}

	preload() {
		this.transitionFrameKeys = [];
		this.walkFrameKeys = [];
		this.obstacleTextureKeys = [];
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
		const obstacleFiles = [
			'bulle collegue question.png',
			'bulle croissant.png',
			'bulle popcorn.png',
			'bulle taxi.png',
			'bulles mails.png',
			'bulles manettes.png',
		];
		obstacleFiles.forEach((file, index) => {
			const key = `obstacle_${index}`;
			this.obstacleTextureKeys.push(key);
			this.load.image(key, `/assets/obstacles/${file}`);
		});
	}

	create() {
		const { width, height } = this.scale;
		this.isMobile = !this.sys.game.device.os.desktop;

		this.runSpeed = this.isMobile ? 400 : 800;
		this.maxSpeed = this.isMobile ? 900 : 1400;
		this.boostAmount = this.isMobile ? 120 : 220;
		this.decayPerSecond = this.isMobile ? 180 : 500;
		this.extraDecayDelay = this.isMobile ? 0.5 : 0.8;
		this.extraDecayRampDuration = this.isMobile ? 1.0 : 1.5;
		this.extraDecayMaxMultiplier = this.isMobile ? 1.4 : 2.5;
		this.stepMultiplier = this.isMobile ? 10 : 5;
		this.runnerScale = this.isMobile ? 0.32 : 0.25;
		this.speed = 400;

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
		const runnerX = this.isMobile ? width * 0.18 : width * 0.22;
		const runnerY = height * 0.9;
		this.runner = this.add
			.sprite(runnerX, runnerY, this.idleTextureKey)
			.setOrigin(0.5, 1)
			.setScale(this.runnerScale)
			.setDepth(20);
		this.createRunnerAnimations();
		const hitboxWidth = this.runner.displayWidth * 0.45;
		const hitboxHeight = this.runner.displayHeight * 0.7;
		this.runnerHitbox = this.add
			.rectangle(runnerX, runnerY, hitboxWidth, hitboxHeight, 0xff0000, 0.2)
			.setOrigin(0.5, 1)
			.setVisible(false);
		this.playWalkLoop();

		// ===== ZONE D'IMPACT AU SOL =====
		// la zone est vers la droite de l'écran
		this.impactZoneX = width * 0.7;
		this.impactGroundY = this.runner.y; // même "sol" que le runner

		this.impactZoneWidth = 120;

		// ajouter un point d'exclamation rouge comme indicateur
		const exclamSize = this.isMobile ? 48 : 64;
		this.impactIndicator = this.add
			.text(this.impactZoneX, this.impactGroundY, '!', {
				fontFamily: 'Arial',
				fontSize: `${exclamSize}px`,
				color: '#ff0000',
				stroke: '#000000',
				strokeThickness: 6,
			})
			.setOrigin(0.5, 1);

		// ===== TEXTE DEBUG =====
		this.speedText = this.add.text(10, 10, 'Speed: 0', {
			fontSize: '18px',
			color: '#ffffff',
		});
		this.targetText = this.add.text(
			10,
			30,
			'Tape ESPACE / TAP pour accelerer',
			{
				fontSize: '14px',
				color: '#dddddd',
			}
		);

		// compteur de pas
		// UI du compteur centré horizontalement : fond + texte + barre de progression
		const centerX = width / 2;
		const uiCenterY = 60;
		// fond semi-opaque centré
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

		// texte centré
		this.stepsText = this.add
			.text(centerX, uiCenterY - 12, `Pas: 0 / ${this.targetSteps}`, {
				fontSize: '20px',
				color: '#ffffff',
				stroke: '#000000',
				strokeThickness: 4,
				backgroundColor: '#000000',
			})
			.setOrigin(0.5, 0);

		// barre de progression centrée sous le texte
		const barX = centerX - this.progressBarWidth / 2;
		const barY = uiCenterY + 40; // sous le texte
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
		// `this.input` existe à l'exécution; on vérifie pour satisfaire TypeScript
		const input = this.input;
		if (input && input.keyboard) {
			this.spaceKey = input.keyboard.addKey(
				Phaser.Input.Keyboard.KeyCodes.SPACE
			);
			this.spaceKey.on('down', () => this.boost());
		}

		if (input) {
			input.on('pointerdown', () => {
				this.boost();
			});
		}

		// ===== JAUGE =====
		// JAUGE désactivée : le code original reste commenté ci-dessous
		/*
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
        g.arc(
            0,
            0,
            radius,
            toRad(startDeg),
            toRad(startDeg + (midDeg - startDeg) * 0.5),
            false
        );
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

        const centerDot = this.add.circle(0, 0, 6, 0x000000);
        this.gaugeContainer.add(centerDot);
        */

		// ===== INIT OBSTACLES =====
		this.obstacleSpawnTimer = 0;
		// initialiser le prochain intervalle avec un peu de randomness
		this.scheduleNextObstacle();
		this.fallingObstacles = [];
	}

	// Planifie le prochain temps d'apparition d'un obstacle en appliquant
	// un jitter aléatoire autour de `obstacleSpawnInterval`.
	private scheduleNextObstacle() {
		// génère une valeur dans [-obstacleSpawnVariance, +obstacleSpawnVariance]
		const jitter = Phaser.Math.FloatBetween(
			-this.obstacleSpawnVariance,
			this.obstacleSpawnVariance
		);
		const next = this.obstacleSpawnInterval + jitter;
		// clamp pour éviter des intervalles trop courts
		this.nextObstacleTime = Math.max(this.minObstacleSpawnInterval, next);
	}

	// Accélération à chaque ESPACE / TAP
	private boost() {
		const wasStopped = this.speed <= 5;
		this.speed = Math.min(this.speed + this.boostAmount, this.maxSpeed);
		this.timeSinceLastBoost = 0;
		if (wasStopped && this.speed > 0) {
			this.playStartTransition();
		}
		this.targetText.setText(
			`Boost: +${Math.round(this.boostAmount)} | Vitesse: ${Math.round(
				this.speed
			)}`
		);
	}

	update(_time: number, delta: number) {
		const dt = delta / 1000;
		const { width, height } = this.scale;
		const isMobile = !this.sys.game.device.os.desktop;

		if (this.runnerHitbox) {
			this.runnerHitbox.x = this.runner.x;
			this.runnerHitbox.y = this.runner.y;
			const hitboxWidth = this.runner.displayWidth * 0.45;
			const hitboxHeight = this.runner.displayHeight * 0.7;
			this.runnerHitbox.setSize(hitboxWidth, hitboxHeight);
			this.runnerHitbox.setDisplaySize(hitboxWidth, hitboxHeight);
		}

		// ===== 1) VITESSE : acceleration sur tap, freinage naturel =====
		this.timeSinceLastBoost += dt;

		const idleTime = Math.max(
			0,
			this.timeSinceLastBoost - this.extraDecayDelay
		);
		const idleRatio = this.extraDecayRampDuration
			? Phaser.Math.Clamp(idleTime / this.extraDecayRampDuration, 0, 1)
			: 1;
		const baseDecay = this.decayPerSecond * dt;
		const extraDecay =
			this.decayPerSecond * this.extraDecayMaxMultiplier * idleRatio * dt;
		this.speed = Math.max(0, this.speed - baseDecay - extraDecay);
		if (!this.isTransitionPlaying && this.speed <= 5) {
			this.stopWalkLoop();
		}

		// ===== 2) SCROLL DU BG + MOUVEMENT "MONDE" =====

		const scroll = (this.speed / 2) * dt;

		// le décor "bouge"
		this.bg.tilePositionX += scroll / 3;
		if (this.houses) {
			this.houses.tilePositionX += scroll;
		}
		if (this.ground) {
			this.ground.tilePositionX += scroll;
		}

		// Mise à jour du compteur de pas en fonction de la distance parcourue
		if (!this.goalReached) {
			this.distanceTravelled += scroll; // scroll est en pixels parcourus par frame
			// appliquer le multiplicateur pour obtenir plus de pas pour la même distance
			const newSteps = Math.floor(
				(this.distanceTravelled / this.pxPerStep) * this.stepMultiplier
			);
			if (newSteps !== this.steps) {
				this.steps = newSteps;
				// clamp pour éviter d'afficher plus que l'objectif
				const displaySteps = Math.min(this.steps, this.targetSteps);
				this.stepsText.setText(`Pas: ${displaySteps} / ${this.targetSteps}`);
				// mettre à jour la barre
				const ratio = Phaser.Math.Clamp(displaySteps / this.targetSteps, 0, 1);
				this.progressBarFill.width = Math.round(this.progressBarWidth * ratio);
				// animer le texte pour attirer l'attention
				this.tweens.add({
					targets: this.stepsText,
					scale: 1.08,
					duration: 140,
					yoyo: true,
				});
				if (this.steps >= this.targetSteps) {
					this.goalReached = true;
					// feedback visuel : flash vert et message au centre
					this.cameras.main.flash(500, 0, 255, 0);
					const winText = this.add
						.text(
							this.scale.width / 2,
							this.scale.height / 2,
							'Objectif atteint\n10 000 pas',
							{
								fontSize: '28px',
								color: '#ffffff',
								backgroundColor: '#228822',
								padding: { x: 10, y: 10 },
								align: 'center',
							}
						)
						.setOrigin(0.5);
					// petite animation puis garder affiché
					this.tweens.add({
						targets: winText,
						alpha: { from: 0, to: 1 },
						duration: 400,
					});
				}
			}
		}

		// la zone d'impact se déplace avec le monde
		if (this.impactIndicator) {
			this.impactIndicator.x -= scroll;
			this.impactZoneX = this.impactIndicator.x;
		}

		// ===== 3) GESTION DES OBSTACLES QUI TOMBENT =====

		// spawn régulier d'obstacles (possibilité d'avoir plusieurs à la fois)
		this.obstacleSpawnTimer += dt;
		if (this.obstacleSpawnTimer >= this.nextObstacleTime) {
			this.obstacleSpawnTimer = 0;

			const obstacleScale = isMobile ? 0.7 : 1;
			const obstacleSize = 40 * obstacleScale;

			const spawnX = this.impactIndicator ? this.impactIndicator.x : width;
			const newObs = this.createFallingObstacle(
				spawnX + scroll,
				-obstacleSize,
				obstacleSize
			);

			this.fallingObstacles.push(newObs);

			// planifier le prochain spawn avec variance
			this.scheduleNextObstacle();
		}

		// 3.2 Mise à jour de tous les obstacles actifs
		if (this.fallingObstacles.length > 0) {
			const groundY = this.impactGroundY;
			// itérer à l'envers pour pouvoir retirer des éléments du tableau
			for (let i = this.fallingObstacles.length - 1; i >= 0; i--) {
				const o = this.fallingObstacles[i];
				// chute
				o.y += this.obstacleFallSpeed * dt;
				// avance avec le monde
				o.x -= scroll;

				// collision avec le runner ?
				let collided = false;
				if (this.runnerHitbox) {
					collided = Phaser.Geom.Intersects.RectangleToRectangle(
						o.getBounds(),
						this.runnerHitbox.getBounds()
					);
				}

				if (collided) {
					// collision -> flash selon la vitesse
					if (this.speed > this.safeSpeedForObstacle) {
						this.cameras.main.flash(150, 255, 0, 0);
						this.runner.setTint(0xff0000);
					} else {
						this.cameras.main.flash(150, 0, 255, 0);
						this.runner.setTint(0x00ff00);
					}

					o.destroy();
					this.fallingObstacles.splice(i, 1);
				} else if (o.y >= groundY) {
					// touche le sol hors du joueur -> pas de flash, juste détruire
					o.destroy();
					this.fallingObstacles.splice(i, 1);
				} else if (o.y > height + 50) {
					// sortie écran
					o.destroy();
					this.fallingObstacles.splice(i, 1);
				}
			}
		}

		// Si la zone d'impact est passée complètement à gauche et qu'aucun obstacle
		// n'est visible à l'écran (tous hors-écran à gauche ou aucun), on repositionne
		// la zone à droite et on spawn un nouvel obstacle à droite pour continuer la boucle.
		if (this.impactIndicator) {
			const zoneLeft = this.impactIndicator.x - this.impactZoneWidth / 2;
			const anyObstacleVisible = this.fallingObstacles.some(
				(o) => o.getBounds().right > 0
			);
			const allObstaclesOffLeft =
				this.fallingObstacles.length === 0 || !anyObstacleVisible;

			if (zoneLeft < 0 && allObstaclesOffLeft) {
				// repositionner la zone à droite
				this.impactIndicator.x = width + this.impactZoneWidth;
				this.impactZoneX = this.impactIndicator.x;

				// spawn immédiat d'un nouvel obstacle à droite
				const obstacleScale = isMobile ? 0.7 : 1;
				const obstacleSize = 40 * obstacleScale;
				const newObs = this.createFallingObstacle(
					this.impactIndicator.x + scroll,
					-obstacleSize,
					obstacleSize
				);

				this.fallingObstacles.push(newObs);
				// réinitialiser le timer pour garder le rythme
				this.obstacleSpawnTimer = 0;
				// et planifier un nouvel intervalle légèrement aléatoire
				this.scheduleNextObstacle();
			}
		}

		// ===== 4) DEBUG & JAUGE =====

		const firstObsXText =
			this.fallingObstacles.length > 0
				? String(Math.round(this.fallingObstacles[0].x))
				: 'none';
		this.speedText.setText(
			`Speed: ${Math.round(this.speed)} | ZoneX: ${Math.round(
				this.impactZoneX
			)} | ObX: ${firstObsXText}`
		);

		// JAUGE désactivée : mise à jour de l'aiguille commentée
		/*
        const speedRatio = this.runSpeed > 0
            ? Phaser.Math.Clamp(this.speed / this.runSpeed, 0, 1)
            : 0;

        const speedAngleDeg = Phaser.Math.Linear(
            this.minGaugeAngleDeg,
            this.maxGaugeAngleDeg,
            speedRatio
        );
        this.gaugeNeedle.setRotation(Phaser.Math.DegToRad(speedAngleDeg));
        */
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
		this.runner.clearTint();
		this.isWalkLoopPlaying = false;
	}

	private handleResize(gameSize: Phaser.Structs.Size) {
		const { width, height } = gameSize;
		if (this.bg) {
			this.bg.setSize(width, height);
			this.bg.setTilePosition(0, 0);
			this.fitBackgroundToHeight(width, height);
		}
		if (this.houses) {
			this.houses.setSize(width, this.houses.height);
			this.houses.setPosition(0, height - 570);
		}
		if (this.ground) {
			this.ground.setSize(width, this.ground.height);
			this.ground.setPosition(0, height - 270);
		}
		if (this.runner) {
			const runnerX = this.isMobile ? width * 0.18 : width * 0.22;
			const runnerY = height * 0.9;
			this.runner.setPosition(runnerX, runnerY);
			this.runner.setScale(this.runnerScale);
			if (this.runnerHitbox) {
				this.runnerHitbox.setPosition(runnerX, runnerY);
				const hitboxWidth = this.runner.displayWidth * 0.45;
				const hitboxHeight = this.runner.displayHeight * 0.7;
				this.runnerHitbox.setSize(hitboxWidth, hitboxHeight);
				this.runnerHitbox.setDisplaySize(hitboxWidth, hitboxHeight);
			}
			this.impactGroundY = runnerY;
		}
	}

	private fitBackgroundToHeight(width: number, height: number) {
		const texture = this.textures.get('bg');
		const source = texture.getSourceImage() as HTMLImageElement | undefined;
		const frame = this.textures.getFrame('bg');
		const frameHeight = source?.height ?? frame?.height;
		if (!frameHeight || frameHeight === 0) return;
		const scale = height / frameHeight;
		this.bg.setTileScale(scale, scale);
	}

	private createFallingObstacle(
		x: number,
		y: number,
		size: number
	): Phaser.GameObjects.Rectangle | Phaser.GameObjects.Sprite {
		let obs: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Sprite;
		if (this.obstacleTextureKeys.length > 0) {
			const textureKey = Phaser.Utils.Array.GetRandom(this.obstacleTextureKeys);
			const sprite = this.add
				.sprite(x, y, textureKey)
				.setOrigin(0.5, 0.5)
				.setDepth(10);
			const displaySize = this.isMobile ? size : size * 1.2;
			sprite.setDisplaySize(displaySize, displaySize);
			obs = sprite;
		} else {
			obs = this.add
				.rectangle(x, y, size, size, 0xffaa00)
				.setOrigin(0.5, 0.5)
				.setDepth(10);
		}
		return obs;
	}
}
