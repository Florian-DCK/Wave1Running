import * as Phaser from 'phaser';
import { EnvironmentScene } from '@/phaser/scenes/EnvironmentScene';
import { GameplayScene } from '@/phaser/scenes/GameplayScene';
import { UIScene } from '@/phaser/scenes/UIScene';

export const createGameConfig = (
	parentId: string
): Phaser.Types.Core.GameConfig => ({
	type: Phaser.AUTO,
	width: window.innerWidth,
	height: window.innerHeight,
	backgroundColor: '#000000',
	parent: parentId, // le conteneur HTML dans lequel Phaser va créer le canvas
	scene: [GameplayScene, EnvironmentScene, UIScene],
	scale: {
		mode: Phaser.Scale.RESIZE,
		autoCenter: Phaser.Scale.CENTER_BOTH,
	},
	physics: {
		default: 'arcade',
		arcade: {
			debug: false,
		},
	},
});
