'use client';

import { useEffect, useRef } from 'react';
import type PhaserType from 'phaser';

export default function PhaserGame() {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const gameRef = useRef<PhaserType.Game | null>(null);

	useEffect(() => {
		let game: PhaserType.Game | null = null;

		async function loadPhaser() {
			// Charge Phaser et les scènes uniquement côté client pour éviter l'accès SSR à window
			const Phaser = await import('phaser');
			const [{ GameplayScene }, { EnvironmentScene }, { UIScene }] =
				await Promise.all([
					import('@/phaser/scenes/GameplayScene'),
					import('@/phaser/scenes/EnvironmentScene'),
					import('@/phaser/scenes/UIScene'),
				]);
			const scenes = [GameplayScene, EnvironmentScene, UIScene];

			const container = containerRef.current;
			if (!container) return;

			const width = container.clientWidth;
			const height = container.clientHeight;

			game = new Phaser.Game({
				type: Phaser.AUTO,
				width,
				height,
				parent: container,
				scene: scenes,
				scale: {
					mode: Phaser.Scale.RESIZE,
					autoCenter: Phaser.Scale.CENTER_BOTH,
				},
			});

			gameRef.current = game;
		}

		loadPhaser();

		return () => {
			if (gameRef.current) {
				gameRef.current.destroy(true);
			}
		};
	}, []);

	return (
		<div
			ref={containerRef}
			style={{
				position: 'fixed',
				inset: 0,
				width: '100vw',
				height: '100dvh',
				overflow: 'hidden',
				background: 'black',
			}}
		/>
	);
}
