<?php
/**
 * @copyright (c) 2026 MundoPHPBB
 * @license GNU General Public License, version 2 (GPL-2.0)
 */

namespace mundophpbb\smartreply\migrations;

class v130 extends \phpbb\db\migration\migration
{
    public function effectively_installed()
    {
        return isset($this->config['mundophpbb_smartreply_compact_toolbar']);
    }

    static public function depends_on()
    {
        return ['\\mundophpbb\\smartreply\\migrations\\v120'];
    }

    public function update_data()
    {
        return [
            ['config.add', ['mundophpbb_smartreply_compact_toolbar', 1]],
        ];
    }

    public function revert_data()
    {
        return [
            ['config.remove', ['mundophpbb_smartreply_compact_toolbar']],
        ];
    }
}
