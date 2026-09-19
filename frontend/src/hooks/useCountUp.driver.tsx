import { expect, vi } from 'vitest';
import { act, type ReactElement, useState } from 'react';

import { aMediaQueryList } from '~/testkit/media-query';
import { CountMode, useCountUp } from '~/hooks/useCountUp';
import { renderWithProviders } from '~/testkit/renderWithProviders';

// Every value the hook has handed a renderer, in order — not just the one on screen when the
// test looks. A tile that paints a stale zero for one commit and the right figure on the next is
// indistinguishable from a correct one by the DOM alone, because `act` flushes the effect before
// any assertion runs. The list is what makes that one commit visible (BF63).
export type CountUpDriver = {
    given: { theVisitorPrefersReducedMotion: () => void };
    when: {
        created: (start: { target: number; mode: CountMode }) => Promise<void>;
        theFigureArrives: (target: number) => Promise<void>;
        framesPass: (count: number) => Promise<void>;
    };
    assert: {
        everyValueShownSinceWas: (value: number) => void;
        valueShownIsBelow: (target: number) => void;
        valueShownIs: (target: number) => void;
    };
};

// One frame of the count-up, in the clock it runs on.
const FRAME_MS = 16;

export const makeCountUpDriver = (): CountUpDriver => {
    const shown: number[] = [];
    let reducedMotion = false;
    let mode = CountMode.Still;
    let shownWhenTheFigureArrived = 0;
    // Assigned during the host's render: a test-only handle on the prop the tile's parent owns,
    // so the figure can land in a later render the way the summary's does.
    let sendFigure: ((target: number) => void) | undefined = undefined;
    // Only the frame clock, as the summary's driver fakes it: promises stay real.
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });

    const Host = ({ start }: { start: number }): ReactElement => {
        const [target, setTarget] = useState(start);
        sendFigure = setTarget;
        const value = useCountUp({ target, mode });
        shown.push(value);

        return <span>{value}</span>;
    };

    const lastShown = (): number => {
        const last = shown.at(-1);
        if (last === undefined) throw new Error('CountUpDriver: nothing has been rendered yet');

        return last;
    };

    return {
        given: {
            theVisitorPrefersReducedMotion: (): void => {
                reducedMotion = true;
            },
        },
        when: {
            created: async (start: { target: number; mode: CountMode }): Promise<void> => {
                mode = start.mode;
                window.matchMedia = (media: string): MediaQueryList =>
                    aMediaQueryList({ media, matches: reducedMotion && media.includes('prefers-reduced-motion') });
                await act(async () => {
                    renderWithProviders(<Host start={start.target} />);
                });
            },
            // The figure the tile was waiting for lands, and the hook is rendered with it.
            theFigureArrives: async (target: number): Promise<void> => {
                const send = sendFigure;
                if (send === undefined) throw new Error('CountUpDriver: when.created first');
                shownWhenTheFigureArrived = shown.length;
                await act(async () => {
                    send(target);
                });
            },
            framesPass: async (count: number): Promise<void> => {
                await act(async () => {
                    vi.advanceTimersByTime(count * FRAME_MS);
                });
            },
        },
        assert: {
            // Every render since the figure landed, so a one-commit flash of the wrong number
            // fails where "what the DOM holds now" passes.
            everyValueShownSinceWas: (value: number): void => {
                const since = shown.slice(shownWhenTheFigureArrived);
                expect(since.length).toBeGreaterThan(0);
                expect(since.filter((rendered) => rendered !== value)).toStrictEqual([]);
            },
            valueShownIsBelow: (target: number): void => {
                expect(lastShown()).toBeLessThan(target);
            },
            valueShownIs: (target: number): void => {
                expect(lastShown()).toBe(target);
            },
        },
    };
};
