// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import {renderWithContext, userEvent} from 'tests/react_testing_utils';
import EmojiMap from 'utils/emoji_map';
import messageHtmlToComponent from 'utils/message_html_to_component';
import {formatText} from 'utils/text_formatting';

import DetailsSection from './details_section';

// Acceptance cases (CA-DT-*) refer to DT-01_definicion.md.

function getDetails() {
    return screen.getByTestId('post-details') as HTMLDetailsElement;
}

describe('components/DetailsSection', () => {
    test('CA-DT-01: starts closed and shows the summary', () => {
        renderWithContext(<DetailsSection summary='Registro'>{'Cuerpo'}</DetailsSection>);

        expect(getDetails().open).toBe(false);
        expect(screen.getByText('Registro').tagName).toBe('SUMMARY');
    });

    test('CA-DT-08: open variant starts open', () => {
        renderWithContext(
            <DetailsSection
                open={true}
                summary='Pasos'
            >
                {'Cuerpo'}
            </DetailsSection>,
        );

        expect(getDetails().open).toBe(true);
    });

    test('CA-DT-02: click opens and closes without changing the summary', async () => {
        renderWithContext(<DetailsSection summary='Registro'>{'Cuerpo'}</DetailsSection>);

        await userEvent.click(screen.getByText('Registro'));
        expect(getDetails().open).toBe(true);

        await userEvent.click(screen.getByText('Registro'));
        expect(getDetails().open).toBe(false);
        expect(screen.getByText('Registro')).toBeInTheDocument();
    });

    test('CA-DT-09: Tab reaches the summary; Enter and Space open and close', async () => {
        renderWithContext(<DetailsSection summary='Registro'>{'Cuerpo'}</DetailsSection>);

        await userEvent.tab();
        expect(screen.getByText('Registro')).toHaveFocus();

        await userEvent.keyboard('{Enter}');
        expect(getDetails().open).toBe(true);

        await userEvent.keyboard(' ');
        expect(getDetails().open).toBe(false);

        await userEvent.keyboard(' ');
        expect(getDetails().open).toBe(true);
    });

    test('CA-DT-11: Enter and Space on the summary do not reach the editor', async () => {
        const onKeyDown = jest.fn();
        renderWithContext(
            <div onKeyDown={onKeyDown}>
                <DetailsSection summary='Registro'>{'Cuerpo'}</DetailsSection>
            </div>,
        );

        await userEvent.tab();
        await userEvent.keyboard('{Enter}');
        await userEvent.keyboard(' ');

        expect(onKeyDown).not.toHaveBeenCalled();
    });

    test('a link in the summary keeps its behavior', async () => {
        renderWithContext(
            <DetailsSection summary={<a href='#x'>{'enlace'}</a>}>{'Cuerpo'}</DetailsSection>,
        );

        await userEvent.click(screen.getByText('enlace'));
        expect(getDetails().open).toBe(false);
    });

    test('CA-DT-03: each rendering keeps its own state', async () => {
        renderWithContext(
            <>
                <DetailsSection summary='Uno'>{'A'}</DetailsSection>
                <DetailsSection summary='Dos'>{'B'}</DetailsSection>
            </>,
        );

        await userEvent.click(screen.getByText('Uno'));

        const [first, second] = screen.getAllByTestId('post-details') as HTMLDetailsElement[];
        expect(first.open).toBe(true);
        expect(second.open).toBe(false);
    });
});

describe('messageHtmlToComponent with collapsible sections', () => {
    const emojiMap = new EmojiMap(new Map());

    function renderMessage(text: string) {
        const html = formatText(text, {}, emojiMap);
        return renderWithContext(<div>{messageHtmlToComponent(html)}</div>);
    }

    test('converts the marker into a section with summary and body', () => {
        const {container} = renderMessage('<details>\n<summary>**Registro**</summary>\n\nFalló\n\n- uno\n</details>');

        const details = container.querySelector('details')!;
        expect(details.open).toBe(false);
        expect(details.querySelector('summary strong')).toHaveTextContent('Registro');
        expect(details.querySelector('.post-details__body p')).toHaveTextContent('Falló');
        expect(details.querySelector('.post-details__body li')).toHaveTextContent('uno');
        expect(container.querySelector('[data-details-section], [data-details-summary], [data-details-body]')).toBeNull();
    });

    test('open variant', () => {
        const {container} = renderMessage('<details open>\n<summary>Pasos</summary>\nx\n</details>');
        expect(container.querySelector('details')!.open).toBe(true);
    });

    test('CA-DT-14: only details and summary are added; attributes from the message are not', () => {
        const {container} = renderMessage('<details><summary><img src=x onerror=alert(1)></summary>\n<script>alert(1)</script>\n</details>');

        expect(container.querySelector('img, script')).toBeNull();
        const details = container.querySelector('details')!;
        expect(details.getAttributeNames().sort()).toEqual(['class', 'data-testid']);
        expect(details.querySelector('summary')!.getAttributeNames().sort()).toEqual(['class', 'tabindex']);
    });
});
