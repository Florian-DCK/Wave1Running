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
	private spaceKey!: Phaser.Input.Keyboard.Key;
	private stepsCountText!: Phaser.GameObjects.Text;
	private stepsGoalText!: Phaser.GameObjects.Text;
	private stepsIcon!: Phaser.GameObjects.Image;
	private heartsIcons: Phaser.GameObjects.Image[] = [];
	private uiFont = 'ChelseaMarket';
	private uiFontLoaded = false;
	private progressCircleBg!: Phaser.GameObjects.Graphics;
	private progressCircleFill!: Phaser.GameObjects.Graphics;
	private progressCircleStroke!: Phaser.GameObjects.Graphics;
	private progressBgContainer!: Phaser.GameObjects.Container;
	private progressCircleRadius = 100;
	private progressCircleCenterX = 0;
	private progressCircleCenterY = 0;
	private currentProgressRatio = 0;
	private transitionFrameKeys: string[] = [];
	private walkFrameKeys: string[] = [];
	private transitionAnimationKey = 'idle_to_run';
	private walkAnimationKey = 'loop run';
	private isTransitionPlaying = false;
	private isWalkLoopPlaying = false;
	private idleTextureKey = 'character_idle';
	private obstacleTextureKeys: string[] = [];
	private runnerScale = 0.4;

	// --- Compteur de pas ---
	private distanceTravelled = 0; // en pixels
	private steps = 0;
	private targetSteps = 10000;
	// combien de pixels équivalent à un pas (ajustable)
	private pxPerStep = 10;
	// multiplicateur pour augmenter le nombre de pas gagnés pour la même distance
	private stepMultiplier = this.isMobile ? 2.5 : 5; // 2 = double les pas pour une même distance
	private goalReached = false;

	// --- Messages de progression ---
	private tutorialText?: Phaser.GameObjects.Text;
	private tutorialTimer?: Phaser.Time.TimerEvent;
	private lastMilestone = 0;

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
	// indicateur visuel en haut de l'écran
	private topIndicator!: Phaser.GameObjects.Graphics;

	// --- Obstacles qui tombent du ciel ---
	// maintenant on gère plusieurs obstacles en même temps
	private fallingObstacles: Array<
		Phaser.GameObjects.Rectangle | Phaser.GameObjects.Sprite
	> = [];
	// on utilise un intervalle fixe pour un spawn plus régulier
	private obstacleSpawnInterval = 2.5; // secondes
	private obstacleFallSpeed = 500; // px/s
	private obstacleSpawnTimer = 0;
	private nextObstacleTime = 0;
	private safeSpeedForObstacle = 200; // en dessous → esquive réussie
	// Randomness / jitter pour la fréquence de spawn (en secondes)
	private obstacleSpawnVariance = 0.8; // +/- variance en secondes
	private minObstacleSpawnInterval = 1.2; // intervalle minimal clampé

	// --- Plantes qui apparaissent au sol ---
	private bushes: Phaser.GameObjects.Sprite[] = [];
	private bushSpawnTimer = 0;
	private bushSpawnInterval = 4; // secondes entre chaque plante

	constructor() {
		super('MainScene');
	}

	preload() {
		this.transitionFrameKeys = [];
		this.walkFrameKeys = [];
		this.obstacleTextureKeys = [];
		this.load.image('bg', '/assets/ciel.png');
		this.load.image('ground', '/assets/level1/phase1/sol.png');
		this.load.image('houses', '/assets/level1/phase1/maison.png');
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
		const walkFrames = 19;
		for (let i = 1; i <= walkFrames; i++) {
			const frameId = i.toString().padStart(5, '0');
			const key = `walk_${frameId}`;
			this.walkFrameKeys.push(key);
			this.load.image(
				key,
				`/assets/animations/marche loop/loop run_${frameId}.png`
			);
		}
		this.load.image('steps_icon', '/assets/Steps.png');
		this.load.image('bush', '/assets/level1/phase1/plante.png');
		this.load.image('hearts_icon', '/assets/vie.png');
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
		this.runnerScale = this.isMobile ? 0.4 : 0.4;
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
			.setDepth(8);
		this.createRunnerAnimations();
		const hitboxWidth = this.runner.displayWidth * 0.45;
		const hitboxHeight = this.runner.displayHeight * 0.7;
		this.runnerHitbox = this.add
			.rectangle(runnerX, runnerY, hitboxWidth, hitboxHeight, 0xff0000, 0.2)
			.setOrigin(0.5, 1)
			.setVisible(false);
		this.playWalkLoop();

		// ===== ZONE D'IMPACT AU SOL =====
		this.impactZoneX = width * 0.7;
		this.impactGroundY = height + 100;

		this.impactZoneWidth = 120;

		// Indicateur visuel en haut de l'écran
		this.topIndicator = this.add.graphics().setDepth(50);
		this.drawTopIndicator();

		// Tween de clignotement pour l'indicateur
		this.tweens.add({
			targets: this.topIndicator,
			alpha: 0.3,
			duration: 400,
			yoyo: true,
			repeat: -1,
			ease: 'Sine.easeInOut',
		});

		// ajouter un point d'exclamation rouge comme indicateur
		const exclamSize = this.isMobile ? 48 : 64;
		this.impactIndicator = this.add
			.text(this.impactZoneX, this.impactGroundY, '', {
				fontFamily: this.uiFont,
				fontSize: `${exclamSize}px`,
				color: '#ff0000',
				stroke: '#000000',
				strokeThickness: 6,
			})
			.setOrigin(0.5, 1); // compteur de pas circulaire
		this.progressBgContainer = this.add.container(0, 0).setDepth(6);
		this.progressCircleBg = this.add.graphics();
		this.progressBgContainer.add(this.progressCircleBg);
		// Appliquer un effet de flou au container
		if (this.progressBgContainer.postFX) {
			this.progressBgContainer.postFX.addBlur(0, 2, 2, 0.8);
		}
		// Contour noir séparé
		this.progressCircleStroke = this.add.graphics().setDepth(6);
		this.progressCircleFill = this.add.graphics().setDepth(7);
		const iconSize = this.isMobile ? 20 : 35;
		this.stepsIcon = this.add
			.image(0, 0, 'steps_icon')
			.setOrigin(0.5)
			.setDepth(8);
		this.stepsIcon.setDisplaySize(iconSize, iconSize);
		// Désactiver le smoothing pour une image plus nette
		const texture = this.textures.get('steps_icon');
		if (texture) {
			texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
		}
		this.stepsCountText = this.add
			.text(0, 0, '0', {
				fontSize: this.isMobile ? '24px' : '24px',
				fontFamily: this.uiFont,
				color: '#111111',
			})
			.setOrigin(0.5)
			.setDepth(8);
		this.stepsGoalText = this.add
			.text(0, 0, `/ ${this.targetSteps} pas`, {
				fontSize: this.isMobile ? '18px' : '18px',
				fontFamily: this.uiFont,
				color: '#111111',
			})
			.setOrigin(0.5)
			.setDepth(8);
		const heartsCount = 3;
		const heartSize = this.isMobile ? 60 : 38;
		this.heartsIcons = [];
		for (let i = 0; i < heartsCount; i++) {
			const heart = this.add
				.image(0, 0, 'hearts_icon')
				.setOrigin(0.5)
				.setDepth(8);
			heart.setDisplaySize(heartSize, heartSize);
			this.heartsIcons.push(heart);
		}
		this.layoutProgressUi(width);
		this.ensureUiFontLoaded();

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

		// ===== INIT OBSTACLES =====
		this.obstacleSpawnTimer = 0;
		// initialiser le prochain intervalle avec un délai initial variable
		this.scheduleNextObstacle(true);
		this.fallingObstacles = [];

		// ===== INIT PLANTES =====
		this.bushSpawnTimer = 0;
		this.bushes = [];
	}

	// Planifie le prochain temps d'apparition d'un obstacle en appliquant
	// un jitter aléatoire autour de `obstacleSpawnInterval`.
	private scheduleNextObstacle(isInitial: boolean = false) {
		if (isInitial) {
			// Pour le premier spawn d'une zone, utiliser un délai réduit et variable
			const reducedDelay = Phaser.Math.FloatBetween(0.0, 1);
			this.nextObstacleTime = reducedDelay;
		} else {
			// génère une valeur dans [-obstacleSpawnVariance, +obstacleSpawnVariance]
			const jitter = Phaser.Math.FloatBetween(
				-this.obstacleSpawnVariance,
				this.obstacleSpawnVariance
			);
			const next = this.obstacleSpawnInterval + jitter;
			// clamp pour éviter des intervalles trop courts
			this.nextObstacleTime = Math.max(this.minObstacleSpawnInterval, next);
		}
	}

	// Accélération à chaque ESPACE / TAP
	private boost() {
		const wasStopped = this.speed <= 5;
		this.speed = Math.min(this.speed + this.boostAmount, this.maxSpeed);
		this.timeSinceLastBoost = 0;
		if (wasStopped && this.speed > 0) {
			this.playStartTransition();
		}
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
				this.stepsCountText.setText(String(displaySteps));
				const ratio = Phaser.Math.Clamp(displaySteps / this.targetSteps, 0, 1);
				this.currentProgressRatio = ratio;
				this.drawProgressArc(ratio);
				// animer le texte pour attirer l'attention
				this.tweens.add({
					targets: this.stepsCountText,
					scale: 1.08,
					duration: 140,
					yoyo: true,
				});

				// Afficher des messages selon le nombre de pas
				this.checkStepMilestones();

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
								fontFamily: this.uiFont,
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
			// Mettre à jour l'indicateur du haut pour qu'il suive la zone d'impact
			this.drawTopIndicator();
		}

		// ===== 3) GESTION DES OBSTACLES QUI TOMBENT =====

		// spawn régulier d'obstacles (possibilité d'avoir plusieurs à la fois)
		this.obstacleSpawnTimer += dt;
		if (this.obstacleSpawnTimer >= this.nextObstacleTime) {
			this.obstacleSpawnTimer = 0;

			const obstacleScale = isMobile ? 0.7 : 1;
			const obstacleSize = 80 * obstacleScale;

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
					// collision -> afficher message "Oups, prudence !"
					if (this.speed > this.safeSpeedForObstacle) {
						this.cameras.main.flash(150, 255, 0, 0);
						this.showTutorialMessage('Oups, prudence !');
					} else {
						this.cameras.main.flash(150, 0, 255, 0);
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

				// Réinitialiser le timer avec un délai variable pour éviter le timing prévisible
				this.obstacleSpawnTimer = 0;
				this.scheduleNextObstacle(true);
			}
		}

		// ===== 4) GESTION DES PLANTES AU SOL =====

		// Spawn de plantes aléatoires
		this.bushSpawnTimer += dt;
		if (this.bushSpawnTimer >= this.bushSpawnInterval) {
			this.bushSpawnTimer = 0;

			// Position aléatoire en hauteur (sur le sol ou légèrement au-dessus)
			const bushY = height;
			const bushX = width + 100; // apparaissent à droite de l'écran

			const bushScale = this.isMobile ? 0.3 : 1;
			const bush = this.add
				.sprite(bushX, bushY, 'bush')
				.setOrigin(0.5, 1)
				.setScale(bushScale)
				.setDepth(15);

			this.bushes.push(bush);

			// Varier l'intervalle de spawn
			this.bushSpawnInterval = Phaser.Math.FloatBetween(1.5, 4.0);
		}

		// Mise à jour des plantes (défilement)
		for (let i = this.bushes.length - 1; i >= 0; i--) {
			const bush = this.bushes[i];
			bush.x -= scroll * 1.2;

			// Supprimer si hors écran à gauche
			if (bush.x < -100) {
				bush.destroy();
				this.bushes.splice(i, 1);
			}
		}

		// ===== 5) DEBUG & JAUGE =====

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

	private checkStepMilestones() {
		let message = '';
		let milestone = 0;

		if (this.steps < 200 && this.lastMilestone < 200) {
			message = 'Evites les bulles de distraction\nen t’arrêtant';
			milestone = 200;
		} else if (this.steps >= 500 && this.lastMilestone < 500) {
			message = 'Continue comme ça ! 💪';
			milestone = 500;
		} else if (this.steps >= 1000 && this.lastMilestone < 1000) {
			message = '1000 pas ! Tu assures !';
			milestone = 1000;
		} else if (this.steps >= 2500 && this.lastMilestone < 2500) {
			message = "25% de l'objectif atteint ! 🎯";
			milestone = 2500;
		} else if (this.steps >= 5000 && this.lastMilestone < 5000) {
			message = 'À mi-chemin ! Ne lâche rien ! 🔥';
			milestone = 5000;
		} else if (this.steps >= 7500 && this.lastMilestone < 7500) {
			message = 'Plus que 2500 pas ! Courage ! 💯';
			milestone = 7500;
		} else if (this.steps >= 9000 && this.lastMilestone < 9000) {
			message = 'Presque là ! Dernier effort ! 🚀';
			milestone = 9000;
		}

		if (message) {
			this.showTutorialMessage(message);
			this.lastMilestone = milestone;
		}
	}

	private showTutorialMessage(message: string) {
		// Annuler l'ancien timer s'il existe
		if (this.tutorialTimer) {
			this.tutorialTimer.destroy();
			this.tutorialTimer = undefined;
		}

		// Détruire l'ancien message s'il existe
		if (this.tutorialText) {
			this.tutorialText.destroy();
		}

		const { width, height } = this.scale;
		const fontSize = this.isMobile ? '20px' : '24px';

		this.tutorialText = this.add
			.text(width / 2, height * 0.1, message, {
				fontFamily: this.uiFont,
				fontSize: fontSize,
				color: '#6A225D',
				padding: { x: 20, y: 12 },
				align: 'center',
			})
			.setOrigin(0.5)
			.setDepth(100)
			.setAlpha(0);

		// Animation d'apparition
		this.tweens.add({
			targets: this.tutorialText,
			alpha: 1,
			y: height * 0.2,
			duration: 400,
			ease: 'Back.easeOut',
			onComplete: () => {
				// Disparition après 3 secondes
				this.tutorialTimer = this.time.delayedCall(3000, () => {
					if (this.tutorialText) {
						this.tweens.add({
							targets: this.tutorialText,
							alpha: 0,
							duration: 300,
							onComplete: () => {
								if (this.tutorialText) {
									this.tutorialText.destroy();
									this.tutorialText = undefined;
								}
								this.tutorialTimer = undefined;
							},
						});
					}
				});
			},
		});
	}

	private drawTopIndicator() {
		if (!this.topIndicator) return;
		this.topIndicator.clear();

		const indicatorWidth = this.impactZoneWidth;
		const indicatorHeight = 8;
		const topY = 0;

		// Ligne rouge en haut de l'écran pour montrer où tombent les obstacles
		this.topIndicator.fillStyle(0xff0000, 0.8);
		this.topIndicator.fillRect(
			this.impactZoneX - indicatorWidth / 2,
			topY,
			indicatorWidth,
			indicatorHeight
		);

		// Petites flèches pointant vers le bas
		const arrowSize = 12;
		this.topIndicator.fillStyle(0xff0000, 0.8);

		// Flèche gauche
		this.topIndicator.fillTriangle(
			this.impactZoneX - indicatorWidth / 2,
			topY + indicatorHeight,
			this.impactZoneX - indicatorWidth / 2 + arrowSize,
			topY + indicatorHeight,
			this.impactZoneX - indicatorWidth / 2 + arrowSize / 2,
			topY + indicatorHeight + arrowSize
		);

		// Flèche droite
		this.topIndicator.fillTriangle(
			this.impactZoneX + indicatorWidth / 2 - arrowSize,
			topY + indicatorHeight,
			this.impactZoneX + indicatorWidth / 2,
			topY + indicatorHeight,
			this.impactZoneX + indicatorWidth / 2 - arrowSize / 2,
			topY + indicatorHeight + arrowSize
		);
	}

	private ensureUiFontLoaded() {
		if (this.uiFontLoaded) {
			this.applyUiFontToTexts();
			return;
		}
		if (typeof document === 'undefined' || !(document as Document).fonts) {
			this.uiFontLoaded = true;
			this.applyUiFontToTexts();
			return;
		}
		const fontSet = (document as Document).fonts;
		// Charger toutes les tailles utilisées
		const fontSizes = ['18px', '24px', '28px', '48px', '64px'];
		const fontPromises = fontSizes.map((size) =>
			fontSet.load(`${size} "${this.uiFont}"`).catch(() => {})
		);

		Promise.all(fontPromises)
			.then(() => {
				this.uiFontLoaded = true;
				this.applyUiFontToTexts();
			})
			.catch(() => {
				this.applyUiFontToTexts();
			});
	}

	private applyUiFontToTexts() {
		if (this.impactIndicator) {
			this.impactIndicator.setStyle({ fontFamily: this.uiFont });
		}
		if (this.stepsCountText) {
			this.stepsCountText.setStyle({ fontFamily: this.uiFont });
		}
		if (this.stepsGoalText) {
			this.stepsGoalText.setStyle({ fontFamily: this.uiFont });
		}
		if (this.tutorialText) {
			this.tutorialText.setStyle({ fontFamily: this.uiFont });
		}
	}

	private layoutProgressUi(width: number) {
		if (!this.progressCircleBg || !this.progressCircleFill) return;
		const desktopRadius = 100;
		this.progressCircleCenterX = this.isMobile ? width / 2 : width - 120;
		this.progressCircleCenterY = this.isMobile ? 150 : 120;
		this.progressCircleRadius = this.isMobile ? 110 : desktopRadius;
		this.drawProgressBackground();
		this.drawProgressArc(this.currentProgressRatio);
		const topOffset = this.isMobile ? 40 : 40;
		const goalOffset = this.isMobile ? 30 : 18;
		const heartsOffset = this.isMobile ? 35 : 35;
		this.stepsIcon?.setPosition(
			this.progressCircleCenterX,
			this.progressCircleCenterY - this.progressCircleRadius + topOffset
		);
		this.stepsCountText?.setPosition(
			this.progressCircleCenterX,
			this.progressCircleCenterY - (this.isMobile ? 8 : 4)
		);
		this.stepsGoalText?.setPosition(
			this.progressCircleCenterX,
			this.progressCircleCenterY + goalOffset
		);
		const heartsSpacing = this.isMobile ? 60 : 30;
		const heartRowY =
			this.progressCircleCenterY + this.progressCircleRadius - heartsOffset;
		const totalWidth = heartsSpacing * (this.heartsIcons.length - 1);
		const startX = this.progressCircleCenterX - totalWidth / 2;
		const heartSize = this.isMobile ? 60 : 25;
		this.heartsIcons.forEach((heart, index) => {
			heart.setDisplaySize(heartSize, heartSize);
			heart.setPosition(startX + heartsSpacing * index, heartRowY);
		});
	}

	private drawProgressBackground() {
		if (!this.progressCircleBg) return;
		const strokeWidth = this.isMobile ? 12 : 8;
		const innerRadius = Math.max(
			this.progressCircleRadius - (this.isMobile ? 14 : 10),
			10
		);

		// Fond blanc semi-transparent avec flou (appliqué via postFX sur le container)
		this.progressCircleBg.clear();
		this.progressCircleBg.fillStyle(0xffffff, 0.7);
		this.progressCircleBg.fillCircle(
			this.progressCircleCenterX,
			this.progressCircleCenterY,
			innerRadius
		);

		// Contour noir (non flouté)
		if (this.progressCircleStroke) {
			this.progressCircleStroke.clear();
			this.progressCircleStroke.lineStyle(strokeWidth, 0x1f1f1f, 1);
			this.progressCircleStroke.strokeCircle(
				this.progressCircleCenterX,
				this.progressCircleCenterY,
				this.progressCircleRadius
			);
		}
	}

	private drawProgressArc(ratio: number) {
		if (!this.progressCircleFill) return;
		this.progressCircleFill.clear();
		const clampedRatio = Phaser.Math.Clamp(ratio, 0, 1);
		if (clampedRatio <= 0) {
			return;
		}
		const strokeWidth = this.isMobile ? 12 : 8;
		const startAngle = Phaser.Math.DegToRad(-90);
		const endAngle = startAngle + Phaser.Math.PI2 * clampedRatio;
		this.progressCircleFill.lineStyle(strokeWidth, 0xffd24d, 1);
		this.progressCircleFill.beginPath();
		this.progressCircleFill.arc(
			this.progressCircleCenterX,
			this.progressCircleCenterY,
			this.progressCircleRadius,
			startAngle,
			endAngle,
			false
		);
		this.progressCircleFill.strokePath();
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
		this.layoutProgressUi(width);
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
