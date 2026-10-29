// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserProfile} from '@mattermost/types/users';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import SearchableUserList from './searchable_user_list';

window.HTMLElement.prototype.scrollTo = jest.fn();

function TestRow({user}: {user: UserProfile}) {
    return <div>{user.username}</div>;
}

function makeProps() {
    return {
        users: Array.from({length: 55}, (_, i) => TestHelper.getUserMock({id: `user-${i}`, username: `user-${i}`})),
        usersPerPage: 50,
        total: 55,
        page: 1,
        term: '',
        nextPage: jest.fn(),
        previousPage: jest.fn(),
        search: jest.fn(),
        onTermChange: jest.fn(),
        rowComponentType: TestRow,
    };
}

describe('SearchableUserList pagination', () => {
    test('preserves cached pagination and the total for existing callers', () => {
        renderWithContext(<SearchableUserList {...makeProps()}/>);
        expect(screen.getByText('user-50')).toBeVisible();
        expect(screen.queryByText('user-0')).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Previous'})).toBeVisible();
        expect(screen.queryByRole('button', {name: 'Next'})).not.toBeInTheDocument();
        expect(document.getElementById('searchableUserListTotal')).toHaveTextContent('51 - 55 members of 55 total');
    });

    test('shows a server page without slicing it a second time or showing the team total', async () => {
        const props = makeProps();
        renderWithContext(
            <SearchableUserList
                {...props}
                users={props.users.slice(50)}
                hasNextPage={false}
                filter='admins'
            />,
        );
        expect(screen.getByText('user-50')).toBeVisible();
        expect(screen.getByText('user-54')).toBeVisible();
        expect(screen.queryByRole('button', {name: 'Next'})).not.toBeInTheDocument();
        expect(document.getElementById('searchableUserListTotal')).toBeEmptyDOMElement();
        await userEvent.click(screen.getByRole('button', {name: 'Previous'}));
        expect(props.previousPage).toHaveBeenCalledTimes(1);
    });

    test('offers the next server page when the response was full', async () => {
        const props = makeProps();
        renderWithContext(
            <SearchableUserList
                {...props}
                users={props.users.slice(0, 50)}
                page={0}
                hasNextPage={true}
                filter='admins'
            />,
        );
        expect(screen.queryByRole('button', {name: 'Previous'})).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', {name: 'Next'}));
        expect(props.nextPage).toHaveBeenCalledTimes(1);
    });
});
