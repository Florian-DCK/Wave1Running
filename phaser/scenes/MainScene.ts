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
	private bgMorningPair: Phaser.GameObjects.Image[] = [];
	private bgDayPair: Phaser.GameObjects.Image[] = [];
	private bgEveningPair: Phaser.GameObjects.Image[] = [];
	private skyPairs: Phaser.GameObjects.Image[][] = [];
	private skyFadeThresholds = [0.33, 0.66];
	private skySourceHeight = 513; // hauteur native des assets ciel
	private groundHeight = 200;
	private ground!: Phaser.GameObjects.TileSprite;
	private houses!: Phaser.GameObjects.TileSprite;
	private housesHeight = 300; // hauteur par défaut pour phase 1
	private housesScale = 1; // scale par défaut
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
	private currentProgressRatio = 0; // basé sur les pas (UI)
	private timeProgressRatio = 0; // basé sur le temps restant pour le fade du ciel
	private levelDuration = 120;
	private timeRemaining = 0;
	private isTimeOver = false;
	private timeBarBg!: Phaser.GameObjects.Graphics;
	private timeBarFill!: Phaser.GameObjects.Graphics;
	private timeBarWidth = 0;
	private timeBarHeight = 0;
	private timeBarX = 0;
	private timeBarY = 0;
	private transitionFrameKeys: string[] = [];
	private walkFrameKeys: string[] = [];
	private transitionAnimationKey = 'idle_to_run';
	private walkAnimationKey = 'marche loop';
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

	// --- Phases du niveau (0 = phase1, 1 = phase2, 2 = phase3, 3 = phase4) ---
	private currentPhase = 0;
	private isTransitioning = false;
	private fadeOverlay?: Phaser.GameObjects.Graphics;
	private phaseThresholds = [0.25, 0.5, 0.75]; // 25%, 50%, 75%
	private tempHouses?: Phaser.GameObjects.TileSprite;
	private tempGround?: Phaser.GameObjects.TileSprite;

	// --- Messages de progression ---
	private tutorialText?: Phaser.GameObjects.Text;
	private tutorialTimer?: Phaser.Time.TimerEvent;
	private lastMilestone = 0;

	// --- Zone d'impact au sol (où les obstacles tombent) ---
	private impactZoneX = 0;
	private impactZoneWidth = 120;
	private impactGroundY = 0;
	// indicateur visuel (point d'exclamation rouge) remplace la zone rectangle
	private impactIndicator!: Phaser.GameObjects.Text;
	// indicateur visuel en haut de l'écran
	private topIndicator!: Phaser.GameObjects.Graphics;

	// --- Obstacles qui tombent du ciel ---
	private fallingObstacles: Array<
		Phaser.GameObjects.Rectangle | Phaser.GameObjects.Sprite
	> = [];
	// on utilise un intervalle fixe pour un spawn plus régulier
	private obstacleSpawnInterval = 2.5; // secondes
	private obstacleFallSpeed = 400; // px/s
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
		this.load.image('bg_morning', '/assets/ciel matin.png');
		this.load.image('bg_day', '/assets/ciel.png');
		this.load.image('bg_evening', '/assets/ciel soir.png');

		// Charger les assets des 4 phases
		// Phase 1: maison + plante
		this.load.image('ground_phase1', '/assets/level1/phase1/sol.png');
		this.load.image('houses_phase1', '/assets/level1/phase1/maison.png');
		this.load.image('bush_phase1', '/assets/level1/phase1/plante.png');

		// Phase 2: bulding + plante
		this.load.image('ground_phase2', '/assets/level1/phase2/sol.png');
		this.load.image('houses_phase2', '/assets/level1/phase2/bulding.png');
		this.load.image('bush_phase2', '/assets/level1/phase2/plante.png');

		// Phase 3: office (pas de plante)
		this.load.image('ground_phase3', '/assets/level1/phase3/sol.png');
		this.load.image('houses_phase3', '/assets/level1/phase3/office.png');

		// Phase 4: maison + plante
		this.load.image('ground_phase4', '/assets/level1/phase4/sol.png');
		this.load.image('houses_phase4', '/assets/level1/phase4/maison.png');
		this.load.image('bush_phase4', '/assets/level1/phase4/plante.png');

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
		const walkFrames = 33;
		for (let i = 1; i <= walkFrames; i++) {
			const frameId = i.toString().padStart(5, '0');
			const key = `walk_${frameId}`;
			this.walkFrameKeys.push(key);
			this.load.image(
				key,
				`/assets/animations/marche loop/marche loop_${frameId}.png`
			);
		}
		this.load.image('steps_icon', '/assets/Steps.png');
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
		this.boostAmount = this.isMobile ? 200 : 400;
		this.decayPerSecond = this.isMobile ? 500 : 1000;
		this.extraDecayDelay = this.isMobile ? 0.5 : 0.5;
		this.extraDecayRampDuration = this.isMobile ? 1.0 : 1.5;
		this.extraDecayMaxMultiplier = this.isMobile ? 1.4 : 2.5;
		this.stepMultiplier = this.isMobile ? 10 : 5;
		this.runnerScale = this.isMobile ? 0.3 : 0.4;
		this.speed = 0;

		// ====== BACKGROUND SCROLLABLE ======

		const skyConfigs = [
			{ key: 'bg_morning', alpha: 1 },
			{ key: 'bg_day', alpha: 0 },
			{ key: 'bg_evening', alpha: 0 },
		];

		this.skyPairs = skyConfigs.map((config) => {
			const left = this.add
				.image(0, 0, config.key)
				.setOrigin(0, 0)
				.setAlpha(config.alpha)
				.setScrollFactor(0);
			const right = this.add
				.image(width, 0, config.key)
				.setOrigin(0, 0)
				.setAlpha(config.alpha)
				.setScrollFactor(0);
			const texture = this.textures.get(config.key);
			if (texture) {
				texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
			}
			return [left, right];
		});
		[this.bgMorningPair, this.bgDayPair, this.bgEveningPair] = this.skyPairs;
		this.fitBackgroundToHeight(width, height);
		this.updateSkyFade(0);
		const groundHeight = this.groundHeight;
		// Ajuster la scale des maisons pour mobile
		const initialHousesScale = this.isMobile ? 0.8 : 1;
		this.housesScale = initialHousesScale;
		const adjustedHousesHeight = this.housesHeight * initialHousesScale;

		this.houses = this.add
			.tileSprite(
				0,
				height - groundHeight - adjustedHousesHeight,
				width,
				adjustedHousesHeight,
				'houses_phase1'
			)
			.setOrigin(0, 0)
			.setTileScale(initialHousesScale, initialHousesScale);
		this.ground = this.add
			.tileSprite(
				0,
				height - groundHeight,
				width,
				groundHeight,
				'ground_phase1'
			)
			.setOrigin(0, 0);
		this.scale.on('resize', this.handleResize, this); // ===== RUNNER =====
		const runnerX = this.isMobile ? width * 0.18 : width * 0.22;
		const runnerY = height * 0.95;
		this.runner = this.add
			.sprite(runnerX, runnerY, this.idleTextureKey)
			.setOrigin(0.5, 1)
			.setScale(this.runnerScale)
			.setDepth(8);
		this.createRunnerAnimations();
		const hitboxWidth = this.runner.displayWidth * 0.2;
		const hitboxHeight = this.runner.displayHeight * 0.7;
		this.runnerHitbox = this.add
			.rectangle(runnerX, runnerY, hitboxWidth, hitboxHeight, 0xff0000, 0.2)
			.setOrigin(0.5, 1.25)
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

		this.timeRemaining = this.levelDuration;
		this.timeBarBg = this.add.graphics().setDepth(60);
		this.timeBarFill = this.add.graphics().setDepth(61);
		this.timeBarHeight = this.isMobile ? 14 : 12;

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
				fontSize: this.isMobile ? '18px' : '24px',
				fontFamily: this.uiFont,
				color: '#111111',
			})
			.setOrigin(0.5)
			.setDepth(8);
		this.stepsGoalText = this.add
			.text(0, 0, `/ ${this.targetSteps} pas`, {
				fontSize: this.isMobile ? '14px' : '18px',
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
		this.layoutTimeBar(width);
		this.updateTimeUi();
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

		// ===== OVERLAY DE FONDU POUR TRANSITIONS =====
		this.fadeOverlay = this.add
			.graphics()
			.setDepth(1000)
			.setScrollFactor(0)
			.setAlpha(0);
		this.fadeOverlay.fillStyle(0xffffff, 1);
		this.fadeOverlay.fillRect(0, 0, width, height);
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
		if (this.isTimeOver || this.goalReached) return;
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

		if (this.isTimeOver) {
			return;
		}

		if (this.runnerHitbox) {
			this.runnerHitbox.x = this.runner.x;
			this.runnerHitbox.y = this.runner.y;
			const hitboxWidth = this.runner.displayWidth * 0.2;
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

		if (!this.goalReached && !this.isTimeOver) {
			this.timeRemaining = Math.max(0, this.timeRemaining - dt);
			this.timeProgressRatio =
				this.levelDuration > 0
					? 1 - this.timeRemaining / this.levelDuration
					: 1;
			this.updateSkyFade(this.timeProgressRatio);
			this.updateTimeUi();
			if (this.timeRemaining <= 0) {
				this.handleTimeUp();
				return;
			}
		}

		// le décor "bouge"
		const bgScroll = scroll / 3;
		// scroll infini manuel pour les ciels (paires d'images)
		if (this.skyPairs.length) {
			this.skyPairs.forEach((pair) => {
				pair.forEach((img) => {
					const w = img.displayWidth;
					img.x -= bgScroll;
					if (img.x <= -w) {
						img.x += w * 2;
					}
				});
			});
		}
		if (this.houses) {
			this.houses.tilePositionX += scroll;
		}
		if (this.ground) {
			this.ground.tilePositionX += scroll;
		}
		// Déplacer aussi les TileSprites temporaires pendant le cross-fade
		if (this.tempHouses) {
			this.tempHouses.tilePositionX += scroll;
		}
		if (this.tempGround) {
			this.tempGround.tilePositionX += scroll;
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

				// Vérifier les changements de phase à 25%, 50%, 75%
				if (!this.isTransitioning) {
					for (let i = 0; i < this.phaseThresholds.length; i++) {
						const threshold = this.phaseThresholds[i];
						const nextPhase = i + 1;

						// Si on vient de dépasser ce seuil et qu'on n'est pas déjà à cette phase
						if (ratio >= threshold && this.currentPhase < nextPhase) {
							console.log(
								`🎯 Déclenchement transition: ratio=${ratio.toFixed(
									3
								)}, threshold=${threshold}, currentPhase=${
									this.currentPhase
								}, nextPhase=${nextPhase}`
							);
							this.transitionToPhase(nextPhase);
							break;
						}
					}
				}
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
					this.cameras.main.flash(150, 255, 0, 0);
					this.showTutorialMessage('Oups, prudence !');

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

		// Spawn de plantes aléatoires (sauf en phase 3)
		this.bushSpawnTimer += dt;
		if (
			this.bushSpawnTimer >= this.bushSpawnInterval &&
			this.currentPhase !== 2
		) {
			this.bushSpawnTimer = 0;

			// Position aléatoire en hauteur (sur le sol ou légèrement au-dessus)
			const bushY = height;
			const bushX = width + 100; // apparaissent à droite de l'écran

			const bushScale = this.isMobile ? 0.3 : 1;
			const phaseNumber = this.currentPhase + 1; // phase 0 = phase1, etc.
			const bush = this.add
				.sprite(bushX, bushY, `bush_phase${phaseNumber}`)
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
			.text(
				width / 2,
				this.isMobile ? height / 2 - 70 : height * 0.1,
				message,
				{
					fontFamily: this.uiFont,
					fontSize: fontSize,
					color: '#6A225D',
					padding: { x: 20, y: 12 },
					align: 'center',
				}
			)
			.setOrigin(0.5)
			.setDepth(100)
			.setAlpha(0);

		// Animation d'apparition
		this.tweens.add({
			targets: this.tutorialText,
			alpha: 1,
			y: this.isMobile ? height / 2 - 80 : height * 0.2,
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

	private transitionToPhase(newPhase: number) {
		if (this.isTransitioning || newPhase < 0 || newPhase > 3) {
			return;
		}

		this.isTransitioning = true;
		const phaseNumber = newPhase + 1; // phase 0 = phase1, etc.

		if (!this.fadeOverlay) {
			this.isTransitioning = false;
			return;
		}

		// Déterminer la hauteur selon la phase
		let newHousesHeight;
		let newHousesScale = 1;
		const { width, height } = this.scale;
		const groundHeight = this.groundHeight;

		if (phaseNumber === 1 || phaseNumber === 4) {
			newHousesHeight = 300; // Phase 1 et 4: maison
		} else if (phaseNumber === 2) {
			const originalBuldingHeight = 760;
			const targetHeight = height - groundHeight;
			newHousesHeight = originalBuldingHeight;
			newHousesScale = targetHeight / originalBuldingHeight;
			// Ajuster la scale pour mobile si nécessaire
			if (this.isMobile) {
				newHousesScale *= 0.8; // 0.8 = 80% de la taille desktop
			}
		} else {
			const originalOfficeHeight = 768;
			const targetHeight = height - groundHeight;
			newHousesHeight = originalOfficeHeight;
			newHousesScale = targetHeight / originalOfficeHeight;
			// Ajuster la scale pour mobile si nécessaire
			if (this.isMobile) {
				newHousesScale *= 1; // 0.8 = 80% de la taille desktop
			}
		}
		const scaledHeight = newHousesHeight * newHousesScale;

		// Créer les nouveaux TileSprites pour la nouvelle phase (en dessous des anciens)
		this.tempGround = this.add
			.tileSprite(
				0,
				height - groundHeight,
				width,
				groundHeight,
				`ground_phase${phaseNumber}`
			)
			.setOrigin(0, 0)
			.setDepth(0)
			.setAlpha(0);

		this.tempHouses = this.add
			.tileSprite(
				0,
				height - groundHeight - scaledHeight,
				width,
				scaledHeight,
				`houses_phase${phaseNumber}`
			)
			.setOrigin(0, 0)
			.setDepth(0)
			.setTileScale(newHousesScale, newHousesScale)
			.setAlpha(0);

		// Copier la position de scroll des anciens TileSprites
		if (this.ground) {
			this.tempGround.tilePositionX = this.ground.tilePositionX;
		}
		if (this.houses) {
			this.tempHouses.tilePositionX = this.houses.tilePositionX;
		}

		// Cross-fade: ancien fade out, nouveau fade in
		const crossFadeDuration = 1000;

		this.tweens.add({
			targets: [this.ground, this.houses],
			alpha: 0,
			duration: crossFadeDuration,
			ease: 'Sine.easeInOut',
		});

		this.tweens.add({
			targets: [this.tempGround, this.tempHouses],
			alpha: 1,
			duration: crossFadeDuration,
			ease: 'Sine.easeInOut',
			onComplete: () => {
				console.log('🏁 Cross-fade TERMINÉE');

				// Remplacer les anciens TileSprites par les nouveaux
				if (this.ground) {
					this.ground.destroy();
				}
				if (this.houses) {
					this.houses.destroy();
				}

				this.ground = this.tempGround!;
				this.houses = this.tempHouses!;
				this.tempGround = undefined;
				this.tempHouses = undefined;

				// Mettre à jour les propriétés
				this.currentPhase = newPhase;
				this.housesHeight = newHousesHeight;
				this.housesScale = newHousesScale;

				// Détruire les anciennes plantes
				this.bushes.forEach((bush) => bush.destroy());
				this.bushes = [];

				this.isTransitioning = false;
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
		const fontSizes = ['14px', '18px', '24px', '28px', '48px', '64px'];
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
		this.progressCircleRadius = this.isMobile ? 70 : desktopRadius;
		this.drawProgressBackground();
		this.drawProgressArc(this.currentProgressRatio);
		const topOffset = this.isMobile ? 25 : 40;
		const goalOffset = this.isMobile ? 10 : 18;
		const heartsOffset = this.isMobile ? 30 : 35;
		this.stepsIcon?.setPosition(
			this.progressCircleCenterX,
			this.progressCircleCenterY - this.progressCircleRadius + topOffset
		);
		this.stepsCountText?.setPosition(
			this.progressCircleCenterX,
			this.progressCircleCenterY - (this.isMobile ? 4 : 4)
		);
		this.stepsGoalText?.setPosition(
			this.progressCircleCenterX,
			this.progressCircleCenterY + goalOffset
		);
		const heartsSpacing = this.isMobile ? 25 : 30;
		const heartRowY =
			this.progressCircleCenterY + this.progressCircleRadius - heartsOffset;
		const totalWidth = heartsSpacing * (this.heartsIcons.length - 1);
		const startX = this.progressCircleCenterX - totalWidth / 2;
		const heartSize = this.isMobile ? 20 : 25;
		this.heartsIcons.forEach((heart, index) => {
			heart.setDisplaySize(heartSize, heartSize);
			heart.setPosition(startX + heartsSpacing * index, heartRowY);
		});
	}

	private layoutTimeBar(width: number) {
		if (!this.timeBarBg || !this.timeBarFill) return;
		const margin = this.isMobile ? 24 : 32;
		const topOffset = 26;
		this.timeBarHeight = this.isMobile ? 12 : 12;
		this.timeBarWidth = this.isMobile
			? width - margin
			: Math.max(200, width / 2);
		this.timeBarX = width / 2 - this.timeBarWidth / 2;
		this.timeBarY = topOffset;
		this.drawTimeBar(
			this.levelDuration > 0
				? Phaser.Math.Clamp(this.timeRemaining / this.levelDuration, 0, 1)
				: 0
		);
	}

	private drawProgressBackground() {
		if (!this.progressCircleBg) return;
		const strokeWidth = this.isMobile ? 6 : 8;
		const innerRadius = Math.max(
			this.progressCircleRadius + (this.isMobile ? 14 : 10),
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

	private drawTimeBar(ratio: number) {
		if (!this.timeBarBg || !this.timeBarFill) return;
		const clamped = Phaser.Math.Clamp(ratio, 0, 1);
		this.timeBarBg.clear();
		this.timeBarBg.fillStyle(0x000000, 0.35);
		this.timeBarBg.fillRoundedRect(
			this.timeBarX - 2,
			this.timeBarY - 2,
			this.timeBarWidth + 4,
			this.timeBarHeight + 4,
			6
		);
		this.timeBarFill.clear();
		if (clamped <= 0) {
			return;
		}
		const fillColor = 0x6607a6;
		this.timeBarFill.fillStyle(fillColor, 0.95);
		this.timeBarFill.fillRoundedRect(
			this.timeBarX,
			this.timeBarY,
			this.timeBarWidth * clamped,
			this.timeBarHeight,
			4
		);
	}

	private updateTimeUi() {
		const ratio =
			this.levelDuration > 0
				? Phaser.Math.Clamp(this.timeRemaining / this.levelDuration, 0, 1)
				: 0;
		this.drawTimeBar(ratio);
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

	private updateSkyFade(ratio: number) {
		if (!this.bgMorningPair.length || !this.bgDayPair.length || !this.bgEveningPair.length)
			return;
		const setPairAlpha = (pair: Phaser.GameObjects.Image[], alpha: number) => {
			pair.forEach((img) => img.setAlpha(alpha));
		};
		const clamped = Phaser.Math.Clamp(ratio, 0, 1);
		const [phaseOne, phaseTwo] = this.skyFadeThresholds;

		if (clamped <= phaseOne) {
			setPairAlpha(this.bgMorningPair, 1);
			setPairAlpha(this.bgDayPair, 0);
			setPairAlpha(this.bgEveningPair, 0);
			return;
		}

		if (clamped <= phaseTwo) {
			const t = Phaser.Math.Clamp(
				(clamped - phaseOne) / (phaseTwo - phaseOne),
				0,
				1
			);
			setPairAlpha(this.bgMorningPair, 1 - t);
			setPairAlpha(this.bgDayPair, t);
			setPairAlpha(this.bgEveningPair, 0);
			return;
		}

		const t = Phaser.Math.Clamp((clamped - phaseTwo) / (1 - phaseTwo), 0, 1);
		setPairAlpha(this.bgMorningPair, 0);
		setPairAlpha(this.bgDayPair, 1 - t);
		setPairAlpha(this.bgEveningPair, t);
	}

	private handleResize(gameSize: Phaser.Structs.Size) {
		const { width, height } = gameSize;
		if (this.skyPairs.length) {
			this.fitBackgroundToHeight(width, height);
			this.updateSkyFade(this.timeProgressRatio);
		}
		const groundHeight = this.groundHeight;
		if (this.houses) {
			this.houses.setSize(width, this.housesHeight);
			this.houses.setPosition(0, height - groundHeight - this.housesHeight);
		}
		if (this.ground) {
			this.ground.setSize(width, groundHeight);
			this.ground.setPosition(0, height - groundHeight);
		}
		if (this.runner) {
			const runnerX = this.isMobile ? width * 0.18 : width * 0.22;
			const runnerY = height * 0.95;
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
		if (this.fadeOverlay) {
			this.fadeOverlay.clear();
			this.fadeOverlay.fillStyle(0xffffff, 1);
			this.fadeOverlay.fillRect(0, 0, width, height);
		}
		this.layoutProgressUi(width);
		this.layoutTimeBar(width);
	}

	private fitBackgroundToHeight(width: number, height: number) {
		if (!this.skyPairs.length) return;
		const targetHeight = height;
		const targetY = 0;
		this.skyPairs.forEach((pair) => {
			const key = pair[0].texture.key;
			const texture = this.textures.get(key);
			const source = texture.getSourceImage() as HTMLImageElement | undefined;
			const frame = this.textures.getFrame(key);
			const frameHeight =
				source?.height ?? frame?.height ?? this.skySourceHeight;
			const frameWidth = source?.width ?? frame?.width ?? frameHeight;
			if (!frameHeight || frameHeight <= 0 || !frameWidth || frameWidth <= 0)
				return;
			const scale = targetHeight / frameHeight;
			const scaledWidth = frameWidth * scale;
			pair.forEach((img, idx) => {
				img.setScale(scale, scale);
				img.setPosition(idx === 0 ? 0 : scaledWidth, targetY);
			});
		});
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

	private handleTimeUp() {
		if (this.isTimeOver) return;
		this.isTimeOver = true;
		this.timeRemaining = 0;
		this.updateTimeUi();
		this.speed = 0;
		this.stopWalkLoop();
		this.fallingObstacles.forEach((obs) => obs.destroy());
		this.fallingObstacles = [];
		this.bushes.forEach((bush) => bush.destroy());
		this.bushes = [];
		const { width, height } = this.scale;
		this.cameras.main.flash(300, 255, 64, 64);
		this.add
			.text(width / 2, height / 2, 'Temps écoulé', {
				fontFamily: this.uiFont,
				fontSize: this.isMobile ? '28px' : '32px',
				color: '#ffffff',
				backgroundColor: '#d32f2f',
				padding: { x: 18, y: 12 },
				align: 'center',
			})
			.setOrigin(0.5)
			.setDepth(200);
	}
}
