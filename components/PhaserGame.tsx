"use client";

import { useEffect, useRef } from "react";

export default function PhaserGame() {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const gameRef = useRef<any>(null); // tu peux typer mieux après

    useEffect(() => {
        let isCancelled = false;

        // On est sûr d’être côté client ici
        const loadGame = async () => {
            if (!containerRef.current || gameRef.current) return;

            // 🔥 Import dynamique de Phaser (pas d’SSR)
            const Phaser = await import("phaser");
            const { MainScene } = await import("@/phaser/scenes/MainScene");

            if (isCancelled) return;

            const config: Phaser.Types.Core.GameConfig = {
                type: Phaser.AUTO,
                width: window.innerWidth,
                height: window.innerHeight,
                parent: containerRef.current, // on peut passer directement l’élément
                scene: [MainScene],
                scale: {
                    mode: Phaser.Scale.RESIZE,
                    autoCenter: Phaser.Scale.CENTER_BOTH,
                },
            };

            const game = new Phaser.Game(config);
            gameRef.current = game;
        };

        loadGame();

        return () => {
            isCancelled = true;
            if (gameRef.current) {
                gameRef.current.destroy(true);
                gameRef.current = null;
            }
        };
    }, []);

    return (
        <div
            ref={containerRef}
            style={{ width: "100vw", height: "100vh", overflow: "hidden" }}
        />
    );
}
