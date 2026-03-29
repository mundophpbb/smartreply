<?php
/**
 * @copyright (c) 2026 MundoPHPBB
 * @license GNU General Public License, version 2 (GPL-2.0)
 */

namespace mundophpbb\smartreply\migrations;

class v140 extends \phpbb\db\migration\migration
{
    public function effectively_installed()
    {
        return isset($this->config['mundophpbb_smartreply_enable_quick_quote'])
            && isset($this->config['mundophpbb_smartreply_enable_mention_button'])
            && isset($this->config['mundophpbb_smartreply_show_post_button_labels']);
    }

    static public function depends_on()
    {
        return ['\\mundophpbb\\smartreply\\migrations\\v130'];
    }

    public function update_data()
    {
        return [
            ['config.add', ['mundophpbb_smartreply_enable_quick_quote', 1]],
            ['config.add', ['mundophpbb_smartreply_enable_mention_button', 1]],
            ['config.add', ['mundophpbb_smartreply_show_post_button_labels', 1]],
        ];
    }

    public function revert_data()
    {
        return [
            ['config.remove', ['mundophpbb_smartreply_enable_quick_quote']],
            ['config.remove', ['mundophpbb_smartreply_enable_mention_button']],
            ['config.remove', ['mundophpbb_smartreply_show_post_button_labels']],
        ];
    }
}
