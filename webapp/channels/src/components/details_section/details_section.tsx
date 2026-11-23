// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useState} from 'react';

type Props = {

    /** Initial state taken from the message (<details open>). Opening or closing is not saved (D6). */
    open?: boolean;
    summary: React.ReactNode;
    children?: React.ReactNode;
};

// Collapsible section of a message. Uses the native <details> and <summary> elements so that
// screen readers announce the summary and whether it is expanded. The state is kept in React so
// click, Enter and Space behave the same in every view and do not reach the message editor.
export default function DetailsSection({open = false, summary, children}: Props) {
    const [isOpen, setIsOpen] = useState(open);

    // When the message changes (edited, or typed in the preview) and the initial state changes
    // between <details> and <details open>, show the new initial state (DT-03, CA-DT-06).
    useEffect(() => {
        setIsOpen(open);
    }, [open]);

    const toggle = useCallback(() => setIsOpen((value) => !value), []);

    const handleClick = useCallback((e: React.MouseEvent) => {
        // Links and mentions inside the summary keep their own behavior.
        if ((e.target as HTMLElement).closest('a')) {
            return;
        }

        e.preventDefault();
        toggle();
    }, [toggle]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.target !== e.currentTarget) {
            return;
        }

        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            if (e.key === 'Enter') {
                toggle();
            }
        }
    }, [toggle]);

    const handleKeyUp = useCallback((e: React.KeyboardEvent) => {
        if (e.target !== e.currentTarget) {
            return;
        }

        // Space toggles on key release, like a native button, without scrolling the page.
        if (e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            toggle();
        }
    }, [toggle]);

    return (
        <details
            className='post-details'
            open={isOpen}
            data-testid='post-details'
        >
            <summary
                className='post-details__summary'
                tabIndex={0}
                onClick={handleClick}
                onKeyDown={handleKeyDown}
                onKeyUp={handleKeyUp}
            >
                {summary}
            </summary>
            <div className='post-details__body'>
                {children}
            </div>
        </details>
    );
}
