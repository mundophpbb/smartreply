<?php
/**
 * @copyright (c) 2026 MundoPHPBB
 * @license GNU General Public License, version 2 (GPL-2.0)
 */

namespace mundophpbb\smartreply\migrations;

class v150 extends \phpbb\db\migration\migration
{
    public function effectively_installed()
    {
        return isset($this->config['mundophpbb_smartreply_enable_context_reply']);
    }

    static public function depends_on()
    {
        return ['\\mundophpbb\\smartreply\\migrations\\v140'];
    }

    public function update_data()
    {
        return [
            ['config.add', ['mundophpbb_smartreply_enable_context_reply', 1]],
        ];
    }

    public function revert_data()
    {
        return [
            ['config.remove', ['mundophpbb_smartreply_enable_context_reply']],
        ];
    }
}
