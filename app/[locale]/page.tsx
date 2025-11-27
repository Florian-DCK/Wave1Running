'use client';

import { useTranslations } from 'next-intl';
import PhaserGame from "@/components/PhaserGame";

export default function Home() {
	const t = useTranslations('HomePage');
	return (
		<main>
            <PhaserGame/>
		</main>
	);
}
