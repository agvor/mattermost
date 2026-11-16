// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Recognizes collapsible sections written with the GitHub-style subset of HTML
// (<details> and <summary>) before the text reaches marked, which runs with
// sanitize: true and would otherwise escape the whole block as a paragraph.
// Only the forms agreed in DT-01 are accepted; anything else stays as text.

export type TextSegment = {
    type: 'text';
    text: string;
};

export type DetailsSegment = {
    type: 'details';
    open: boolean;
    summary: string;
    body: string;
};

export type Segment = TextSegment | DetailsSegment;

// <details> or <details open>, optionally followed by the summary on the same line (D2, D3).
const DETAILS_OPEN = /^<details( open)?>[ \t]*(?:<summary>(.*)<\/summary>)?[ \t]*$/i;
const SUMMARY_LINE = /^<summary>(.*)<\/summary>[ \t]*$/i;
const DETAILS_CLOSE = /^<\/details>[ \t]*$/i;

// Any other <details at the start of a line inside a body means a nested section (D5).
const NESTED_DETAILS = /^<details[\s>]/i;

// Fenced code blocks, matching the fork of marked: the closing line repeats the opening fence.
const FENCE_OPEN = /^ *(`{3,}|~{3,})/;

function isFenceClose(line: string, fence: string) {
    return line.trim() === fence;
}

function isValidSummary(summary: string | undefined): summary is string {
    if (typeof summary !== 'string' || summary.trim() === '') {
        return false;
    }

    return !(/<\/?summary[\s>]/i).test(summary);
}

type Match = {

    // null when the block is complete but not admitted (nested section): it is kept as text.
    segment: DetailsSegment | null;
    nextLine: number;
};

// Tries to read a section starting at lines[start]. Returns null if the lines do not form a valid section.
function matchDetails(lines: string[], start: number): Match | null {
    const opening = DETAILS_OPEN.exec(lines[start]);
    if (!opening) {
        return null;
    }

    const open = Boolean(opening[1]);
    let summary = opening[2];
    let bodyStart = start + 1;

    if (summary === undefined) {
        if (bodyStart >= lines.length) {
            return null;
        }

        const summaryLine = SUMMARY_LINE.exec(lines[bodyStart]);
        if (!summaryLine) {
            return null;
        }

        summary = summaryLine[1];
        bodyStart += 1;
    }

    if (!isValidSummary(summary)) {
        return null;
    }

    let fence = '';
    let depth = 0;
    let nested = false;
    for (let i = bodyStart; i < lines.length; i++) {
        const line = lines[i];

        if (fence) {
            if (isFenceClose(line, fence)) {
                fence = '';
            }
            continue;
        }

        const fenceOpen = FENCE_OPEN.exec(line);
        if (fenceOpen) {
            fence = fenceOpen[1];
            continue;
        }

        if (NESTED_DETAILS.test(line)) {
            nested = true;
            depth++;
            continue;
        }

        if (DETAILS_CLOSE.test(line)) {
            if (depth > 0) {
                depth--;
                continue;
            }

            if (nested) {
                return {segment: null, nextLine: i + 1};
            }

            return {
                segment: {
                    type: 'details',
                    open,
                    summary: summary.trim(),
                    body: lines.slice(bodyStart, i).join('\n'),
                },
                nextLine: i + 1,
            };
        }
    }

    return null;
}

export function hasDetailsCandidate(text: string) {
    return (/^<details/im).test(text);
}

// Splits a message into plain Markdown and collapsible sections. Lines inside fenced code
// blocks are never recognized (N4, CA-DT-17). Quotes and lists do not start at column 0, so
// the syntax inside them stays as text (N5).
export function splitDetailsSections(text: string): Segment[] {
    if (!hasDetailsCandidate(text)) {
        return [{type: 'text', text}];
    }

    const lines = text.split(/\r\n|\r|\n/);
    const segments: Segment[] = [];
    let pending: string[] = [];
    let fence = '';

    const flush = () => {
        if (pending.length > 0) {
            segments.push({type: 'text', text: pending.join('\n')});
            pending = [];
        }
    };

    let i = 0;
    while (i < lines.length) {
        const line = lines[i];

        if (fence) {
            if (isFenceClose(line, fence)) {
                fence = '';
            }
            pending.push(line);
            i++;
            continue;
        }

        const fenceOpen = FENCE_OPEN.exec(line);
        if (fenceOpen) {
            fence = fenceOpen[1];
            pending.push(line);
            i++;
            continue;
        }

        const match = matchDetails(lines, i);
        if (match?.segment) {
            flush();
            segments.push(match.segment);
            i = match.nextLine;
            continue;
        }

        if (match) {
            // Nested sections (D5): the whole block stays as text, including the inner section.
            pending.push(...lines.slice(i, match.nextLine));
            i = match.nextLine;
            continue;
        }

        pending.push(line);
        i++;
    }

    flush();

    return segments;
}
