import * as Phaser from 'phaser';

export interface UiConfig {
	targetSteps: number;
	levelDuration: number;
	isMobile: boolean;
}

export class UIScene extends Phaser.Scene {
	private uiFont = 'ChelseaMarket';
	private uiFontLoaded = false;
	private targetSteps = 10000;
	private levelDuration = 120;
	private isMobile = false;

	private progressCircleBg!: Phaser.GameObjects.Graphics;
	private progressCircleFill!: Phaser.GameObjects.Graphics;
	private progressCircleStroke!: Phaser.GameObjects.Graphics;
	private progressBgContainer!: Phaser.GameObjects.Container;
	private progressCircleRadius = 100;
	private progressCircleCenterX = 0;
	private progressCircleCenterY = 0;
	private currentProgressRatio = 0;

	private stepsCountText!: Phaser.GameObjects.Text;
	private stepsGoalText!: Phaser.GameObjects.Text;
	private stepsIcon!: Phaser.GameObjects.Image;
	private heartsIcons: Phaser.GameObjects.Image[] = [];

	private timeBarBg!: Phaser.GameObjects.Graphics;
	private timeBarFill!: Phaser.GameObjects.Graphics;
	private timeBarWidth = 0;
	private timeBarHeight = 0;
	private timeBarX = 0;
	private timeBarY = 0;

	private tutorialText?: Phaser.GameObjects.Text;
	private tutorialTimer?: Phaser.Time.TimerEvent;

	constructor() {
		super('UIScene');
	}

	init(data: UiConfig) {
		this.targetSteps = data.targetSteps;
		this.levelDuration = data.levelDuration;
		this.isMobile = data.isMobile;
	}

	create() {
		const { width } = this.scale;
		this.progressBgContainer = this.add.container(0, 0).setDepth(6);
		this.progressCircleBg = this.add.graphics();
		this.progressBgContainer.add(this.progressCircleBg);
		if (this.progressBgContainer.postFX) {
			this.progressBgContainer.postFX.addBlur(0, 2, 2, 0.8);
		}
		this.progressCircleStroke = this.add.graphics().setDepth(6);
		this.progressCircleFill = this.add.graphics().setDepth(7);

		const iconSize = this.isMobile ? 20 : 35;
		this.stepsIcon = this.add
			.image(0, 0, 'steps_icon')
			.setOrigin(0.5)
			.setDepth(8);
		this.stepsIcon.setDisplaySize(iconSize, iconSize);
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

		this.timeBarBg = this.add.graphics().setDepth(60);
		this.timeBarFill = this.add.graphics().setDepth(61);
		this.timeBarHeight = this.isMobile ? 14 : 12;

		this.layoutProgressUi(width);
		this.layoutTimeBar(width);
		this.updateTimeBar(1);
		this.ensureUiFontLoaded();

		this.scale.on(
			'resize',
			(size: Phaser.Structs.Size) => {
				this.layoutProgressUi(size.width);
				this.layoutTimeBar(size.width);
			},
			this
		);
	}

	updateSteps(displaySteps: number, ratio: number) {
		if (!this.stepsCountText || !this.progressCircleFill) return;
		const clampedRatio = Phaser.Math.Clamp(ratio, 0, 1);
		this.stepsCountText.setText(String(displaySteps));
		this.currentProgressRatio = clampedRatio;
		this.drawProgressArc(clampedRatio);
		this.tweens.add({
			targets: this.stepsCountText,
			scale: 1.08,
			duration: 140,
			yoyo: true,
		});
	}

	updateTimeBar(ratio: number) {
		if (!this.timeBarBg || !this.timeBarFill) return;
		const clamped = Phaser.Math.Clamp(ratio, 0, 1);
		this.drawTimeBar(clamped);
	}

	showGoalReached(targetSteps: number) {
		const { width, height } = this.scale;
		const winText = this.add
			.text(
				width / 2,
				height / 2,
				`Objectif atteint\n${targetSteps.toLocaleString()} pas`,
				{
					fontFamily: this.uiFont,
					fontSize: this.isMobile ? '28px' : '32px',
					color: '#ffffff',
					backgroundColor: '#228822',
					padding: { x: 10, y: 10 },
					align: 'center',
				}
			)
			.setOrigin(0.5)
			.setDepth(200);

		this.tweens.add({
			targets: winText,
			alpha: { from: 0, to: 1 },
			duration: 400,
		});
	}

	showMessage(message: string) {
		if (this.tutorialTimer) {
			this.tutorialTimer.destroy();
			this.tutorialTimer = undefined;
		}
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
					fontSize,
					color: '#6A225D',
					padding: { x: 20, y: 12 },
					align: 'center',
				}
			)
			.setOrigin(0.5)
			.setDepth(100)
			.setAlpha(0);

		this.tweens.add({
			targets: this.tutorialText,
			alpha: 1,
			y: this.isMobile ? height / 2 - 80 : height * 0.2,
			duration: 400,
			ease: 'Back.easeOut',
			onComplete: () => {
				this.tutorialTimer = this.time.delayedCall(3000, () => {
					if (this.tutorialText) {
						this.tweens.add({
							targets: this.tutorialText,
							alpha: 0,
							duration: 300,
							onComplete: () => {
								this.tutorialText?.destroy();
								this.tutorialText = undefined;
								this.tutorialTimer = undefined;
							},
						});
					}
				});
			},
		});
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
		this.drawTimeBar(this.levelDuration > 0 ? 1 : 0);
	}

	private drawProgressBackground() {
		if (!this.progressCircleBg) return;
		const strokeWidth = this.isMobile ? 6 : 8;
		const innerRadius = Math.max(
			this.progressCircleRadius + (this.isMobile ? 14 : 10),
			10
		);
		this.progressCircleBg.clear();
		this.progressCircleBg.fillStyle(0xffffff, 0.7);
		this.progressCircleBg.fillCircle(
			this.progressCircleCenterX,
			this.progressCircleCenterY,
			innerRadius
		);

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
		this.stepsCountText?.setStyle({ fontFamily: this.uiFont });
		this.stepsGoalText?.setStyle({ fontFamily: this.uiFont });
		this.tutorialText?.setStyle({ fontFamily: this.uiFont });
	}
}
