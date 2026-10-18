// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const baseConfig = require('./jest.config.js');

/** @type {import('jest').Config} */
module.exports = {
    ...baseConfig,
    displayName: 'pswe07',
    testMatch: [
        // TA: members, search, permissions and team/user state.
        '<rootDir>/src/components/team_members_*/**/*.test.{js,jsx,ts,tsx}',
        '<rootDir>/src/components/member_list_team/**/*.test.{js,jsx,ts,tsx}',
        '<rootDir>/src/components/searchable_user_list/**/*.test.{js,jsx,ts,tsx}',
        '<rootDir>/src/components/permissions_gates/**/*.test.{js,jsx,ts,tsx}',
        '<rootDir>/src/components/user_list.test.{js,jsx,ts,tsx}',
        '<rootDir>/src/packages/mattermost-redux/src/{actions,reducers/entities,selectors/entities}/{teams,users}.test.{ts,tsx}',
        // DT: parsing, rendering, preview and editing, including message regressions.
        '<rootDir>/src/utils/markdown/**/*.test.{js,jsx,ts,tsx}',
        '<rootDir>/src/utils/text_formatting*.test.{js,jsx,ts,tsx}',
        '<rootDir>/src/components/{markdown,post_markdown,advanced_text_editor,edit_post}/**/*.test.{js,jsx,ts,tsx}',
        '<rootDir>/src/components/post_view/post_message_{preview,view}/**/*.test.{js,jsx,ts,tsx}',
        '<rootDir>/src/components/formatted_markdown_message.test.{js,jsx,ts,tsx}',
    ],
};
