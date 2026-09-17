import { ReactElement } from 'react';
import { screen } from '@testing-library/react';
import { expect } from 'vitest';

import { renderWithProviders } from '~/testkit/renderWithProviders';
import { Box, Column, FullBox, FullColumn, FullRow, Row } from '~/ui/box';
import { Primitive } from '~/ui/box.utils';

const TEST_ID = 'primitive-under-test';

const primitiveElementMap: Record<Primitive, ReactElement> = {
    [Primitive.Box]: <Box data-testid={TEST_ID}>child</Box>,
    [Primitive.Row]: <Row data-testid={TEST_ID}>child</Row>,
    [Primitive.Column]: <Column data-testid={TEST_ID}>child</Column>,
    [Primitive.FullRow]: <FullRow data-testid={TEST_ID}>child</FullRow>,
    [Primitive.FullColumn]: <FullColumn data-testid={TEST_ID}>child</FullColumn>,
    [Primitive.FullBox]: <FullBox data-testid={TEST_ID}>child</FullBox>,
};

export const makeBoxDriver = () => {
    let primitive: Primitive = Primitive.Box;

    return {
        given: {
            primitive: (chosen: Primitive): void => {
                primitive = chosen;
            },
        },
        when: {
            created: (): void => {
                renderWithProviders(primitiveElementMap[primitive]);
            },
        },
        assert: {
            hasClass: (className: string): void => {
                expect(screen.getByTestId(TEST_ID)).toHaveClass(className);
            },
            hasNoLayoutClass: (): void => {
                expect(screen.getByTestId(TEST_ID).className).toBe('');
            },
            rendersChildren: (): void => {
                expect(screen.getByTestId(TEST_ID)).toHaveTextContent('child');
            },
        },
    };
};
