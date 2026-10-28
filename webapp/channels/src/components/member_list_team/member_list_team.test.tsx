// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {TeamMembership} from '@mattermost/types/teams';

import {renderWithContext, screen, waitFor, within} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import MemberListTeam from './member_list_team';

jest.mock('components/profile_picture', () => () => null);
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
