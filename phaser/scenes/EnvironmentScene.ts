import * as Phaser from 'phaser';

export interface EnvironmentConfig {
	isMobile?: boolean;
}

export class EnvironmentScene extends Phaser.Scene {
	private isMobile = false;
	private bgMorningPair: Phaser.GameObjects.Image[] = [];
	private bgDayPair: Phaser.GameObjects.Image[] = [];
	private bgEveningPair: Phaser.GameObjects.Image[] = [];
	private skyPairs: Phaser.GameObjects.Image[][] = [];
	private skyFadeThresholds = [0.33, 0.66];
	private skySourceHeight = 513;
	private groundHeight = 200;
	private ground!: Phaser.GameObjects.TileSprite;
	private houses!: Phaser.GameObjects.TileSprite;
	private housesHeight = 300;
	private housesScale = 1;
	private currentPhase = 0;
	private isTransitioning = false;
	private tempHouses?: Phaser.GameObjects.TileSprite;
	private tempGround?: Phaser.GameObjects.TileSprite;

	constructor() {
		super('EnvironmentScene');
	}

	init(data?: EnvironmentConfig) {
		this.isMobile = data?.isMobile ?? !this.sys.game.device.os.desktop;
	}

	create() {
		const { width, height } = this.scale;
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

		const initialHousesScale = this.isMobile ? 0.8 : 1;
		this.housesScale = initialHousesScale;
		const adjustedHousesHeight = this.housesHeight * initialHousesScale;

		this.houses = this.add
			.tileSprite(
				0,
				height - this.groundHeight - adjustedHousesHeight,
				width,
				adjustedHousesHeight,
				'houses_phase1'
			)
			.setOrigin(0, 0)
			.setTileScale(initialHousesScale, initialHousesScale);

		this.ground = this.add
			.tileSprite(
				0,
				height - this.groundHeight,
				width,
				this.groundHeight,
				'ground_phase1'
			)
			.setOrigin(0, 0);

		this.scale.on('resize', this.handleResize, this);
	}

	applyScroll(scroll: number) {
		const bgScroll = scroll / 3;
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
		if (this.tempHouses) {
			this.tempHouses.tilePositionX += scroll;
		}
		if (this.tempGround) {
			this.tempGround.tilePositionX += scroll;
		}
	}

	updateSkyFade(ratio: number) {
		if (
			!this.bgMorningPair.length ||
			!this.bgDayPair.length ||
			!this.bgEveningPair.length
		) {
			return;
		}
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

	transitionToPhase(newPhase: number, onComplete?: () => void) {
		if (this.isTransitioning || newPhase < 0 || newPhase > 3) {
			return;
		}
		this.isTransitioning = true;
		const phaseNumber = newPhase + 1;

		let newHousesHeight;
		let newHousesScale = 1;
		const { width, height } = this.scale;

		if (phaseNumber === 1 || phaseNumber === 4) {
			newHousesHeight = 300;
		} else if (phaseNumber === 2) {
			const originalBuldingHeight = 760;
			const targetHeight = height - this.groundHeight;
			newHousesHeight = originalBuldingHeight;
			newHousesScale = targetHeight / originalBuldingHeight;
			if (this.isMobile) {
				newHousesScale *= 0.8;
			}
		} else {
			const originalOfficeHeight = 768;
			const targetHeight = height - this.groundHeight;
			newHousesHeight = originalOfficeHeight;
			newHousesScale = targetHeight / originalOfficeHeight;
			if (this.isMobile) {
				newHousesScale *= 1;
			}
		}
		const scaledHeight = newHousesHeight * newHousesScale;

		this.tempGround = this.add
			.tileSprite(
				0,
				height - this.groundHeight,
				width,
				this.groundHeight,
				`ground_phase${phaseNumber}`
			)
			.setOrigin(0, 0)
			.setDepth(0)
			.setAlpha(0);

		this.tempHouses = this.add
			.tileSprite(
				0,
				height - this.groundHeight - scaledHeight,
				width,
				scaledHeight,
				`houses_phase${phaseNumber}`
			)
			.setOrigin(0, 0)
			.setDepth(0)
			.setTileScale(newHousesScale, newHousesScale)
			.setAlpha(0);

		if (this.ground) {
			this.tempGround.tilePositionX = this.ground.tilePositionX;
		}
		if (this.houses) {
			this.tempHouses.tilePositionX = this.houses.tilePositionX;
		}

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

				this.currentPhase = newPhase;
				this.housesHeight = newHousesHeight;
				this.housesScale = newHousesScale;
				this.isTransitioning = false;
				onComplete?.();
			},
		});
	}

	getCurrentPhase() {
		return this.currentPhase;
	}

	private handleResize(gameSize: Phaser.Structs.Size) {
		const { width, height } = gameSize;
		if (this.skyPairs.length) {
			this.fitBackgroundToHeight(width, height);
		}
		if (this.houses) {
			const newHeight = this.housesHeight * this.housesScale;
			this.houses.setSize(width, newHeight);
			this.houses.setPosition(0, height - this.groundHeight - newHeight);
		}
		if (this.ground) {
			this.ground.setSize(width, this.groundHeight);
			this.ground.setPosition(0, height - this.groundHeight);
		}
		if (this.tempHouses) {
			const newHeight = this.housesHeight * this.housesScale;
			this.tempHouses.setSize(width, newHeight);
			this.tempHouses.setPosition(0, height - this.groundHeight - newHeight);
		}
		if (this.tempGround) {
			this.tempGround.setSize(width, this.groundHeight);
			this.tempGround.setPosition(0, height - this.groundHeight);
		}
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
}
