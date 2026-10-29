// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {TeamMembership} from '@mattermost/types/teams';

import {act, renderWithContext, screen, userEvent, waitFor, within} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import MemberListTeam from './member_list_team';

window.HTMLElement.prototype.scrollTo = jest.fn();

jest.mock('components/profile_picture', () => ({status}: {status?: string}) => (
    status ? <span role='status'>{status}</span> : null
));
jest.mock('components/user_profile', () => ({userId}: {userId: string}) => <span>{userId}</span>);
jest.mock('components/custom_status/custom_status_emoji', () => () => null);
jest.mock('components/team_members_dropdown', () => () => <button>{'Manage member'}</button>);

function makeProps() {
    const users = ['admin', 'member', 'other-team-admin', 'system', 'both', 'bot', 'deleted'].map((id) => TestHelper.getUserMock({
        id,
        username: id,
        roles: ['system', 'both'].includes(id) ? 'system_user system_admin' : 'system_user',
        is_bot: id === 'bot',
        delete_at: id === 'deleted' ? 1 : 0,
    }));
    const teamMembers: Record<string, TeamMembership> = {};
    users.forEach((user) => {
        teamMembers[user.id] = TestHelper.getTeamMembershipMock({
            user_id: user.id,
            team_id: 'team',
            roles: '',
            scheme_admin: false,
        });
    });
    return {
        users,
        teamMembers,
        currentTeamId: 'team',
        searchTerm: '',
        totalTeamMembers: users.length,
        canManageTeamMembers: false,
        actions: {
            getProfiles: jest.fn().mockResolvedValue({data: users.filter((user) => ['admin', 'bot', 'deleted'].includes(user.id))}),
            getTeamMembers: jest.fn().mockResolvedValue({data: []}),
            getTeamStats: jest.fn().mockResolvedValue({data: {}}),
            loadProfilesAndTeamMembers: jest.fn().mockResolvedValue({data: true}),
            searchProfiles: jest.fn().mockResolvedValue({data: []}),
            loadStatusesForProfilesList: jest.fn(),
            loadTeamMembersForProfilesList: jest.fn().mockResolvedValue({data: true}),
            setModalSearchTerm: jest.fn(),
        },
    };
}

function row(userId: string) {
    return within(screen.getByText(userId).closest('.more-modal__row') as HTMLElement);
}

describe('MemberListTeam role labels', () => {
    test.each([true, false])('preserves status and email presentation (email visible: %s)', async (showEmail) => {
        const props = makeProps();
        props.users = props.users.map((user) => ({
            ...user,
            email: showEmail ? `${user.id}@example.test` : '',
        }));
        renderWithContext(<MemberListTeam {...props}/>, {
            entities: {
                users: {
                    statuses: {admin: 'online', system: 'away', both: 'dnd', member: 'offline'},
                },
            },
        });

        await screen.findByText('admin');
        for (const [id, status] of Object.entries({admin: 'online', system: 'away', both: 'dnd', member: 'offline'})) {
            expect(row(id).getByRole('status')).toHaveTextContent(status);
            expect(row(id).queryByText('Email:')).not.toBeInTheDocument();
            const email = screen.getByText(id).closest('.more-modal__row')!.querySelector('.more-modal__description');
            expect(email).toHaveTextContent(showEmail ? `${id}@example.test` : '');
            if (!showEmail) {
                expect(email?.querySelector('span')).toBeEmptyDOMElement();
            }
        }
        expect(row('admin').getByText('Team Admin')).toBeVisible();
        expect(row('system').getByText('System Admin')).toBeVisible();
        expect(row('both').getByText('System Admin')).toBeVisible();
        expect(row('bot').queryByRole('status')).not.toBeInTheDocument();
    });

    test.each([false, true])('uses the team query despite sanitized memberships (can manage: %s)', async (canManageTeamMembers) => {
        const props = makeProps();
        renderWithContext(
            <MemberListTeam
                {...props}
                canManageTeamMembers={canManageTeamMembers}
            />,
        );

        await screen.findByText('admin');
        expect(row('admin').getByText('Team Admin')).toBeVisible();
        expect(row('bot').getByText('Team Admin')).toBeVisible();
        expect(row('system').getByText('System Admin')).toBeVisible();
        expect(row('both').getByText('System Admin')).toBeVisible();
        expect(row('both').queryByText('Team Admin')).not.toBeInTheDocument();
        expect(row('member').queryByText(/Admin/)).not.toBeInTheDocument();
        expect(row('other-team-admin').queryByText(/Admin/)).not.toBeInTheDocument();
        expect(screen.queryByText('deleted')).not.toBeInTheDocument();
        expect(screen.queryAllByRole('button', {name: 'Manage member'})).toHaveLength(canManageTeamMembers ? 6 : 0);
        expect(props.actions.getProfiles).toHaveBeenCalledWith(0, 50, {
            in_team: 'team', team_roles: 'team_admin', active: true,
        });
    });

    test('loads all admin pages without adding those users to the member list', async () => {
        const props = makeProps();
        const firstPage = Array.from({length: 50}, (_, i) => TestHelper.getUserMock({id: `unloaded-${i}`}));
        props.actions.getProfiles.mockResolvedValueOnce({data: firstPage}).mockResolvedValueOnce({data: [props.users[0]]});
        renderWithContext(<MemberListTeam {...props}/>);

        await screen.findByText('Team Admin');
        expect(row('admin').getByText('Team Admin')).toBeVisible();
        expect(screen.queryByText('unloaded-0')).not.toBeInTheDocument();
        expect(props.actions.getProfiles).toHaveBeenCalledTimes(2);
        expect(props.actions.getProfiles).toHaveBeenLastCalledWith(1, 50, expect.objectContaining({in_team: 'team'}));
    });

    test('refreshes the role on reopening after a demotion', async () => {
        const props = makeProps();
        const {unmount} = renderWithContext(<MemberListTeam {...props}/>);
        await screen.findByText('admin');
        expect(row('admin').getByText('Team Admin')).toBeVisible();
        unmount();
        props.actions.getProfiles.mockResolvedValue({data: []});
        renderWithContext(<MemberListTeam {...props}/>);
        await screen.findByText('admin');
        expect(row('admin').queryByText('Team Admin')).not.toBeInTheDocument();
    });

    test('does not infer team admin from membership roles if the query fails', async () => {
        const props = makeProps();
        props.teamMembers.member.scheme_admin = true;
        props.actions.getProfiles.mockResolvedValue({error: {status_code: 403}});
        renderWithContext(<MemberListTeam {...props}/>);
        await screen.findByText('admin');
        expect(screen.queryByText('Team Admin')).not.toBeInTheDocument();
        expect(row('system').getByText('System Admin')).toBeVisible();
        expect(props.actions.getProfiles).toHaveBeenCalledTimes(1);
    });

    test('ignores an admin lookup that finishes after closing', async () => {
        const props = makeProps();
        let finish!: (result: {data: Array<ReturnType<typeof TestHelper.getUserMock>>}) => void;
        props.actions.getProfiles.mockImplementation(() => new Promise((resolve) => {
            finish = resolve;
        }));
        const {unmount} = renderWithContext(<MemberListTeam {...props}/>);
        unmount();
        finish({data: Array.from({length: 50}, () => props.users[0])});
        await waitFor(() => expect(props.actions.getProfiles).toHaveBeenCalledTimes(1));
    });
});

// Emulate the Redux search prop while exercising the real search input and pager.
function SearchHarness({listProps}: {listProps: ReturnType<typeof makeProps>}) {
    const [searchTerm, setSearchTerm] = React.useState(listProps.searchTerm);
    return (
        <MemberListTeam
            {...listProps}
            searchTerm={searchTerm}
            users={searchTerm ? listProps.users.filter((user) => user.username.includes(searchTerm)) : listProps.users}
            actions={{
                ...listProps.actions,
                setModalSearchTerm: (term) => {
                    listProps.actions.setModalSearchTerm(term);
                    setSearchTerm(term);
                    return {data: true};
                },
            }}
        />
    );
}

function addMemberships(props: ReturnType<typeof makeProps>, users: Array<ReturnType<typeof TestHelper.getUserMock>>) {
    users.forEach((user) => {
        props.teamMembers[user.id] = TestHelper.getTeamMembershipMock({user_id: user.id, team_id: 'team', roles: '', scheme_admin: false});
    });
}

async function selectAdmins() {
    await userEvent.selectOptions(screen.getByRole('combobox', {name: 'Filter members'}), 'admins');
}

describe('MemberListTeam admin filter', () => {
    test.each([false, true])('includes both admin roles and preserves permissions (can manage: %s)', async (canManageTeamMembers) => {
        const props = makeProps();
        props.canManageTeamMembers = canManageTeamMembers;
        const admins = [props.users[0], props.users[3], props.users[4]];
        props.actions.getProfiles.mockImplementation((_page, _perPage, options) => Promise.resolve({
            data: options.roles ? admins : [props.users[0]],
        }));
        renderWithContext(<SearchHarness listProps={props}/>);
        await screen.findByText('member');
        expect(screen.getByRole('combobox', {name: 'Filter members'})).toHaveValue('all');
        await selectAdmins();
        await screen.findByText('system');
        expect(row('admin').getByText('Team Admin')).toBeVisible();
        expect(row('both').getByText('System Admin')).toBeVisible();
        expect(row('both').queryByText('Team Admin')).not.toBeInTheDocument();
        expect(screen.queryByText('member')).not.toBeInTheDocument();
        expect(screen.queryByText('other-team-admin')).not.toBeInTheDocument();
        expect(screen.queryAllByRole('button', {name: 'Manage member'})).toHaveLength(canManageTeamMembers ? 3 : 0);
        expect(props.actions.getProfiles).toHaveBeenLastCalledWith(0, 50, {
            in_team: 'team', team_roles: 'team_admin', roles: 'system_admin', active: true,
        });
        expect(document.getElementById('searchableUserListTotal')).toBeEmptyDOMElement();
        await userEvent.selectOptions(screen.getByRole('combobox', {name: 'Filter members'}), 'all');
        await screen.findByText('member');
        expect(document.getElementById('searchableUserListTotal')).not.toBeEmptyDOMElement();
    });

    test('finds unloaded admins, paginates server results and resets search to page zero', async () => {
        const props = makeProps();
        const admins = Array.from({length: 55}, (_, i) => TestHelper.getUserMock({id: `z-admin-${i}`, username: `z-admin-${i}`}));
        props.users = Array.from({length: 50}, (_, i) => TestHelper.getUserMock({id: `common-${i}`, username: `common-${i}`}));
        props.totalTeamMembers = 105;
        addMemberships(props, [...props.users, ...admins]);
        props.actions.getProfiles.mockImplementation((page, perPage, options) => Promise.resolve({
            data: options.roles ? admins.slice(page * perPage, (page + 1) * perPage) : [],
        }));
        props.actions.searchProfiles.mockResolvedValue({data: [admins[54]]});
        renderWithContext(<SearchHarness listProps={props}/>);
        await screen.findByText('common-0');
        expect(screen.queryByText('z-admin-0')).not.toBeInTheDocument();
        await selectAdmins();
        await screen.findByText('z-admin-0');
        admins.slice(0, 50).forEach((user) => expect(screen.getByText(user.id)).toBeVisible());
        expect(screen.getAllByTestId('userListItemDetails')).toHaveLength(50);
        expect(screen.queryByText('z-admin-54')).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', {name: 'Next'}));
        await screen.findByText('z-admin-54');
        admins.slice(50).forEach((user) => expect(screen.getByText(user.id)).toBeVisible());
        expect(screen.getAllByTestId('userListItemDetails')).toHaveLength(5);
        expect(screen.queryByText('z-admin-0')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Next'})).not.toBeInTheDocument();
        expect(props.actions.getProfiles).toHaveBeenLastCalledWith(1, 50, expect.objectContaining({roles: 'system_admin'}));
        await userEvent.click(screen.getByRole('button', {name: 'Previous'}));
        await screen.findByText('z-admin-0');
        await waitFor(() => expect(screen.getByRole('button', {name: 'Next'})).toBeEnabled());
        await userEvent.click(screen.getByRole('button', {name: 'Next'}));
        await screen.findByText('z-admin-54');
        await userEvent.type(screen.getByRole('textbox', {name: 'Search users'}), 'z-admin-54');
        await screen.findByText('z-admin-54');
        await waitFor(() => expect(props.actions.searchProfiles).toHaveBeenLastCalledWith('z-admin-54', {
            team_id: 'team', team_roles: ['team_admin'], roles: ['system_admin'],
        }));
        expect(screen.queryByRole('button', {name: 'Previous'})).not.toBeInTheDocument();
        await userEvent.clear(screen.getByRole('textbox', {name: 'Search users'}));
        await screen.findByText('z-admin-0');
        expect(props.actions.getProfiles).toHaveBeenLastCalledWith(0, 50, expect.objectContaining({roles: 'system_admin'}));
        expect(screen.queryByRole('button', {name: 'Previous'})).not.toBeInTheDocument();
    });

    test('combines search with the filter, preserves the text and handles empty results', async () => {
        const props = makeProps();
        props.actions.getProfiles.mockResolvedValue({data: [props.users[0]]});
        props.actions.searchProfiles.mockImplementation((term) => Promise.resolve({data: term === 'admin' ? [props.users[0]] : []}));
        renderWithContext(<SearchHarness listProps={props}/>);
        await screen.findByText('member');
        await userEvent.type(screen.getByRole('textbox', {name: 'Search users'}), 'admin');
        await waitFor(() => expect(props.actions.searchProfiles).toHaveBeenLastCalledWith('admin', {team_id: 'team'}));
        await selectAdmins();
        await screen.findByText('admin');
        expect(screen.getByRole('textbox', {name: 'Search users'})).toHaveValue('admin');
        expect(props.actions.searchProfiles).toHaveBeenLastCalledWith('admin', {
            team_id: 'team', team_roles: ['team_admin'], roles: ['system_admin'],
        });
        await userEvent.clear(screen.getByRole('textbox', {name: 'Search users'}));
        await screen.findByText('admin');
        await userEvent.type(screen.getByRole('textbox', {name: 'Search users'}), 'no-match');
        await screen.findByText('No users found');
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        await userEvent.clear(screen.getByRole('textbox', {name: 'Search users'}));
        await screen.findByText('admin');
        await userEvent.selectOptions(screen.getByRole('combobox', {name: 'Filter members'}), 'all');
        await screen.findByText('member');
    });

    test('resets the normal list page on filtering and keeps normal pagination and search', async () => {
        const props = makeProps();
        const users = Array.from({length: 105}, (_, i) => TestHelper.getUserMock({id: `user-${i}`, username: `user-${i}`}));
        props.users = users;
        props.totalTeamMembers = users.length;
        addMemberships(props, users);
        props.actions.getProfiles.mockResolvedValue({data: []});
        renderWithContext(<SearchHarness listProps={props}/>);
        await screen.findByText('user-0');
        await userEvent.click(screen.getByRole('button', {name: 'Next'}));
        await screen.findByText('user-50');
        expect(props.actions.loadProfilesAndTeamMembers).toHaveBeenLastCalledWith(1, 50, 'team', {active: true});
        await selectAdmins();
        await screen.findByText('No users found');
        expect(screen.queryByRole('button', {name: 'Previous'})).not.toBeInTheDocument();
        await userEvent.selectOptions(screen.getByRole('combobox', {name: 'Filter members'}), 'all');
        await screen.findByText('user-0');
        expect(screen.queryByText('user-50')).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', {name: 'Next'}));
        await screen.findByText('user-50');
        props.actions.searchProfiles.mockResolvedValue({data: [users[0]]});
        await userEvent.type(screen.getByRole('textbox', {name: 'Search users'}), 'user-0');
        await screen.findByText('user-0');
        await waitFor(() => expect(props.actions.searchProfiles).toHaveBeenLastCalledWith('user-0', {team_id: 'team'}));
        await userEvent.clear(screen.getByRole('textbox', {name: 'Search users'}));
        await screen.findByText('user-0');
        expect(screen.queryByRole('button', {name: 'Previous'})).not.toBeInTheDocument();
    });

    test('ignores late filter errors after switching back to all members', async () => {
        const props = makeProps();
        let finish!: (result: {error: {status_code: number}}) => void;
        props.actions.getProfiles.mockImplementation((_page, _perPage, options) => (options.roles ? new Promise((resolve) => {
            finish = resolve;
        }) : Promise.resolve({data: []})));
        renderWithContext(<SearchHarness listProps={props}/>);
        await screen.findByText('member');
        await selectAdmins();
        await userEvent.selectOptions(screen.getByRole('combobox', {name: 'Filter members'}), 'all');
        await screen.findByText('member');
        await act(async () => finish({error: {status_code: 403}}));
        expect(screen.getByText('member')).toBeVisible();
        expect(screen.queryByText('No users found')).not.toBeInTheDocument();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    test('reports query errors and recovers when returning to all members', async () => {
        const props = makeProps();
        props.actions.getProfiles.mockImplementation((_page, _perPage, options) => Promise.resolve(options.roles ? {error: {status_code: 403}} : {data: []}));
        renderWithContext(<SearchHarness listProps={props}/>);
        await screen.findByText('member');
        await selectAdmins();
        expect(await screen.findByRole('alert')).toHaveTextContent('An error has occurred.');
        await userEvent.selectOptions(screen.getByRole('combobox', {name: 'Filter members'}), 'all');
        await screen.findByText('member');
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
});
