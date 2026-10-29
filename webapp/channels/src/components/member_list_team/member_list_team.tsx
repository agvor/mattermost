// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {type JSX} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import * as UserAgent from '@mattermost/shared/utils/user_agent';
import type {TeamMembership, TeamStats, GetTeamMembersOpts} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {Teams} from 'mattermost-redux/constants';
import type {ActionResult} from 'mattermost-redux/types/actions';
import {isSystemAdmin} from 'mattermost-redux/utils/user_utils';

import SearchableUserList from 'components/searchable_user_list/searchable_user_list_container';
import TeamMembersDropdown from 'components/team_members_dropdown';
import UserListRow from 'components/user_list_row';

import Constants from 'utils/constants';

const USERS_PER_PAGE = 50;

// Keep team role labels separate from the admin-console extraInfo formatting.
function TeamMemberListRow({extraInfo, ...props}: React.ComponentProps<typeof UserListRow>) {
    return (
        <UserListRow
            {...props}
            roleLabel={extraInfo}
        />
    );
}

function TeamMemberFilter({adminsOnly, onChange}: {adminsOnly: boolean; onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void}) {
    const {formatMessage} = useIntl();
    const allLabel = formatMessage({id: 'team_members_modal.filter.all', defaultMessage: 'All members'});
    const adminsLabel = formatMessage({id: 'team_members_modal.filter.admins', defaultMessage: 'Admins'});
    return (
        <div className='col-xs-4'>
            <label
                className='hidden-label'
                htmlFor='teamMemberFilter'
            >
                <FormattedMessage
                    id='team_members_modal.filter.label'
                    defaultMessage='Filter members'
                />
            </label>
            <select
                id='teamMemberFilter'
                className='form-control filter-textbox'
                value={adminsOnly ? 'admins' : 'all'}
                onChange={onChange}
            >
                <option value='all'>
                    {allLabel}
                </option>
                <option value='admins'>
                    {adminsLabel}
                </option>
            </select>
        </div>
    );
}

type Props = {
    searchTerm: string;
    users: UserProfile[];
    teamMembers: {
        [userId: string]: TeamMembership;
    };
    currentTeamId: string;
    totalTeamMembers: number;
    canManageTeamMembers?: boolean;
    actions: {
        getProfiles: (page: number, perPage: number, options: Record<string, string | boolean>) => Promise<ActionResult<UserProfile[]>>;
        getTeamMembers: (teamId: string, page?: number, perPage?: number, options?: GetTeamMembersOpts) => Promise<ActionResult<TeamMembership[]>>;
        searchProfiles: (term: string, options?: {[key: string]: any}) => Promise<ActionResult<UserProfile[]>>;
        getTeamStats: (teamId: string) => Promise<ActionResult<TeamStats>>;
        loadProfilesAndTeamMembers: (page: number, perPage: number, teamId: string, options?: {[key: string]: any}) => Promise<ActionResult>;
        loadStatusesForProfilesList: (users: UserProfile[]) => void;
        loadTeamMembersForProfilesList: (profiles: any, teamId: string, reloadAllMembers: boolean) => Promise<ActionResult>;
        setModalSearchTerm: (term: string) => ActionResult;
    };
};

type State = {
    loading: boolean;
    teamAdminIds: Set<string>;
    adminsOnly: boolean;
    adminUsers: UserProfile[];
    hasNextPage: boolean;
    loadError: boolean;
};

export default class MemberListTeam extends React.PureComponent<Props, State> {
    private searchTimeoutId: number;
    private unmounted = false;
    private queryId = 0;

    constructor(props: Props) {
        super(props);

        this.searchTimeoutId = 0;

        this.state = {
            loading: true,
            teamAdminIds: new Set(),
            adminsOnly: false,
            adminUsers: [],
            hasNextPage: false,
            loadError: false,
        };
    }

    async componentDidMount() {
        const queryId = this.queryId;
        await Promise.all([
            this.loadTeamAdminIds(),
            this.props.actions.loadProfilesAndTeamMembers(0, Constants.PROFILE_CHUNK_SIZE, this.props.currentTeamId, {active: true}),
            this.props.actions.getTeamMembers(this.props.currentTeamId, 0, Constants.DEFAULT_MAX_USERS_PER_TEAM,
                {
                    sort: Teams.SORT_USERNAME_OPTION,
                    exclude_deleted_users: true,
                },
            ),
            this.props.actions.getTeamStats(this.props.currentTeamId),
        ]);
        if (!this.unmounted && queryId === this.queryId && !this.state.adminsOnly) {
            await this.loadVisibleUsers();
        }
    }

    componentWillUnmount() {
        this.unmounted = true;
        clearTimeout(this.searchTimeoutId);
        this.props.actions.setModalSearchTerm('');
    }

    componentDidUpdate(prevProps: Props) {
        if (prevProps.searchTerm !== this.props.searchTerm) {
            clearTimeout(this.searchTimeoutId);
            this.queryId++;
            this.setState({loading: true, loadError: false});
            if (!this.props.searchTerm) {
                this.loadVisibleUsers();
                return;
            }
            this.searchTimeoutId = window.setTimeout(this.loadVisibleUsers, Constants.SEARCH_TIMEOUT_MILLISECONDS);
        }
    }

    changeFilter = (event: React.ChangeEvent<HTMLSelectElement>) => {
        clearTimeout(this.searchTimeoutId);
        this.queryId++;
        this.setState({adminsOnly: event.target.value === 'admins', adminUsers: [], loading: true, loadError: false}, this.loadVisibleUsers);
    };

    loadVisibleUsers = async (page = 0) => {
        const {adminsOnly} = this.state;
        const {actions, currentTeamId, searchTerm} = this.props;
        if (!adminsOnly && !searchTerm) {
            this.loadComplete();
            return;
        }
        const queryId = ++this.queryId;
        this.setState({loading: true, loadError: false});
        const result = searchTerm ? await actions.searchProfiles(searchTerm, {
            team_id: currentTeamId,
            ...(adminsOnly ? {team_roles: ['team_admin'], roles: ['system_admin']} : {}),
        }) : await actions.getProfiles(page, USERS_PER_PAGE, {
            in_team: currentTeamId,
            team_roles: 'team_admin',
            roles: 'system_admin',
            active: true,
        });
        if (this.unmounted || queryId !== this.queryId) {
            return;
        }
        if (!result.data) {
            this.setState({loading: false, loadError: true, adminUsers: [], hasNextPage: false});
            return;
        }
        actions.loadStatusesForProfilesList(result.data);
        const members = await actions.loadTeamMembersForProfilesList(result.data, currentTeamId, true);
        if (this.unmounted || queryId !== this.queryId) {
            return;
        }
        this.setState({
            loading: false,
            loadError: Boolean(members.error),
            adminUsers: adminsOnly ? result.data : [],
            hasNextPage: !searchTerm && result.data.length === USERS_PER_PAGE,
        });
    };

    // Membership roles are sanitized for ordinary members. The existing users
    // endpoint can identify team admins without granting role-management access.
    loadTeamAdminIds = async () => {
        const teamId = this.props.currentTeamId;
        const teamAdminIds = new Set<string>();
        for (let page = 0; ; page++) {
            // Fetch sequentially: the current page tells us whether another exists.
            // eslint-disable-next-line no-await-in-loop
            const {data} = await this.props.actions.getProfiles(page, USERS_PER_PAGE, {
                in_team: teamId,
                team_roles: 'team_admin',
                active: true,
            });
            if (this.unmounted || teamId !== this.props.currentTeamId || !data) {
                return;
            }
            data.forEach((user) => teamAdminIds.add(user.id));
            if (data.length < USERS_PER_PAGE) {
                break;
            }
        }
        this.setState({teamAdminIds});
    };

    loadComplete = () => {
        if (!this.unmounted) {
            this.setState({loading: false});
        }
    };

    nextPage = async (page: number) => {
        if (this.state.adminsOnly) {
            await this.loadVisibleUsers(page);
            return;
        }
        const queryId = ++this.queryId;
        this.setState({loading: true});
        await Promise.all([
            this.props.actions.loadProfilesAndTeamMembers(page, USERS_PER_PAGE, this.props.currentTeamId, {active: true}),
            this.props.actions.getTeamMembers(this.props.currentTeamId, page, Constants.DEFAULT_MAX_USERS_PER_TEAM,
                {
                    sort: Teams.SORT_USERNAME_OPTION,
                    exclude_deleted_users: true,
                } as GetTeamMembersOpts,
            ),
        ]);
        if (queryId === this.queryId) {
            this.loadComplete();
        }
    };

    search = (term: string) => {
        this.props.actions.setModalSearchTerm(term);
    };

    render() {
        let teamMembersDropdown;
        if (this.props.canManageTeamMembers) {
            teamMembersDropdown = [TeamMembersDropdown];
        }

        const teamMembers = this.props.teamMembers;
        const users = this.state.adminsOnly ? this.state.adminUsers : this.props.users;
        const actionUserProps: {
            [userId: string]: {
                teamMember: TeamMembership;
            };
        } = {};

        const extraInfo: Record<string, JSX.Element[]> = {};
        let usersToDisplay;
        if (this.state.loading) {
            usersToDisplay = null;
        } else {
            usersToDisplay = [];

            for (let i = 0; i < users.length; i++) {
                const user = users[i];

                if (teamMembers[user.id] && user.delete_at === 0) {
                    usersToDisplay.push(user);
                    if (isSystemAdmin(user.roles)) {
                        extraInfo[user.id] = [
                            <FormattedMessage
                                key='role'
                                id='team_members_dropdown.systemAdmin'
                                defaultMessage='System Admin'
                            />,
                        ];
                    } else if (this.state.adminsOnly || this.state.teamAdminIds.has(user.id)) {
                        extraInfo[user.id] = [
                            <FormattedMessage
                                key='role'
                                id='team_members_dropdown.teamAdmin'
                                defaultMessage='Team Admin'
                            />,
                        ];
                    }
                    actionUserProps[user.id] = {
                        teamMember: teamMembers[user.id],
                    };
                }
            }
        }

        return (
            <>
                {this.state.loadError && (
                    <div role='alert'>
                        <FormattedMessage
                            id='error.generic.message'
                            defaultMessage='An error has occurred.'
                        />
                    </div>
                )}
                <SearchableUserList
                    key={this.state.adminsOnly ? 'admins' : 'all'}
                    initialTerm={this.props.searchTerm}
                    filter={this.state.adminsOnly ? 'admins' : undefined}
                    hasNextPage={this.state.adminsOnly && !this.props.searchTerm ? this.state.hasNextPage : undefined}
                    filterControl={
                        <TeamMemberFilter
                            adminsOnly={this.state.adminsOnly}
                            onChange={this.changeFilter}
                        />
                    }
                    users={usersToDisplay}
                    extraInfo={extraInfo}
                    rowComponentType={TeamMemberListRow}
                    usersPerPage={USERS_PER_PAGE}
                    total={this.props.totalTeamMembers}
                    nextPage={this.nextPage}
                    previousPage={this.state.adminsOnly ? this.nextPage : undefined}
                    search={this.search}
                    actions={teamMembersDropdown}
                    actionUserProps={actionUserProps}
                    focusOnMount={!UserAgent.isMobile()}
                />
            </>
        );
    }
}
