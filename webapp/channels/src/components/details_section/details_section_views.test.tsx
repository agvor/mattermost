// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Post} from '@mattermost/types/posts';

import type {Theme} from 'mattermost-redux/selectors/entities/preferences';

import PostMessageView from 'components/post_view/post_message_view/post_message_view';
import Textbox from 'components/textbox/textbox';

import {fireEvent, renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

// DT-03: the collapsible section in the three views of a message (DT-01, section 1.2).
// The preview while writing and the edition use Textbox with preview; the published message uses
// PostMessageView. Acceptance cases (CA-DT-*) refer to DT-01_definicion.md.

jest.mock('components/properties_card_view/propertyValueRenderer/post_preview_property_renderer/post_preview_property_renderer', () => {
    return jest.fn(() => <div/>);
});

jest.mock('plugins/pluggable', () => {
    return jest.fn(() => null);
});

const V1 = [
    '<details>',
    '<summary>Registro del error</summary>',
    '',
    'El servicio respondió **500**.',
    '',
    '```js',
    'console.log(1);',
    '```',
    '</details>',
].join('\n');

const V2 = [
    '<details open>',
    '<summary>Pasos</summary>',
    '',
    '- Uno',
    '- Dos',
    '</details>',
].join('\n');

const V3_V4 = [
    'Antes de la sección',
    '',
    '<details><summary>**Importante:** `config.json` :smile:</summary>',
    '',
    'Ver https://mattermost.com',
    '</details>',
    '',
    'Después de la sección',
].join('\n');

const ORDINARY = [
    '# Título',
    '',
    'Texto con **negrita**, _cursiva_, `código` y https://mattermost.com.',
    '',
    '- Uno',
    '- Dos',
    '',
    '> Cita con <details> como texto',
    '',
    '```',
    '<details>',
    '<summary>Dentro de código</summary>',
    '</details>',
    '```',
].join('\n');

const textboxProps = {
    id: 'post_textbox',
    channelId: 'channel_id',
    onChange: jest.fn(),
    onKeyPress: jest.fn(),
    onKeyDown: jest.fn(),
    onKeyUp: jest.fn(),
    createMessage: 'Escribe un mensaje',
    characterLimit: 16383,
    currentUserId: 'current_user_id',
    currentTeamId: 'current_team_id',
    autocompleteGroups: null,
    delayChannelAutocomplete: false,
    useChannelMentions: true,
    actions: {
        autocompleteUsersInChannel: jest.fn().mockResolvedValue({data: true}),
        autocompleteChannels: jest.fn().mockResolvedValue({data: true}),
        searchAssociatedGroupsForReference: jest.fn().mockResolvedValue({data: true}),
        fetchAgents: jest.fn().mockResolvedValue({data: []}),
    },
};

const postMessageViewProps = {
    enableFormatting: true,
    options: {},
    compactDisplay: false,
    isRHS: false,
    isRHSOpen: false,
    isRHSExpanded: false,
    theme: {} as Theme,
    pluginPostTypes: {},
    currentRelativeTeamUrl: 'team_url',
    isChannelAutotranslated: false,
    userLanguage: 'en',
};

function makePost(message: string): Post {
    return {
        id: 'post_id',
        channel_id: 'channel_id',
        user_id: 'user_id',
        message,
        props: {},
        metadata: {},
    } as unknown as Post;
}

function renderPreview(message: string) {
    return renderWithContext(
        <Textbox
            {...textboxProps}
            value={message}
            preview={true}
        />,
    );
}

function renderPublished(message: string) {
    return renderWithContext(
        <PostMessageView
            {...postMessageViewProps}
            post={makePost(message)}
        />,
    );
}

// Structure of each section: initial state, summary and body, without React-generated ids.
function describeSections(container: HTMLElement) {
    return Array.from(container.querySelectorAll('details')).map((details) => ({
        open: details.open,
        summary: details.querySelector('summary')?.innerHTML,
        body: details.querySelector('.post-details__body')?.innerHTML,
    }));
}

function getMarkdownHtml(container: HTMLElement, selector: string) {
    return container.querySelector(selector)?.innerHTML;
}

describe('DT-03: collapsible section in the views of a message', () => {
    test.each([
        ['V1', V1, [false]],
        ['V2', V2, [true]],
        ['V3 and V4', V3_V4, [false]],
    ])('CA-DT-05: %s has the same structure and initial state in the preview, the edition and the published message', (_, message, expectedOpen) => {
        const preview = describeSections(renderPreview(message).container);
        const published = describeSections(renderPublished(message).container);

        expect(preview.map((s) => s.open)).toEqual(expectedOpen);
        expect(preview[0].summary).toBeTruthy();
        expect(published).toEqual(preview);
    });

    test('CA-DT-04, CA-DT-07: formatting in the summary and the body is the same in every view', () => {
        const {container} = renderPublished(V3_V4);
        const summary = container.querySelector('summary')!;

        expect(summary.querySelector('strong')?.textContent).toBe('Importante:');
        expect(summary.querySelector('code')?.textContent).toBe('config.json');
        expect(summary.querySelector('.emoticon')).not.toBeNull();
        expect(container.querySelector('.post-details__body a')?.getAttribute('href')).toBe('https://mattermost.com');
        expect(screen.getByText('Antes de la sección')).toBeInTheDocument();
        expect(screen.getByText('Después de la sección')).toBeInTheDocument();
    });

    test('CA-DT-03: opening the section in one view does not change another view of the same message', async () => {
        const author = renderPublished(V1);
        const reader = renderPublished(V1);

        await userEvent.click(author.container.querySelector('summary')!);

        expect(author.container.querySelector('details')!.open).toBe(true);
        expect(reader.container.querySelector('details')!.open).toBe(false);
    });

    test('CA-DT-06: editing a message to add, change or remove the section shows the change', () => {
        const {container, rerender} = renderPublished('Mensaje sin sección');
        expect(container.querySelector('details')).toBeNull();

        rerender(
            <PostMessageView
                {...postMessageViewProps}
                post={makePost(V1)}
            />,
        );
        expect(describeSections(container).map((s) => s.open)).toEqual([false]);

        rerender(
            <PostMessageView
                {...postMessageViewProps}
                post={makePost(V1.replace('<details>', '<details open>'))}
            />,
        );
        expect(describeSections(container).map((s) => s.open)).toEqual([true]);

        rerender(
            <PostMessageView
                {...postMessageViewProps}
                post={makePost('Mensaje sin sección')}
            />,
        );
        expect(container.querySelector('details')).toBeNull();
        expect(screen.getByText('Mensaje sin sección')).toBeInTheDocument();
    });

    test('CA-DT-06: the preview follows the text while it is written or edited', () => {
        const {container, rerender} = renderPreview(V1);
        expect(container.querySelector('details')!.open).toBe(false);

        rerender(
            <Textbox
                {...textboxProps}
                value={V1.replace('<details>', '<details open>')}
                preview={true}
            />,
        );
        expect(container.querySelector('details')!.open).toBe(true);

        rerender(
            <Textbox
                {...textboxProps}
                value={V1}
                preview={true}
            />,
        );
        expect(container.querySelector('details')!.open).toBe(false);

        // The editor keeps the original text.
        expect(container.querySelector('textarea')!.value).toBe(V1);
    });

    test('CA-DT-08, CA-DT-11: Enter and Space on the summary in the preview toggle the section and do not reach the editor', () => {
        textboxProps.onKeyPress.mockClear();
        textboxProps.onKeyDown.mockClear();
        textboxProps.onKeyUp.mockClear();

        const {container} = renderPreview(V2);
        const details = container.querySelector('details')!;
        const summary = container.querySelector('summary')!;
        expect(details.open).toBe(true);

        fireEvent.keyDown(summary, {key: 'Enter', code: 'Enter', keyCode: 13});
        fireEvent.keyUp(summary, {key: 'Enter', code: 'Enter', keyCode: 13});
        expect(details.open).toBe(false);

        fireEvent.keyDown(summary, {key: ' ', code: 'Space', keyCode: 32});
        fireEvent.keyUp(summary, {key: ' ', code: 'Space', keyCode: 32});
        expect(details.open).toBe(true);

        expect(textboxProps.onKeyDown).not.toHaveBeenCalled();
        expect(textboxProps.onKeyUp).not.toHaveBeenCalled();
        expect(textboxProps.onKeyPress).not.toHaveBeenCalled();
    });

    test('CA-DT-10: the summary is focusable and the state is exposed by the native element', () => {
        const {container} = renderPublished(V1);
        const summary = container.querySelector('summary')!;

        expect(summary.tabIndex).toBe(0);
        expect(summary.parentElement!.tagName).toBe('DETAILS');
    });

    test('CA-DT-15: an ordinary message has the same output in the preview and the published message', () => {
        const preview = renderPreview(ORDINARY).container;
        const published = renderPublished(ORDINARY).container;

        expect(preview.querySelector('details')).toBeNull();
        expect(published.querySelector('details')).toBeNull();
        const publishedHtml = getMarkdownHtml(published, '.post-message__text');
        expect(publishedHtml).toContain('<h1');
        expect(publishedHtml).toBe(getMarkdownHtml(preview, '.textbox-preview-area'));
        expect(published.querySelector('.post-code')?.textContent).toContain('<summary>Dentro de código</summary>');
        expect(published.querySelector('blockquote')?.textContent).toContain('<details>');
    });
});
