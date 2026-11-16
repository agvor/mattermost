// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import marked from 'marked';

import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getAutolinkedUrlSchemes, getConfig} from 'mattermost-redux/selectors/entities/general';

import store from 'stores/redux_store';

import type EmojiMap from 'utils/emoji_map';
import RemoveMarkdown from 'utils/markdown/remove_markdown';
import {convertEntityToCharacter} from 'utils/text_formatting';
import type {TextFormattingOptions} from 'utils/text_formatting';
import {getScheme} from 'utils/url';

import {splitDetailsSections} from './details_section';
import Renderer from './renderer';

const removeMarkdown = new RemoveMarkdown();

export function format(text: string, options: TextFormattingOptions = {}, emojiMap?: EmojiMap) {
    const renderer = new Renderer({}, options, emojiMap);

    // Collapsible sections are only recognized in multi-line messages (DT-02).
    if (options.singleline) {
        return formatWithRenderer(text, renderer);
    }

    const segments = splitDetailsSections(text);
    if (segments.length === 1 && segments[0].type === 'text') {
        return formatWithRenderer(text, renderer);
    }

    return segments.map((segment) => {
        if (segment.type === 'text') {
            return formatWithRenderer(segment.text, renderer);
        }

        // The summary and the body go through the same sanitized formatting as the rest of the message.
        // Only these marker elements are added; messageHtmlToComponent turns them into DetailsSection.
        const summary = formatInlineWithRenderer(segment.summary, renderer);
        const body = segment.body.trim() ? formatWithRenderer(segment.body, renderer) : '';

        return (
            `<div data-details-section="${segment.open ? 'open' : 'closed'}">` +
                `<span data-details-summary="true">${summary}</span>` +
                `<div data-details-body="true">${body}</div>` +
            '</div>'
        );
    }).join('');
}

function getMarkdownOptions(renderer: marked.Renderer) {
    const state = store.getState();
    const config = getConfig(state);
    const urlFilter = getAutolinkedUrlSchemeFilter(state);

    return {
        renderer,
        sanitize: true,
        gfm: true,
        tables: true,
        mangle: false,
        inlinelatex: config.EnableLatex === 'true' && config.EnableInlineLatex === 'true',
        urlFilter,
    };
}

export function formatWithRenderer(text: string, renderer: marked.Renderer) {
    return marked(text, getMarkdownOptions(renderer)).trim();
}

// Formats only inline Markdown (emphasis, code, links, emojis, mentions), without block elements.
function formatInlineWithRenderer(text: string, renderer: marked.Renderer) {
    const options = Object.assign({}, marked.defaults, getMarkdownOptions(renderer));
    return marked.inlineLexer(text, [], options).trim();
}

const getAutolinkedUrlSchemeFilter = createSelector(
    'getAutolinkedUrlSchemeFilter',
    getAutolinkedUrlSchemes,
    (autolinkedUrlSchemes: string[]) => {
        return (url: string) => {
            const scheme = getScheme(url);

            return !scheme || autolinkedUrlSchemes.includes(scheme);
        };
    },
);

export function stripMarkdown(text: string) {
    if (typeof text === 'string' && text.length > 0) {
        return convertEntityToCharacter(
            formatWithRenderer(text, removeMarkdown),
        ).trim();
    }

    return text;
}
