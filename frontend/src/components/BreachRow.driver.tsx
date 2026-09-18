import { act } from 'react';
import { expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { aBreachDTO } from '~/testkit/builders';
import { BreachRow } from '~/components/BreachRow';
import { type BreachDTO, fromDTO } from '~/models/breach';
import { renderWithProviders } from '~/testkit/renderWithProviders';
import { badgeTestId, BreachRowTestIds } from '~/components/BreachRow.utils';

import styles from '~/components/BreachRow.module.scss';

export type BreachRowDriver = {
    given: { theBreach: (breach: BreachDTO) => void };
    when: { created: () => Promise<void> };
    click: { toggleDetails: () => Promise<void> };
    assert: {
        titleReads: (title: string) => void;
        metaReads: (meta: string) => void;
        badgeIsHighlighted: (dataClass: string) => void;
        badgeIsPlain: (dataClass: string) => void;
        verifiedMarkIsShown: () => void;
        verifiedMarkIsNotShown: () => void;
        descriptionIsShown: (description: string) => void;
        descriptionIsNotShown: () => void;
        toggleIsNamed: (name: string) => void;
    };
};

export const makeBreachRowDriver = (): BreachRowDriver => {
    const user = userEvent.setup();
    let dto = aBreachDTO().build();

    const badge = (dataClass: string): HTMLElement => screen.getByTestId(badgeTestId(dataClass));

    return {
        given: {
            theBreach: (breach: BreachDTO): void => {
                dto = breach;
            },
        },
        when: {
            created: async (): Promise<void> => {
                await act(async () => {
                    renderWithProviders(<BreachRow breach={fromDTO(dto)} />);
                });
            },
        },
        click: {
            toggleDetails: async (): Promise<void> => {
                await user.click(screen.getByTestId(BreachRowTestIds.Toggle));
            },
        },
        assert: {
            titleReads: (title: string): void => {
                expect(screen.getByTestId(BreachRowTestIds.Title)).toHaveTextContent(title);
            },
            metaReads: (meta: string): void => {
                expect(screen.getByTestId(BreachRowTestIds.Meta)).toHaveTextContent(meta);
            },
            // The design's "visually distinct": jsdom computes no stylesheet, so the class that
            // carries the danger pair is the observable; the visual pass measures the colour.
            badgeIsHighlighted: (dataClass: string): void => {
                expect(badge(dataClass)).toHaveClass(styles.badgeDanger ?? 'badgeDanger');
            },
            badgeIsPlain: (dataClass: string): void => {
                expect(badge(dataClass)).not.toHaveClass(styles.badgeDanger ?? 'badgeDanger');
            },
            verifiedMarkIsShown: (): void => {
                expect(screen.getByTestId(BreachRowTestIds.Verified)).toBeInTheDocument();
            },
            verifiedMarkIsNotShown: (): void => {
                expect(screen.queryByTestId(BreachRowTestIds.Verified)).not.toBeInTheDocument();
            },
            descriptionIsShown: (description: string): void => {
                expect(screen.getByTestId(BreachRowTestIds.Description)).toHaveTextContent(description);
                expect(screen.getByTestId(BreachRowTestIds.Toggle)).toHaveAttribute('aria-expanded', 'true');
            },
            descriptionIsNotShown: (): void => {
                expect(screen.queryByTestId(BreachRowTestIds.Description)).not.toBeInTheDocument();
                expect(screen.getByTestId(BreachRowTestIds.Toggle)).toHaveAttribute('aria-expanded', 'false');
            },
            toggleIsNamed: (name: string): void => {
                expect(screen.getByTestId(BreachRowTestIds.Toggle)).toHaveAccessibleName(name);
            },
        },
    };
};
