'use client';

import { useTranslations } from 'next-intl';
import Intro from '@/components/Intro';
import PhaserGame from '@/components/PhaserGame';

export default function Home() {
	const t = useTranslations('HomePage');
	return (
		<main>
			<Intro game={1} />
			<PhaserGame />
		</main>
	);
}
