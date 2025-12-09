import * as Phaser from 'phaser';
import { EnvironmentScene } from './EnvironmentScene';
import { UIScene } from './UIScene';

export class GameplayScene extends Phaser.Scene {
	private isMobile = false;
	private speed = 0;
	private maxSpeed = 0;
	private boostAmount = 0;
	private decayPerSecond = 0;
	private timeSinceLastBoost = 0;
	private extraDecayDelay = 0;
	private extraDecayRampDuration = 0;
	private extraDecayMaxMultiplier = 0;

	private runner!: Phaser.GameObjects.Sprite;
	private runnerHitbox!: Phaser.GameObjects.Rectangle;
	private spaceKey!: Phaser.Input.Keyboard.Key;
	private uiFont = 'ChelseaMarket';

	private currentProgressRatio = 0;
	private timeProgressRatio = 0;
	private levelDuration = 120;
	private timeRemaining = 0;
	private isTimeOver = false;
	private transitionFrameKeys: string[] = [];
	private walkFrameKeys: string[] = [];
	private transitionAnimationKey = 'idle_to_run';
	private walkAnimationKey = 'marche loop';
	private isTransitionPlaying = false;
	private isWalkLoopPlaying = false;
	private idleTextureKey = 'character_idle';
	private obstacleTextureKeys: string[] = [];
	private runnerScale = 0.4;

	private distanceTravelled = 0;
	private steps = 0;
	private targetSteps = 10000;
	private pxPerStep = 10;
	private stepMultiplier = 5;
	private goalReached = false;

	private currentPhase = 0;
	private isTransitioning = false;
	private phaseThresholds = [0.25, 0.5, 0.75];
	private lastMilestone = 0;

	private impactZoneX = 0;
	private impactZoneWidth = 120;
	private impactGroundY = 0;
	private impactIndicator!: Phaser.GameObjects.Text;
	private topIndicator!: Phaser.GameObjects.Graphics;

	private fallingObstacles: Array<
		Phaser.GameObjects.Rectangle | Phaser.GameObjects.Sprite
	> = [];
	private obstacleSpawnInterval = 2.5;
	private obstacleFallSpeed = 400;
	private obstacleSpawnTimer = 0;
	private nextObstacleTime = 0;
	private obstacleSpawnVariance = 0.8;
	private minObstacleSpawnInterval = 1.2;

	private bushes: Phaser.GameObjects.Sprite[] = [];
	private bushSpawnTimer = 0;
	private bushSpawnInterval = 4;

	private environment?: EnvironmentScene;
	private uiScene?: UIScene;

	constructor() {
		super('GameplayScene');
	}

	preload() {
		this.transitionFrameKeys = [];
		this.walkFrameKeys = [];
		this.obstacleTextureKeys = [];
		this.load.image('bg_morning', '/assets/ciel matin.png');
		this.load.image('bg_day', '/assets/ciel.png');
		this.load.image('bg_evening', '/assets/ciel soir.png');

		this.load.image('ground_phase1', '/assets/level1/phase1/sol.png');
		this.load.image('houses_phase1', '/assets/level1/phase1/maison.png');
		this.load.image('bush_phase1', '/assets/level1/phase1/plante.png');

		this.load.image('ground_phase2', '/assets/level1/phase2/sol.png');
		this.load.image('houses_phase2', '/assets/level1/phase2/bulding.png');
		this.load.image('bush_phase2', '/assets/level1/phase2/plante.png');

		this.load.image('ground_phase3', '/assets/level1/phase3/sol.png');
		this.load.image('houses_phase3', '/assets/level1/phase3/office.png');

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

		this.maxSpeed = this.isMobile ? 900 : 1400;
		this.boostAmount = this.isMobile ? 200 : 400;
		this.decayPerSecond = this.isMobile ? 500 : 1000;
		this.extraDecayDelay = this.isMobile ? 0.5 : 0.5;
		this.extraDecayRampDuration = this.isMobile ? 1.0 : 1.5;
		this.extraDecayMaxMultiplier = this.isMobile ? 1.4 : 2.5;
		this.stepMultiplier = this.isMobile ? 10 : 5;
		this.runnerScale = this.isMobile ? 0.3 : 0.4;
		this.speed = 0;

		this.scene.launch('EnvironmentScene', { isMobile: this.isMobile });
		this.scene.sendToBack('EnvironmentScene');
		this.scene.launch('UIScene', {
			isMobile: this.isMobile,
			targetSteps: this.targetSteps,
			levelDuration: this.levelDuration,
		});
		this.scene.bringToTop('UIScene');
		this.scene.bringToTop();
		this.environment = this.scene.get('EnvironmentScene') as EnvironmentScene;
		this.uiScene = this.scene.get('UIScene') as UIScene;

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

		this.impactZoneX = width * 0.7;
		this.impactGroundY = height + 100;
		this.impactZoneWidth = 120;

		this.topIndicator = this.add.graphics().setDepth(50);
		this.drawTopIndicator();
		this.tweens.add({
			targets: this.topIndicator,
			alpha: 0.3,
			duration: 400,
			yoyo: true,
			repeat: -1,
			ease: 'Sine.easeInOut',
		});

		this.timeRemaining = this.levelDuration;

		const exclamSize = this.isMobile ? 48 : 64;
		this.impactIndicator = this.add
			.text(this.impactZoneX, this.impactGroundY, '', {
				fontFamily: this.uiFont,
				fontSize: `${exclamSize}px`,
				color: '#ff0000',
				stroke: '#000000',
				strokeThickness: 6,
			})
			.setOrigin(0.5, 1);

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

		this.obstacleSpawnTimer = 0;
		this.scheduleNextObstacle(true);
		this.fallingObstacles = [];

		this.bushSpawnTimer = 0;
		this.bushes = [];

		this.scale.on('resize', this.handleResize, this);
	}

	private scheduleNextObstacle(isInitial: boolean = false) {
		if (isInitial) {
			const reducedDelay = Phaser.Math.FloatBetween(0.0, 1);
			this.nextObstacleTime = reducedDelay;
		} else {
			const jitter = Phaser.Math.FloatBetween(
				-this.obstacleSpawnVariance,
				this.obstacleSpawnVariance
			);
			const next = this.obstacleSpawnInterval + jitter;
			this.nextObstacleTime = Math.max(this.minObstacleSpawnInterval, next);
		}
	}

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

		const scroll = (this.speed / 2) * dt;

		if (!this.goalReached && !this.isTimeOver) {
			this.timeRemaining = Math.max(0, this.timeRemaining - dt);
			this.timeProgressRatio =
				this.levelDuration > 0
					? 1 - this.timeRemaining / this.levelDuration
					: 1;
			this.environment?.updateSkyFade(this.timeProgressRatio);
			this.uiScene?.updateTimeBar(
				this.levelDuration > 0
					? Phaser.Math.Clamp(this.timeRemaining / this.levelDuration, 0, 1)
					: 0
			);
			if (this.timeRemaining <= 0) {
				this.handleTimeUp();
				return;
			}
		}

		if (this.environment) {
			this.environment.applyScroll(scroll);
		}

		if (!this.goalReached) {
			this.distanceTravelled += scroll;
			const newSteps = Math.floor(
				(this.distanceTravelled / this.pxPerStep) * this.stepMultiplier
			);
			if (newSteps !== this.steps) {
				this.steps = newSteps;
				const displaySteps = Math.min(this.steps, this.targetSteps);
				const ratio = Phaser.Math.Clamp(displaySteps / this.targetSteps, 0, 1);
				this.currentProgressRatio = ratio;
				this.uiScene?.updateSteps(displaySteps, ratio);
				this.checkStepMilestones();

				if (!this.isTransitioning) {
					for (let i = 0; i < this.phaseThresholds.length; i++) {
						const threshold = this.phaseThresholds[i];
						const nextPhase = i + 1;
						if (ratio >= threshold && this.currentPhase < nextPhase) {
							this.transitionToPhase(nextPhase);
							break;
						}
					}
				}

				if (this.steps >= this.targetSteps) {
					this.goalReached = true;
					this.cameras.main.flash(500, 0, 255, 0);
					this.uiScene?.showGoalReached(this.targetSteps);
				}
			}
		}

		if (this.impactIndicator) {
			this.impactIndicator.x -= scroll;
			this.impactZoneX = this.impactIndicator.x;
			this.drawTopIndicator();
		}

		this.obstacleSpawnTimer += dt;
		if (this.obstacleSpawnTimer >= this.nextObstacleTime) {
			this.obstacleSpawnTimer = 0;
			const obstacleScale = this.isMobile ? 0.7 : 1;
			const obstacleSize = 80 * obstacleScale;
			const spawnX = this.impactIndicator ? this.impactIndicator.x : width;
			const newObs = this.createFallingObstacle(
				spawnX + scroll,
				-obstacleSize,
				obstacleSize
			);
			this.fallingObstacles.push(newObs);
			this.scheduleNextObstacle();
		}

		if (this.fallingObstacles.length > 0) {
			const groundY = this.impactGroundY;
			for (let i = this.fallingObstacles.length - 1; i >= 0; i--) {
				const o = this.fallingObstacles[i];
				o.y += this.obstacleFallSpeed * dt;
				o.x -= scroll;

				let collided = false;
				if (this.runnerHitbox) {
					collided = Phaser.Geom.Intersects.RectangleToRectangle(
						o.getBounds(),
						this.runnerHitbox.getBounds()
					);
				}

				if (collided) {
					this.cameras.main.flash(150, 255, 0, 0);
					this.uiScene?.showMessage('Oups, prudence !');
					o.destroy();
					this.fallingObstacles.splice(i, 1);
				} else if (o.y >= groundY) {
					o.destroy();
					this.fallingObstacles.splice(i, 1);
				} else if (o.y > height + 50) {
					o.destroy();
					this.fallingObstacles.splice(i, 1);
				}
			}
		}

		if (this.impactIndicator) {
			const zoneLeft = this.impactIndicator.x - this.impactZoneWidth / 2;
			const anyObstacleVisible = this.fallingObstacles.some(
				(o) => o.getBounds().right > 0
			);
			const allObstaclesOffLeft =
				this.fallingObstacles.length === 0 || !anyObstacleVisible;

			if (zoneLeft < 0 && allObstaclesOffLeft) {
				this.impactIndicator.x = width + this.impactZoneWidth;
				this.impactZoneX = this.impactIndicator.x;
				this.obstacleSpawnTimer = 0;
				this.scheduleNextObstacle(true);
			}
		}

		this.bushSpawnTimer += dt;
		if (
			this.bushSpawnTimer >= this.bushSpawnInterval &&
			this.environment?.getCurrentPhase() !== 2
		) {
			this.bushSpawnTimer = 0;
			const bushY = height;
			const bushX = width + 100;
			const bushScale = this.isMobile ? 0.3 : 1;
			const phaseNumber = (this.environment?.getCurrentPhase() ?? 0) + 1;
			const bush = this.add
				.sprite(bushX, bushY, `bush_phase${phaseNumber}`)
				.setOrigin(0.5, 1)
				.setScale(bushScale)
				.setDepth(15);
			this.bushes.push(bush);
			this.bushSpawnInterval = Phaser.Math.FloatBetween(1.5, 4.0);
		}

		for (let i = this.bushes.length - 1; i >= 0; i--) {
			const bush = this.bushes[i];
			bush.x -= scroll * 1.2;
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
			this.uiScene?.showMessage(message);
			this.lastMilestone = milestone;
		}
	}

	private transitionToPhase(newPhase: number) {
		if (this.isTransitioning || newPhase < 0 || newPhase > 3) {
			return;
		}
		this.isTransitioning = true;
		this.environment?.transitionToPhase(newPhase, () => {
			this.currentPhase = newPhase;
			this.bushes.forEach((bush) => bush.destroy());
			this.bushes = [];
			this.isTransitioning = false;
		});
	}

	private drawTopIndicator() {
		if (!this.topIndicator) return;
		this.topIndicator.clear();
		const indicatorWidth = this.impactZoneWidth;
		const indicatorHeight = 8;
		const topY = 0;
		this.topIndicator.fillStyle(0xff0000, 0.8);
		this.topIndicator.fillRect(
			this.impactZoneX - indicatorWidth / 2,
			topY,
			indicatorWidth,
			indicatorHeight
		);
		const arrowSize = 12;
		this.topIndicator.fillStyle(0xff0000, 0.8);
		this.topIndicator.fillTriangle(
			this.impactZoneX - indicatorWidth / 2,
			topY + indicatorHeight,
			this.impactZoneX - indicatorWidth / 2 + arrowSize,
			topY + indicatorHeight,
			this.impactZoneX - indicatorWidth / 2 + arrowSize / 2,
			topY + indicatorHeight + arrowSize
		);
		this.topIndicator.fillTriangle(
			this.impactZoneX + indicatorWidth / 2 - arrowSize,
			topY + indicatorHeight,
			this.impactZoneX + indicatorWidth / 2,
			topY + indicatorHeight,
			this.impactZoneX + indicatorWidth / 2 - arrowSize / 2,
			topY + indicatorHeight + arrowSize
		);
	}

	private handleResize(gameSize: Phaser.Structs.Size) {
		const { width, height } = gameSize;
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
		if (this.impactIndicator) {
			this.impactIndicator.setPosition(this.impactZoneX, this.impactGroundY);
		}
		this.drawTopIndicator();
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
		this.uiScene?.updateTimeBar(0);
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
