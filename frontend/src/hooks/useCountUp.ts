// A number that rises to its value over a moment, for the urgent variant's exposed-accounts tile.
// Frame-driven, so it stops the instant the tile leaves the screen; under `prefers-reduced-motion`
// or in still mode it is simply the value, with nothing scheduled.
import { useEffect, useState } from 'react';

import { prefersReducedMotion } from '~/ui/motion';

export enum CountMode {
    Still = 'still',
    CountUp = 'countUp',
}

const COUNT_UP_MS = 1400;

// Read at render, not only in the effect: what the hook returns depends on it, so the decision
// belongs where the value is chosen.
const isCounting = (mode: CountMode): boolean => mode === CountMode.CountUp && !prefersReducedMotion();

// Fast at first, settling into the final figure: the eye reads the number, not the motion.
const easeOutCubic = (progress: number): number => 1 - (1 - progress) ** 3;

export const useCountUp = ({ target, mode }: { target: number; mode: CountMode }): number => {
    // The animated value only. The still path returns the target itself, because a target that
    // arrives in a later render — the summary landing under the tile — would otherwise be shown
    // one commit late: `useState` seeds once, and reconciling in an effect painted the calm
    // tile's "Accounts exposed" as 0 before the figure (BF63).
    const [counted, setCounted] = useState(0);
    const counts = isCounting(mode);

    useEffect(() => {
        if (!counts) return;
        const startedAt = performance.now();
        // The handle of the frame currently waiting, so the cleanup can cancel whichever one it is.
        const pending = { frame: 0 };
        const tick = (now: number): void => {
            const progress = Math.min(1, (now - startedAt) / COUNT_UP_MS);
            setCounted(Math.round(target * easeOutCubic(progress)));
            if (progress < 1) pending.frame = requestAnimationFrame(tick);
        };
        pending.frame = requestAnimationFrame(tick);

        return (): void => {
            cancelAnimationFrame(pending.frame);
        };
    }, [target, counts]);

    return counts ? counted : target;
};
